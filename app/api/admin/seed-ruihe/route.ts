/**
 * /api/admin/seed-ruihe · 为瑞合瑞德数据补种 KPI / TTI / 360 绩效数据层
 *
 * 背景: scripts/import-ruihe.mjs 只灌了「组织 + OKR」两层, KPI 子系统 (强类型 Drizzle
 * 表, 不走 KvStore) + TTI + 360 全空, 导致 6 大功能 (预算/FP&A/TTI追踪/奖金/9宫格/BSC)
 * 跑不出结果。本端点从已导入的 org + OKR 派生出确定性 (可复现) 的绩效数据:
 *
 *   - 1 KpiCycle (id = OKR cycle id, 让 9宫格双轴 / FP&A / 奖金 共用同一 cycleId)
 *   - 7 KpiSubject (BSC 四维: financial / customer / process / growth)
 *   - 三级 KPI cascade:
 *       · company  (assignee=集团总裁)        4 bonus + 3 monitor
 *       · business_unit (assignee=事业部负责人) 每 BU 4 bonus
 *       · individual (assignee=各经理)          每人 3 bonus, 权重和=100
 *     完成率按事业部基线 (售后高 / 制造低) + 个人哈希抖动, 与中央 AI 推演结论一致。
 *   - 3 KpiCausalLink (growth→process→customer→financial BSC 战略地图)
 *   - KpiBonusPayout 草稿 (每个 bonus assignee 试算一版, 让奖金页有结果)
 *   - TTI (每位经理 1 条, 60-70% 健康区, 不挂钱) — OKR 复盘 TTI 追踪
 *   - Review360Cycle + Submissions (每位经理 self/manager/peer 三评) — 9宫格横轴 360 分量
 *
 * 幂等: 所有实体用确定性 id (upsert); 重跑前先清掉本 cycle 的旧 KPI/TTI/360。
 * 权限: admin / owner / champion。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import {
  computeBonusPayout,
  type Kpi,
  type KpiCausalLink,
  type KpiLevel,
  type KpiScope,
} from '@/lib/types/kpi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 确定性哈希 → 0..1 (与 importer 的 pseudo 同思路, 保证可复现) */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const BU_NAMES = ['热水事业部', '空气事业部', '瑞合制造事业部', '售后服务'] as const;
/** 事业部完成率基线 (与推演一致: 售后健康 / 制造垫底) → [min,max] */
const BU_BASELINE: Record<string, [number, number]> = {
  热水事业部: [0.78, 0.95],
  空气事业部: [0.62, 0.85],
  瑞合制造事业部: [0.42, 0.7],
  售后服务: [0.9, 1.1],
  __default: [0.7, 0.9],
};

interface SubjectSpec {
  code: string;
  name: string;
  unit: string;
  measureType: 'numeric' | 'percentage' | 'currency' | 'count';
  scope: KpiScope;
  bsc: 'financial' | 'customer' | 'process' | 'growth';
  start: number;
  target: number;
}

