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
import { withApiLog } from '@/lib/api-log/with-api-log';

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

/**
 * 目标科目设计 (暖通制造/研发/营销产业属性 · 瑞合瑞德):
 *   - 集团/事业部通用 7 科目 (北极星, 各 P&L 责任人共用) — 保留原编码, 兼容既有因果链/权重逻辑。
 *   - 6 大职能条线专属科目 (rd/mfg/mkt/scm/svc/finance), 供个人层按所在部门职能差异化分配,
 *     取代"全员同一套 3 科目"的旧设计 (研发经理和销售经理不该背一样的指标)。
 *   - 起止值方向对"越低越好"型指标 (返修率/事故数/成本/响应时长) 显式反向 (start > target),
 *     computeKpiCompletion 的 (current-start)/(target-start) 公式天然兼容, 无需特判。
 */
const SUBJECTS: SubjectSpec[] = [
  // ── 集团/事业部通用北极星 (不变编码, 兼容既有因果链) ──
  { code: 'FIN.REV', name: '营业收入', unit: '万元', measureType: 'currency', scope: 'bonus', bsc: 'financial', start: 0, target: 1200 },
  { code: 'FIN.GP', name: '毛利率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'financial', start: 28, target: 38 },
  { code: 'CUST.NPS', name: '客户满意度 / NPS', unit: '分', measureType: 'numeric', scope: 'bonus', bsc: 'customer', start: 70, target: 90 },
  { code: 'GROW.SKILL', name: '关键能力建设', unit: '项', measureType: 'count', scope: 'bonus', bsc: 'growth', start: 0, target: 10 },
  { code: 'PROC.OTD', name: '交付准时率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'process', start: 80, target: 95 },
  { code: 'PROC.QA', name: '质量合格率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'process', start: 90, target: 98 },
  { code: 'GROW.RETAIN', name: '关键人才留存率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'growth', start: 80, target: 92 },

  // ── 研发 (R&D): 新品达成 + 能效标准 (空气能/热水器核心竞争力) + 技术成果 ──
  { code: 'RD.NPD', name: '新品按期上市率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'process', start: 60, target: 90 },
  { code: 'RD.EFF', name: '新品能效达标率 (APF/COP)', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'process', start: 75, target: 96 },
  { code: 'RD.PATENT', name: '专利 / 技术成果数', unit: '项', measureType: 'count', scope: 'bonus', bsc: 'growth', start: 0, target: 8 },

  // ── 制造/生产 (瑞合制造事业部核心): 良率 + 成本 + 产能 + 安全 ──
  { code: 'MFG.FPY', name: '一次合格率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'process', start: 88, target: 98 },
  { code: 'MFG.COST', name: '单位制造成本 (同比下降)', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'process', start: 100, target: 88 },
  { code: 'MFG.CAP', name: '产能利用率', unit: '%', measureType: 'percentage', scope: 'monitor', bsc: 'process', start: 65, target: 88 },
  { code: 'MFG.SAFE', name: '安全生产事故数', unit: '起', measureType: 'count', scope: 'monitor', bsc: 'process', start: 3, target: 0 },

  // ── 营销/销售 (热水/空气事业部核心): 市占率 + 渠道网络 + 新客开发 ──
  { code: 'MKT.SHARE', name: '核心品类市场占有率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'customer', start: 8, target: 14 },
  { code: 'MKT.DEALER', name: '经销商网络覆盖数', unit: '家', measureType: 'count', scope: 'bonus', bsc: 'customer', start: 200, target: 320 },
  { code: 'MKT.NEWCUST', name: '新客户开发数', unit: '家', measureType: 'count', scope: 'bonus', bsc: 'customer', start: 0, target: 60 },

  // ── 供应链/采购: 成本节约 + 供应商交付 + 库存周转 ──
  { code: 'SCM.COST', name: '采购成本节约率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'process', start: 0, target: 6 },
  { code: 'SCM.OTD', name: '供应商交付准时率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'process', start: 82, target: 96 },
  { code: 'SCM.INV', name: '库存周转率', unit: '次/年', measureType: 'numeric', scope: 'monitor', bsc: 'process', start: 4, target: 8 },

  // ── 售后服务 (独立顶层单元): 响应时长 + 返修率 ──
  { code: 'SVC.SLA', name: '平均维修响应时长', unit: '小时', measureType: 'numeric', scope: 'bonus', bsc: 'process', start: 48, target: 12 },
  { code: 'SVC.RETURN', name: '返修率', unit: '%', measureType: 'percentage', scope: 'bonus', bsc: 'customer', start: 6, target: 2 },
];

/** bonus 权重模板 (和=100) */
const COMPANY_WEIGHTS: Record<string, number> = { 'FIN.REV': 30, 'FIN.GP': 25, 'CUST.NPS': 25, 'GROW.SKILL': 20 };
const BU_WEIGHTS: Record<string, number> = { 'FIN.REV': 35, 'FIN.GP': 20, 'CUST.NPS': 25, 'GROW.SKILL': 20 };
const MONITOR_CODES = ['PROC.OTD', 'PROC.QA', 'GROW.RETAIN'];

/** 职能条线 (按部门路径关键词分类), 决定个人层背哪一套指标 */
type OrgFunction = 'rd' | 'mfg' | 'mkt' | 'scm' | 'svc' | 'hr' | 'finance' | 'general';

function classifyFunction(deptPath: string): OrgFunction {
  if (/研发|技术中心|工程院|研究院|设计院/.test(deptPath)) return 'rd';
  if (/制造|生产|工厂|车间|智造/.test(deptPath)) return 'mfg';
  if (/营销|销售|市场|渠道|电商/.test(deptPath)) return 'mkt';
  if (/供应链|采购|物流|计划/.test(deptPath)) return 'scm';
  if (/售后|客服/.test(deptPath)) return 'svc';
  if (/人力|人事|HR/i.test(deptPath)) return 'hr';
  if (/财务|资金|审计/.test(deptPath)) return 'finance';
  return 'general';
}

/** 个人层按职能条线差异化的 bonus 权重模板 (各自和=100) — 取代"全员同 3 科目"的旧设计 */
const INDIV_WEIGHTS_BY_FN: Record<OrgFunction, Record<string, number>> = {
  rd: { 'RD.NPD': 35, 'RD.EFF': 35, 'RD.PATENT': 30 },
  mfg: { 'MFG.FPY': 35, 'MFG.COST': 35, 'MFG.CAP': 30 },
  mkt: { 'MKT.SHARE': 30, 'MKT.DEALER': 30, 'MKT.NEWCUST': 40 },
  scm: { 'SCM.COST': 35, 'SCM.OTD': 35, 'SCM.INV': 30 },
  svc: { 'SVC.SLA': 40, 'SVC.RETURN': 30, 'CUST.NPS': 30 },
  hr: { 'GROW.RETAIN': 50, 'GROW.SKILL': 50 },
  finance: { 'FIN.GP': 50, 'FIN.REV': 30, 'GROW.SKILL': 20 },
  general: { 'FIN.REV': 40, 'CUST.NPS': 35, 'GROW.SKILL': 25 },
};

async function POSTApiHandler(req: NextRequest) {
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
    /** 跨体系联合持有人 (纯数据层联合监控标注, 不驱动奖金——见 Kpi.coOwnerIds 注释) */
    coOwnerIds?: string[];
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
      coOwnerIds: args.coOwnerIds,
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

  // 3c. 个人层 (其余经理) bonus 3, 权重和=100; 按所属职能条线 (研发/制造/营销/供应链/售后/人力/财务)
  //     分配差异化科目组合 — 挂到本事业部同科目 KPI 形成 cascade (无同名 BU 科目时 parentKpiId 留空, 合法)。
  // functionKpiByCode: 记录每个职能专属科目第一次出现的 KPI id, 供下方"跨职能制约链"做代表性连线。
  const functionKpiByCode: Record<string, string> = {};

  // 先分组: 同一事业部内按职能条线归并经理 id, 供"跨体系联合持有"标注找对方 (数据层, 非奖金)。
  const managerIdsByBuFn = new Map<string, string[]>();
  for (const m of indivManagers) {
    const key = `${buOf(m)}_${classifyFunction(m.departmentId ?? '')}`;
    const arr = managerIdsByBuFn.get(key) ?? [];
    arr.push(m.id);
    managerIdsByBuFn.set(key, arr);
  }
  // 需要跨体系共背的科目 → 对方职能条线 (同事业部内): 该科目由本人 + 对方职能全员共同持有监控。
  const JOINT_OWNERSHIP: Record<string, OrgFunction> = {
    'MFG.CAP': 'scm', // 产能利用率: 制造 + 供应链 共背 (断料/交付都会拖累产能)
    'RD.NPD': 'mfg',  // 新品按期上市率: 研发 + 制造 共背 (设计定型才能量产爬坡)
  };

  for (const m of indivManagers) {
    const bu = buOf(m);
    const fn = classifyFunction(m.departmentId ?? '');
    for (const [code, weight] of Object.entries(INDIV_WEIGHTS_BY_FN[fn])) {
      const jointFn = JOINT_OWNERSHIP[code];
      const coOwnerIds = jointFn ? managerIdsByBuFn.get(`${bu}_${jointFn}`) : undefined;
      const k = await mkKpi({
        code, assigneeId: m.id, level: 'individual', weight, scope: 'bonus',
        departmentId: bu, completion: completionFor(`ind_${m.id}_${code}`, bu),
        parentKpiId: buKpiByKey[`${bu}_${code}`], titlePrefix: `${m.name ?? ''}·`,
        coOwnerIds,
      });
      if (!functionKpiByCode[code]) functionKpiByCode[code] = k.id;
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

  // ── 4b. 跨职能制约链 (研发→制造→供应链/售后→营销→财务 的产研销接力赋能) ──
  //   与上面严格按 BSC growth→process→customer→financial 阶梯不同: 这里连的是
  //   同为 process 维度的跨职能接力 (如 供应链准时→制造产能), 反映真实产研销依赖,
  //   不受"同维度不算因果"限制 (本 seeder 直写 store, 不经 assertValidLink 校验)。
  //   代表性连线: 用每个职能科目第一次出现的个人 KPI 作为该职能的代表节点。
  const crossFnPairs: Array<[string, string, string]> = [
    ['RD.NPD', 'MFG.CAP', '研发新品按期交付设计 → 制造产能顺利爬坡'],
    ['RD.EFF', 'MKT.SHARE', '研发能效达标 → 产品竞争力驱动市场份额'],
    ['SCM.OTD', 'MFG.CAP', '供应商交付准时 → 制造产能利用率不受断料拖累'],
    ['MFG.FPY', 'SVC.RETURN', '制造一次合格率 → 售后返修率下降'],
    ['MFG.CAP', 'MKT.DEALER', '产能保障供货 → 经销商网络可持续扩张'],
    ['MKT.SHARE', 'FIN.REV', '市场份额提升 → 营业收入增长'],
  ];
  let crossFnN = 0;
  for (const [from, to, hyp] of crossFnPairs) {
    const f = functionKpiByCode[from];
    const t = functionKpiByCode[to];
    if (!f || !t) continue;
    await store.kpiCausalLinks.create({
      id: `cl_${cycleId}_fn_${from}_${to}`,
      cycleId,
      fromKpiId: f,
      toKpiId: t,
      strength: 0.5 + 0.3 * hash01(`fn_${from}${to}`),
      hypothesis: hyp,
      validated: false,
      validationNote: '(seed) 同维度跨职能接力特例, 豁免 isCausalDirectionValid 方向校验 —— 正式因果链管理 UI 新建此类链需走 allowAnyDirection 特批, 非常规路径不放行',
      tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as never);
    crossFnN++;
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
      crossFunctionCausalLinks: crossFnN,
      bonusPayouts: payoutN,
      ttis: ttiN,
      review360Submissions: subN,
      managers: managers.length,
      buLeaders: Object.keys(leaderByBU).length,
    },
  });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/admin/seed-ruihe' });
