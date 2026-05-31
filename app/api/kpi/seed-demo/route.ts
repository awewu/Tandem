/**
 * /api/kpi/seed-demo · 一键种入 KPI 演示数据
 *
 * 创建一个完整的 FY2026 演示周期, 让 /admin/kpi/* 页和 /nine-box/suggestions
 * 立即有数据可玩.
 *
 * 内容:
 *   - 1 KpiCycle (FY2026, active, targets locked)
 *   - 7 KpiSubjects (财务/营收/客户/运营/人才)
 *   - 12 KPI 实例 (混合 bonus/monitor, 4 个 assignee)
 *   - 各 assignee 的 actual 已填到不同完成率, 9-box 落点覆盖 5 种以上格子
 *
 * 行为:
 *   - 幂等: 已存在 fiscalYear=2026 的演示周期则跳过 (返回 reason=already_seeded)
 *   - 强制重置: ?force=1 删除该周期的所有 KPI/cycle 后重建
 *
 * 权限: admin / champion
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import type { Kpi, KpiCycle, KpiLevel, KpiSubject } from '@/lib/types/kpi';

const FISCAL_YEAR = 2026;
const CYCLE_NAME = 'FY2026 (Demo)';

const ASSIGNEES = ['demo-user', 'demo-star', 'demo-burnout', 'demo-mismatch', 'demo-intervene'] as const;

const PROFILES: Record<
  (typeof ASSIGNEES)[number],
  { kpiCompletion: number; ttiCompletion: number; label: string }
> = {
  'demo-user': { kpiCompletion: 0.88, ttiCompletion: 0.9, label: '👨 我自己 (BSC 四维示范指标)' },
  'demo-star': { kpiCompletion: 1.05, ttiCompletion: 0.85, label: '⭐ 明星 (高 KPI + 高 TTI)' },
  'demo-burnout': { kpiCompletion: 1.0, ttiCompletion: 0.3, label: '⚠️ 风险枯萎 (高 KPI + 低 TTI)' },
  'demo-mismatch': { kpiCompletion: 0.5, ttiCompletion: 0.85, label: '🔄 人岗错位 (低 KPI + 高 TTI)' },
  'demo-intervene': { kpiCompletion: 0.4, ttiCompletion: 0.2, label: '🚨 必须干预 (低 KPI + 低 TTI)' },
};

interface SubjectSpec {
  code: string;
  name: string;
  defaultUnit: string;
  defaultMeasureType: KpiSubject['defaultMeasureType'];
  defaultScope: 'bonus' | 'monitor';
  bscPerspective: KpiSubject['bscPerspective'];
}

const SUBJECTS: SubjectSpec[] = [
  { code: 'FIN.REV', name: '营业收入', defaultUnit: '万元', defaultMeasureType: 'currency', defaultScope: 'bonus', bscPerspective: 'financial' },
  { code: 'FIN.GP', name: '毛利率', defaultUnit: '%', defaultMeasureType: 'percentage', defaultScope: 'bonus', bscPerspective: 'financial' },
  { code: 'CUST.CSAT', name: '客户满意度', defaultUnit: '分', defaultMeasureType: 'numeric', defaultScope: 'monitor', bscPerspective: 'customer' },
  { code: 'CUST.NEW', name: '新客户数', defaultUnit: '家', defaultMeasureType: 'count', defaultScope: 'bonus', bscPerspective: 'customer' },
  { code: 'OPS.QA', name: '质量合格率', defaultUnit: '%', defaultMeasureType: 'percentage', defaultScope: 'monitor', bscPerspective: 'process' },
  { code: 'OPS.LEAD', name: '交付周期', defaultUnit: '天', defaultMeasureType: 'numeric', defaultScope: 'monitor', bscPerspective: 'process' },
  { code: 'HR.RETAIN', name: '关键人才留存率', defaultUnit: '%', defaultMeasureType: 'percentage', defaultScope: 'monitor', bscPerspective: 'growth' },
];

interface KpiSpec {
  subjectCode: string;
  /** 个人级用 PROFILES key; 组织级用自定义主体 id (如 dept-rd) */
  assignee: string;
  title: string;
  startValue: number;
  targetValue: number;
  weight: number;
  scope: 'bonus' | 'monitor';
  /** 组织层级, 缺省: monitor=company / 其余=individual */
  level?: KpiLevel;
  /** 完成率 0-1 (组织级显式给; 个人级用 PROFILES) */
  completion?: number;
}