const SUBJECTS: SubjectSpec[] = [
  { code: 'FIN.REV', name: '营业收入', unit: '万元', measureType: 'currency', scope: 'bonus', bsc: 'financial', start: 0, target: 1200 },
  { code: 'FIN.GP', name: '毛利率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'financial', start: 28, target: 38 },
  { code: 'CUST.NPS', name: '客户满意度 / NPS', unit: '分', measureType: 'numeric', scope: 'bonus', bsc: 'customer', start: 70, target: 90 },
  { code: 'GROW.SKILL', name: '关键能力建设', unit: '项', measureType: 'count', scope: 'bonus', bsc: 'growth', start: 0, target: 10 },
  { code: 'PROC.OTD', name: '交付准时率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'process', start: 80, target: 95 },
  { code: 'PROC.QA', name: '质量合格率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'process', start: 90, target: 98 },
  { code: 'GROW.RETAIN', name: '关键人才留存率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'growth', start: 80, target: 92 },
];

/** bonus 权重模板 (和=100) */
const COMPANY_WEIGHTS: Record<string, number> = { 'FIN.REV': 30, 'FIN.GP': 25, 'CUST.NPS': 25, 'GROW.SKILL': 20 };
const BU_WEIGHTS: Record<string, number> = { 'FIN.REV': 35, 'FIN.GP': 20, 'CUST.NPS': 25, 'GROW.SKILL': 20 };
const INDIV_WEIGHTS: Record<string, number> = { 'FIN.REV': 40, 'CUST.NPS': 35, 'GROW.SKILL': 25 };
const MONITOR_CODES = ['PROC.OTD', 'PROC.QA', 'GROW.RETAIN'];

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['admin', 'owner', 'champion']);
  if (forbidden) return forbidden;

  const store = getStore();
  const tenantId = auth.tenantId;
  const now = new Date().toISOString();

  // ── 0. 前置: OKR cycle (作为统一 cycleId) + 用户 + KR ───────────────────
  const cycles = await store.cycles.list();
  const okrCycle = cycles.find((c) => c.isActive) ?? cycles[0];
  if (!okrCycle) {
    return NextResponse.json({ error: 'no_okr_cycle', hint: '先跑 import-ruihe.mjs' }, { status: 400 });
  }
  const cycleId = okrCycle.id;

  const users = (await store.auth.users.list?.({ tenantId })) ?? [];
  const buOf = (u: { departmentId?: string | null }) => (u.departmentId ?? '').split(' / ')[1] || '__default';
  const isManager = (u: { roles?: string[] }) => (u.roles ?? []).includes('manager');

  const owner = users.find((u) => (u.roles ?? []).includes('owner')) ?? users[0];
  const managers = users.filter((u) => isManager(u) && u.id !== owner?.id);
  // 每个事业部的负责人 = 该 BU 第一位 manager
  const leaderByBU: Record<string, string> = {};
  for (const bu of BU_NAMES) {
    const lead = managers.find((u) => buOf(u) === bu);
    if (lead) leaderByBU[bu] = lead.id;
  }
  const leaderIds = new Set(Object.values(leaderByBU));
  const indivManagers = managers.filter((u) => !leaderIds.has(u.id));

  // ── 1. 清旧 (本 cycle 的 KPI/causal/payout/tti/360 submission) ──────────
  const delByCycle = async (
    listFn: () => Promise<Array<{ id: string; cycleId?: string }>>,
    delFn: (id: string) => Promise<void>,
  ) => {
    const rows = (await listFn()).filter((r) => r.cycleId === cycleId);
    for (const r of rows) await delFn(r.id);
  };
  await delByCycle(() => store.kpis.list(), (id) => store.kpis.delete(id));
  await delByCycle(() => store.kpiCausalLinks.list(), (id) => store.kpiCausalLinks.delete(id));
  await delByCycle(() => store.kpiBonusPayouts.list(), (id) => store.kpiBonusPayouts.delete(id));
  await delByCycle(() => store.ttis.list(), (id) => store.ttis.delete(id));
  await delByCycle(() => store.review360Submissions.list(), (id) => store.review360Submissions.delete(id));

  // ── 2. KpiCycle (id = OKR cycleId, 让双轴共用) ──────────────────────────
  await store.kpiCycles.create({
    id: cycleId,
    fiscalYear: 2026,
    name: '2026 年度 KPI',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    tenantId,
    targetsLockedAt: now,
    createdBy: auth.userId,
    createdAt: now,
    updatedAt: now,
  } as never);

  // ── 3. KpiSubjects (按 code 复用) ───────────────────────────────────────
  const existingSubjects = (await store.kpiSubjects.list()).filter((s) => s.tenantId === tenantId);
  const subjectByCode = new Map<string, { id: string; code: string; bsc?: string }>();
  for (const spec of SUBJECTS) {
    const found = existingSubjects.find((s) => s.code === spec.code);
    const id = found?.id ?? `ks_${tenantId}_${spec.code}`;
    await store.kpiSubjects.create({
      id,
      code: spec.code,
      name: spec.name,
      level: 1,
      bscPerspective: spec.bsc,
      defaultScope: spec.scope,
      defaultUnit: spec.unit,
      defaultMeasureType: spec.measureType,
      active: true,
      tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as never);
    subjectByCode.set(spec.code, { id, code: spec.code, bsc: spec.bsc });
  }
  const specByCode = new Map(SUBJECTS.map((s) => [s.code, s]));

  // 完成率: 事业部基线 + 个人哈希抖动
  const completionFor = (seed: string, bu: string): number => {
    const [lo, hi] = BU_BASELINE[bu] ?? BU_BASELINE.__default;
    return Math.round((lo + (hi - lo) * hash01(seed)) * 100) / 100;
  };

  const created: Kpi[] = [];
  const mkKpi = async (args: {
    code: string;
    assigneeId: string;
    level: KpiLevel;
    weight: number;
    scope: KpiScope;
    departmentId?: string;
    completion: number;
    parentKpiId?: string;
    titlePrefix?: string;
  }): Promise<Kpi> => {
    const spec = specByCode.get(args.code)!;
    const subj = subjectByCode.get(args.code)!;
    const range = spec.target - spec.start;
    const currentValue = Math.round((spec.start + range * args.completion) * 100) / 100;
    const id = `kpi_${cycleId}_${args.assigneeId}_${args.code}_${args.level}`;
    const kpi = await store.kpis.create({
      id,
      cycleId,
      subjectId: subj.id,
      bscPerspective: spec.bsc,
      level: args.level,
      parentKpiId: args.parentKpiId,
      assigneeId: args.assigneeId,
      departmentId: args.departmentId,
      title: `${args.titlePrefix ?? ''}${spec.name}`,
      measureType: spec.measureType,
      startValue: spec.start,
      targetValue: spec.target,
      currentValue,
      unit: spec.unit,
      weight: args.weight,
      dataSource: 'manual',
      scope: args.scope,
      tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as never);
    created.push(kpi);
    return kpi;
  };

  // 3a. 公司层 (集团总裁) bonus 4 + monitor 3
  const ownerId = owner!.id;
  const companyKpiByCode: Record<string, Kpi> = {};
  for (const [code, weight] of Object.entries(COMPANY_WEIGHTS)) {
    companyKpiByCode[code] = await mkKpi({
      code, assigneeId: ownerId, level: 'company', weight, scope: 'bonus',
      completion: completionFor(`co_${code}`, '__default'), titlePrefix: '集团·',
    });
  }
  for (const code of MONITOR_CODES) {
    companyKpiByCode[code] = await mkKpi({
      code, assigneeId: ownerId, level: 'company', weight: 0, scope: 'monitor',
      completion: completionFor(`co_${code}`, '__default'), titlePrefix: '集团·',
    });
  }

  // 3b. 事业部层 (各 BU 负责人) bonus 4
  const buKpiByKey: Record<string, string> = {}; // `${bu}_${code}` → kpiId (供个人层挂父)
  for (const bu of BU_NAMES) {
    const leadId = leaderByBU[bu];
    if (!leadId) continue;
    for (const [code, weight] of Object.entries(BU_WEIGHTS)) {
      const k = await mkKpi({
        code, assigneeId: leadId, level: 'business_unit', weight, scope: 'bonus',
        departmentId: bu, completion: completionFor(`bu_${bu}_${code}`, bu),
        parentKpiId: companyKpiByCode[code]?.id, titlePrefix: `${bu}·`,
      });
      buKpiByKey[`${bu}_${code}`] = k.id;
    }
  }

  // 3c. 个人层 (其余经理) bonus 3, 权重和=100; 挂到本事业部同科目 KPI 形成完整 cascade
  for (const m of indivManagers) {
    const bu = buOf(m);
    for (const [code, weight] of Object.entries(INDIV_WEIGHTS)) {
      await mkKpi({
        code, assigneeId: m.id, level: 'individual', weight, scope: 'bonus',
        departmentId: bu, completion: completionFor(`ind_${m.id}_${code}`, bu),
        parentKpiId: buKpiByKey[`${bu}_${code}`], titlePrefix: `${m.name ?? ''}·`,
      });
    }
  }

  // ── 4. 因果链 (BSC 战略地图: growth → process → customer → financial) ────
  const causalPairs: Array<[string, string, string]> = [
    ['GROW.SKILL', 'PROC.OTD', '能力建设 → 交付准时率提升'],
    ['PROC.OTD', 'CUST.NPS', '交付准时 → 客户满意度上升'],
    ['CUST.NPS', 'FIN.REV', '客户满意 → 复购与营收增长'],
  ];
  let causalN = 0;
  for (const [from, to, hyp] of causalPairs) {
    const f = companyKpiByCode[from];
    const t = companyKpiByCode[to];
    if (!f || !t) continue;
    await store.kpiCausalLinks.create({
      id: `cl_${cycleId}_${from}_${to}`,
      cycleId,
      fromKpiId: f.id,
      toKpiId: t.id,
      strength: 0.6 + 0.3 * hash01(`${from}${to}`),
      hypothesis: hyp,
      validated: false,
      tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as never);
    causalN++;
  }

  // ── 5. 奖金草稿 (每个 bonus assignee 试算一版) ─────────────────────────
  const baseByLevel: Record<string, number> = { company: 300000, business_unit: 150000, individual: 60000 };
  const subjCode = (sid: string) => {
    for (const [code, s] of Array.from(subjectByCode.entries())) if (s.id === sid) return code;
    return '';
  };
  const bonusByAssignee = new Map<string, Kpi[]>();
  for (const k of created) {
    if (k.scope !== 'bonus') continue;
    const arr = bonusByAssignee.get(k.assigneeId) ?? [];
    arr.push(k);
    bonusByAssignee.set(k.assigneeId, arr);
  }
  let payoutN = 0;
  for (const [assigneeId, ks] of Array.from(bonusByAssignee.entries())) {
    const base = baseByLevel[ks[0].level] ?? 60000;
    const { weightedCompletion, finalBonus, contributions } = computeBonusPayout(ks, base, subjCode);
    await store.kpiBonusPayouts.create({
      id: `bp_${cycleId}_${assigneeId}`,
      cycleId,
      assigneeId,
      baseBonus: base,
      weightedCompletion,
      finalBonus,
      contributions,
      calculatedAt: now,
      calculatedBy: auth.userId,
      committed: false,
      tenantId,
    } as never);
    payoutN++;
  }

  // ── 6. TTI (每位经理 1 条, 60-70% 健康区, 不挂钱) ──────────────────────
  const objectives = await store.objectives.list();
  let ttiN = 0;
  for (const m of managers) {
    const ownObj = objectives.find((o) => o.ownerId === m.id);
    const rate = Math.round((0.55 + 0.25 * hash01(`tti_${m.id}`)) * 100) / 100; // 0.55-0.80
    await store.ttis.create({
      id: `tti_${cycleId}_${m.id}`,
      cycleId,
      ownerId: m.id,
      title: ownObj ? `成长改进: ${ownObj.title}` : `${m.name ?? ''} 年度能力提升`,
      description: '由 OKR 派生的个人成长改进项 (与薪资完全分离)',
      successCriteria: '季度复盘自评 + 主管确认',
      startValue: 0,
      targetValue: 100,
      currentValue: Math.round(rate * 100),
      unit: '%',
      completionRate: rate,
      affectsCompensation: false,
      notes: '',
      createdAt: now,
      updatedAt: now,
    } as never);
    ttiN++;
  }

  // ── 7. 360 (cycle + 每位经理 self/manager/peer 三评; cycleId=OKR 让 9宫格融合) ──
  await store.review360Cycles.create({
    id: cycleId,
    tenantId,
    name: '2026 年度 360 评估',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    questions: [],
    anonymizePeers: true,
  } as never);

  // P1#4: OKR 周期作为绩效周期主实体, 显式回填 KPI/360 子周期链接
  // (本 seeder 三者 id 相等, 显式链接让 PerformanceCycle 解析器命中第一级而非靠巧合)
  await store.cycles.update(cycleId, {
    kpiCycleId: cycleId,
    review360CycleId: cycleId,
  } as never);

  let subN = 0;
  for (const m of managers) {
    const bu = buOf(m);
    const base = completionFor(`360_${m.id}`, bu); // 0..~1.1
    const score = Math.max(1, Math.min(5, Math.round((2.5 + base * 2) * 10) / 10)); // 1-5
    const raters: Array<['self' | 'manager' | 'peer', string]> = [
      ['self', m.id],
      ['manager', ownerId],
      ['peer', managers.find((x) => x.id !== m.id)?.id ?? ownerId],
    ];
    for (const [rt, raterId] of raters) {
      const jitter = (hash01(`${m.id}${rt}`) - 0.5) * 0.6;
      const s = Math.max(1, Math.min(5, Math.round((score + jitter) * 10) / 10));
      await store.review360Submissions.create({
        id: `r360_${cycleId}_${m.id}_${rt}`,
        cycleId,
        subjectId: m.id,
        raterId,
        raterType: rt,
        answers: [],
        strengths: '执行力与协作良好',
        improvements: '在跨部门沟通与目标拆解上可进一步提升',
        overallScore: s,
        submittedAt: now,
      } as never);
      subN++;
    }
  }

  return NextResponse.json({
    ok: true,
    cycleId,
    counts: {
      kpis: created.length,
      bonusKpis: created.filter((k) => k.scope === 'bonus').length,
      monitorKpis: created.filter((k) => k.scope === 'monitor').length,
      subjects: subjectByCode.size,
      causalLinks: causalN,
      bonusPayouts: payoutN,
      ttis: ttiN,
      review360Submissions: subN,
      managers: managers.length,
      buLeaders: Object.keys(leaderByBU).length,
    },
  });
}