const KPI_SPECS: KpiSpec[] = [
  // demo-user 本人经典的 BSC 四维度度量
  { subjectCode: 'FIN.REV', assignee: 'demo-user', title: '研发项目相关业务增量营收', startValue: 0, targetValue: 500, weight: 30, scope: 'bonus' },
  { subjectCode: 'CUST.CSAT', assignee: 'demo-user', title: '核心系统可用性 SLA 客户满意度', startValue: 80, targetValue: 95, weight: 30, scope: 'bonus' },
  { subjectCode: 'OPS.QA', assignee: 'demo-user', title: '代码发布质量合格率', startValue: 90, targetValue: 98, weight: 20, scope: 'bonus' },
  { subjectCode: 'HR.RETAIN', assignee: 'demo-user', title: '关键技能掌握与内部技术分享次', startValue: 0, targetValue: 5, weight: 20, scope: 'bonus' },

  // 当前登录用户本人 (useCurrentUserId 现统一返回 'me') · BSC 四维 → 让"个人"tab 有数据
  { subjectCode: 'FIN.REV',   assignee: 'me', title: '我的·研发业务增量营收',     startValue: 0,  targetValue: 500, weight: 30, scope: 'bonus', level: 'individual', completion: 0.86 },
  { subjectCode: 'CUST.CSAT', assignee: 'me', title: '我的·核心系统 SLA 满意度',   startValue: 80, targetValue: 95,  weight: 30, scope: 'bonus', level: 'individual', completion: 0.92 },
  { subjectCode: 'OPS.QA',    assignee: 'me', title: '我的·代码发布质量合格率',     startValue: 90, targetValue: 98,  weight: 20, scope: 'bonus', level: 'individual', completion: 0.95 },
  { subjectCode: 'HR.RETAIN', assignee: 'me', title: '我的·关键技能掌握与分享',     startValue: 0,  targetValue: 5,   weight: 20, scope: 'bonus', level: 'individual', completion: 0.80 },

  // 原有其他被考核人员的演示数据
  { subjectCode: 'FIN.REV', assignee: 'demo-star', title: '营业收入 (Star)', startValue: 5000, targetValue: 8000, weight: 50, scope: 'bonus' },
  { subjectCode: 'CUST.NEW', assignee: 'demo-star', title: '新客户数 (Star)', startValue: 0, targetValue: 30, weight: 30, scope: 'bonus' },
  { subjectCode: 'FIN.GP', assignee: 'demo-star', title: '毛利率 (Star)', startValue: 25, targetValue: 35, weight: 20, scope: 'bonus' },
  { subjectCode: 'FIN.REV', assignee: 'demo-burnout', title: '营业收入 (Burnout)', startValue: 4000, targetValue: 6000, weight: 60, scope: 'bonus' },
  { subjectCode: 'OPS.LEAD', assignee: 'demo-burnout', title: '交付周期 (Burnout)', startValue: 30, targetValue: 20, weight: 40, scope: 'bonus' },
  { subjectCode: 'FIN.REV', assignee: 'demo-mismatch', title: '营业收入 (Mismatch)', startValue: 3000, targetValue: 5000, weight: 70, scope: 'bonus' },
  { subjectCode: 'OPS.QA', assignee: 'demo-mismatch', title: '质量合格率 (Mismatch)', startValue: 90, targetValue: 95, weight: 30, scope: 'bonus' },
  { subjectCode: 'FIN.REV', assignee: 'demo-intervene', title: '营业收入 (Intervene)', startValue: 2000, targetValue: 4000, weight: 100, scope: 'bonus' },
  { subjectCode: 'CUST.CSAT', assignee: 'demo-star', title: '客户满意度', startValue: 70, targetValue: 85, weight: 0, scope: 'monitor' },
  { subjectCode: 'OPS.QA', assignee: 'demo-star', title: '质量合格率', startValue: 92, targetValue: 98, weight: 0, scope: 'monitor' },
  { subjectCode: 'HR.RETAIN', assignee: 'demo-star', title: '关键人才留存率', startValue: 80, targetValue: 90, weight: 0, scope: 'monitor' },
  { subjectCode: 'OPS.LEAD', assignee: 'demo-star', title: '平均交付周期', startValue: 28, targetValue: 18, weight: 0, scope: 'monitor' },

  // ── 部门级 (研发部) · BSC 四维 ──
  { subjectCode: 'FIN.REV',   assignee: 'dept-rd', title: '研发部·业务增量营收',     startValue: 0,  targetValue: 1200, weight: 30, scope: 'bonus', level: 'department', completion: 0.82 },
  { subjectCode: 'CUST.CSAT', assignee: 'dept-rd', title: '研发部·内部客户满意度',     startValue: 78, targetValue: 92,   weight: 25, scope: 'bonus', level: 'department', completion: 0.90 },
  { subjectCode: 'OPS.QA',    assignee: 'dept-rd', title: '研发部·交付质量合格率',     startValue: 88, targetValue: 97,   weight: 25, scope: 'bonus', level: 'department', completion: 0.95 },
  { subjectCode: 'HR.RETAIN', assignee: 'dept-rd', title: '研发部·关键人才留存率',     startValue: 80, targetValue: 92,   weight: 20, scope: 'bonus', level: 'department', completion: 0.88 },

  // ── 体系级 (技术体系) · BSC 四维 ──
  { subjectCode: 'FIN.GP',    assignee: 'sys-tech', title: '技术体系·毛利率',           startValue: 28, targetValue: 38, weight: 30, scope: 'bonus', level: 'system', completion: 0.76 },
  { subjectCode: 'CUST.NEW',  assignee: 'sys-tech', title: '技术体系·新客户交付数',     startValue: 0,  targetValue: 40, weight: 25, scope: 'bonus', level: 'system', completion: 0.85 },
  { subjectCode: 'OPS.LEAD',  assignee: 'sys-tech', title: '技术体系·平均交付周期',     startValue: 32, targetValue: 20, weight: 25, scope: 'bonus', level: 'system', completion: 0.70 },
  { subjectCode: 'HR.RETAIN', assignee: 'sys-tech', title: '技术体系·人才梯队完备度',   startValue: 70, targetValue: 88, weight: 20, scope: 'bonus', level: 'system', completion: 0.80 },

  // ── 事业部级 (智能产品事业部) · BSC 四维 ──
  { subjectCode: 'FIN.REV',   assignee: 'bu-product', title: '智能产品事业部·营业收入',   startValue: 8000, targetValue: 15000, weight: 35, scope: 'bonus', level: 'business_unit', completion: 0.92 },
  { subjectCode: 'FIN.GP',    assignee: 'bu-product', title: '智能产品事业部·毛利率',     startValue: 30,   targetValue: 42,    weight: 20, scope: 'bonus', level: 'business_unit', completion: 0.83 },
  { subjectCode: 'CUST.CSAT', assignee: 'bu-product', title: '智能产品事业部·客户满意度', startValue: 82,   targetValue: 93,    weight: 25, scope: 'bonus', level: 'business_unit', completion: 0.96 },
  { subjectCode: 'HR.RETAIN', assignee: 'bu-product', title: '智能产品事业部·组织能力指数', startValue: 75, targetValue: 90,    weight: 20, scope: 'bonus', level: 'business_unit', completion: 0.87 },
];

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['admin', 'champion']);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  const store = getStore();
  const now = new Date().toISOString();

  const existingCycles = (await store.kpiCycles.list()).filter(
    (c) => c.tenantId === auth.tenantId && c.fiscalYear === FISCAL_YEAR && c.name === CYCLE_NAME,
  );

  if (existingCycles.length > 0 && !force) {
    return NextResponse.json({
      ok: true,
      reason: 'already_seeded',
      cycleId: existingCycles[0].id,
      message: '演示周期已存在. 加 ?force=1 强制重建.',
    });
  }

  if (existingCycles.length > 0 && force) {
    for (const c of existingCycles) {
      const kpis = (await store.kpis.list()).filter((k) => k.cycleId === c.id);
      for (const k of kpis) await store.kpis.delete(k.id);
      const payouts = (await store.kpiBonusPayouts.list()).filter((p) => p.cycleId === c.id);
      for (const p of payouts) await store.kpiBonusPayouts.delete(p.id);
      await store.kpiCycles.delete(c.id);
    }
  }

  const cycle = await store.kpiCycles.create({
    fiscalYear: FISCAL_YEAR,
    name: CYCLE_NAME,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    tenantId: auth.tenantId,
    targetsLockedAt: now,
    createdBy: auth.userId,
    createdAt: now,
    updatedAt: now,
  } as Omit<KpiCycle, 'id'>);

  const subjectByCode = new Map<string, KpiSubject>();
  for (const spec of SUBJECTS) {
    const existing = (await store.kpiSubjects.list()).find(
      (s) => s.tenantId === auth.tenantId && s.code === spec.code,
    );
    if (existing) {
      // 旧 subject 可能缺 bscPerspective (早期 seed), 回填以保证 BSC 分类准确
      if (existing.bscPerspective !== spec.bscPerspective) {
        await store.kpiSubjects.update(existing.id, {
          bscPerspective: spec.bscPerspective,
          updatedAt: now,
        });
      }
      subjectByCode.set(spec.code, { ...existing, bscPerspective: spec.bscPerspective });
      continue;
    }
    const subj = await store.kpiSubjects.create({
      code: spec.code,
      name: spec.name,
      level: 1,
      bscPerspective: spec.bscPerspective,
      defaultScope: spec.defaultScope,
      defaultUnit: spec.defaultUnit,
      defaultMeasureType: spec.defaultMeasureType,
      active: true,
      tenantId: auth.tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as Omit<KpiSubject, 'id'>);
    subjectByCode.set(spec.code, subj);
  }

  // 清旧快照 (force 模式)
  if (force) {
    const oldKpiIds = new Set((await store.kpis.list()).filter((k) => k.cycleId === cycle.id).map((k) => k.id));
    const oldSnaps = (await store.kpiSnapshots.list()).filter((s) => oldKpiIds.has(s.kpiId));
    for (const s of oldSnaps) await store.kpiSnapshots.delete(s.id);
  }

  const created: Kpi[] = [];
  // 历史快照跨度: 从周期开始到今天每日一条 (供 /kpi 月/季/年 as-of 有真实可核对历史)
  const cycleStart = new Date(cycle.startDate);
  const todayDate = new Date();
  const spanDays = Math.max(1, Math.floor((todayDate.getTime() - cycleStart.getTime()) / 86400000));
  for (const spec of KPI_SPECS) {
    const subj = subjectByCode.get(spec.subjectCode);
    if (!subj) continue;
    const profile = PROFILES[spec.assignee as keyof typeof PROFILES];
    const range = spec.targetValue - spec.startValue;
    const completionRate =
      spec.completion ??
      (spec.scope === 'monitor' ? 0.85 : (profile?.kpiCompletion ?? 0.8));
    const currentValue = spec.startValue + range * completionRate;
    const level: KpiLevel = spec.level ?? (spec.scope === 'monitor' ? 'company' : 'individual');
    const kpi = await store.kpis.create({
      cycleId: cycle.id,
      subjectId: subj.id,
      bscPerspective: subj.bscPerspective,
      level,
      assigneeId: spec.assignee,
      title: spec.title,
      measureType: subj.defaultMeasureType,
      startValue: spec.startValue,
      targetValue: spec.targetValue,
      currentValue: Math.round(currentValue * 100) / 100,
      unit: subj.defaultUnit,
      weight: spec.weight,
      dataSource: 'manual',
      scope: spec.scope,
      tenantId: auth.tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as Omit<Kpi, 'id'>);
    created.push(kpi);

    // 历史快照 (synthetic monotonic + 噪声): 从周期开始到今天, 每日一条
    const finalValue = kpi.currentValue;
    for (let i = 0; i <= spanDays; i++) {
      const date = new Date(cycleStart);
      date.setDate(date.getDate() + i);
      if (date > todayDate) break;
      const dayStr = date.toISOString().slice(0, 10);
      const t = spanDays === 0 ? 1 : i / spanDays; // 0..1
      // 线性逼近 + ±5% 噪声 (deterministic by index, 幂等; 端点对齐 start/final)
      const noise = ((i * 7 + spec.startValue) % 11) / 100 - 0.05;
      const v = spec.startValue + (finalValue - spec.startValue) * (t + noise * t * (1 - t));
      await store.kpiSnapshots.create({
        kpiId: kpi.id,
        date: dayStr,
        cumulativeValue: Math.round(v * 100) / 100,
        source: 'manual',
        createdAt: now,
      } as Omit<import('@/lib/types/kpi').KpiSnapshot, 'id'>);
    }
  }

  return NextResponse.json({
    ok: true,
    cycleId: cycle.id,
    cycleName: cycle.name,
    subjects: subjectByCode.size,
    kpis: created.length,
    assignees: ASSIGNEES.length,
    profiles: Object.entries(PROFILES).map(([id, p]) => ({ id, ...p })),
    next: [
      { href: '/admin/kpi/setup', label: '查看周期与目标 (已锁)' },
      { href: '/admin/kpi/health-dashboard', label: '健康度看板' },
      { href: '/admin/kpi/bonus-payout', label: '试算 / 下发奖金' },
      { href: '/nine-box/suggestions', label: '9-box 联动建议' },
    ],
  });
}
