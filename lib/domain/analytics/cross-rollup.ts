/**
 * 四维错配交叉聚合 (Cross-Rollup) · 机会#5 进化杠杆
 *
 * 把此前各自独立的四个真值层 — OKR 目标 / KPI 底线 / 人才 9 宫格 / 年终奖金 —
 * 在「人」这个最小公共主体上对齐, 自动算出跨维度的错配信号与一个 0-100 的
 * 「四维错配得分」, 供:
 *   - /api/analytics/cross-rollup 看板消费
 *   - analytics.cross_rollup AI 技能 (中央 AI 融合推演直接读真值, 不再靠多次取数拼凑)
 *
 * 设计铁律:
 *   - 只读, 不写任何状态 (green zone)。
 *   - 复用既有口径: ttiScore / kpiScore 与 /api/nine-box 完全一致, 不另立标准。
 *   - 错配 = 维度之间的"不一致", 不是单维度的好坏。例如高 KPI + 低 TTI = 烧穿,
 *     低完成率却拿了奖金 = 激励错配, 高完成率却没 commit = 保留风险。
 */

import type { TandemStore } from '@/lib/storage/repository';
import { classifyNineBox, type NineBoxCell } from '@/lib/types/okr-tti';
import { computeKpiCompletion, type KpiBonusPayout } from '@/lib/types/kpi';
import { resolveCycleScope } from '@/lib/domain/cycle/performance-cycle';

export type MisalignKind =
  | 'burnout_risk' // 高 KPI + 低 TTI: 重复劳动倦怠, 9-box=risk_burnout
  | 'mismatch' // 低 KPI + 高 TTI: 人岗错位
  | 'must_intervene' // 双低: 紧急干预
  | 'bonus_overpay' // 拿了奖金但加权完成率偏低 (激励与产出背离)
  | 'bonus_underpay' // 高完成率却奖金占比偏低
  | 'bonus_uncommitted'; // 有奖金草稿但迟迟未 commit (star/high_performer 保留风险)

export interface MisalignSignal {
  kind: MisalignKind;
  severity: 'low' | 'medium' | 'high' | 'urgent';
  detail: string;
}

export interface CrossRollupPerson {
  userId: string;
  name: string;
  businessUnit: string;
  departmentId: string | null;
  okrProgress: number | null; // TTI = KR 平均进度 0-1
  ttiScore: number; // (TTI + 360) / 2, 与 nine-box 横轴一致
  kpiScore: number; // bonus 加权完成率, 与 nine-box 纵轴一致
  cell: NineBoxCell;
  bonus: {
    finalBonus: number;
    baseBonus: number;
    weightedCompletion: number;
    committed: boolean;
  } | null;
  signals: MisalignSignal[];
  misalignScore: number; // 0-100, 该人错配严重度
}

export interface CrossRollupUnit {
  businessUnit: string;
  headcount: number;
  avgOkrProgress: number;
  avgKpiScore: number;
  bonusTotal: number;
  bonusCommittedRatio: number; // 0-1
  cellCounts: Partial<Record<NineBoxCell, number>>;
  misalignScore: number; // 0-100, 单元层错配得分
  signalCounts: Partial<Record<MisalignKind, number>>;
}

export interface CrossRollupResult {
  cycleId: string | null;
  cycleName: string | null;
  generatedAt: string;
  overall: {
    headcount: number;
    misalignScore: number; // 0-100, 全公司四维错配得分
    bonusTotal: number;
    bonusCommittedRatio: number;
    signalCounts: Partial<Record<MisalignKind, number>>;
  };
  units: CrossRollupUnit[];
  topRisks: CrossRollupPerson[]; // 按 misalignScore 降序
  people: CrossRollupPerson[];
}

const SEVERITY_WEIGHT: Record<MisalignSignal['severity'], number> = {
  low: 10,
  medium: 25,
  high: 45,
  urgent: 70,
};

const SIGNAL_LABELS: Record<MisalignKind, string> = {
  burnout_risk: '烧穿风险 (高 KPI 低 TTI)',
  mismatch: '人岗错位 (低 KPI 高 TTI)',
  must_intervene: '紧急干预 (双低)',
  bonus_overpay: '奖金错配 (低产出高奖金)',
  bonus_underpay: '激励不足 (高产出低奖金)',
  bonus_uncommitted: '奖金未 commit',
};

export function misalignKindLabel(kind: MisalignKind): string {
  return SIGNAL_LABELS[kind];
}

/** 从全路径 departmentId 提取事业部 (业务单元) 段 */
function resolveBusinessUnit(departmentId: string | null | undefined): string {
  if (!departmentId) return '未分配';
  const segs = departmentId.split('/').map((s) => s.trim()).filter(Boolean);
  const bu = segs.find((s) => s.includes('事业部') || s.includes('售后'));
  if (bu) return bu;
  return segs.length > 1 ? segs[1] : segs[0] ?? '未分配';
}

function scoreToHundred(raw: number): number {
  return Math.round(Math.min(100, raw));
}

/**
 * 核心: 在「人」上对齐 OKR/KPI/9宫格/奖金, 产出错配信号 + 得分。
 */
export async function computeCrossRollup(
  store: TandemStore,
  tenantId: string,
  okrCycleId: string | null,
): Promise<CrossRollupResult> {
  const { okrCycle, kpiCycleIds } = await resolveCycleScope(store, okrCycleId);

  // ---- OKR / TTI ----
  const allKrs = await store.keyResults.list();
  const krs = okrCycleId
    ? (await store.objectives.list())
        .filter((o) => o.cycleId === okrCycleId)
        .map((o) => o.id)
        .reduce((acc: typeof allKrs, oid) => acc.concat(allKrs.filter((k) => k.objectiveId === oid)), [])
    : allKrs;

  // ---- KPI (bonus scope) ----
  const allKpis = (await store.kpis.list()).filter(
    (k) => k.tenantId === tenantId && (!kpiCycleIds || kpiCycleIds.has(k.cycleId)),
  );
  const bonusKpisByAssignee = new Map<string, typeof allKpis>();
  for (const k of allKpis) {
    if (k.scope !== 'bonus') continue;
    const arr = bonusKpisByAssignee.get(k.assigneeId) ?? [];
    arr.push(k);
    bonusKpisByAssignee.set(k.assigneeId, arr);
  }

  // ---- 360 ----
  const r360CycleIds = (await resolveCycleScope(store, okrCycleId)).review360CycleIds;
  const allSubmissions = (await store.review360Submissions.list()).filter(
    (s) => !r360CycleIds || r360CycleIds.has(s.cycleId),
  );
  const reviewByUser = new Map<string, number[]>();
  for (const sub of allSubmissions) {
    if (sub.overallScore == null) continue;
    const arr = reviewByUser.get(sub.subjectId) ?? [];
    arr.push(sub.overallScore);
    reviewByUser.set(sub.subjectId, arr);
  }

  // ---- 奖金 ----
  const payouts = (await store.kpiBonusPayouts.list()).filter((p) => p.tenantId === tenantId);
  const payoutByAssignee = new Map<string, KpiBonusPayout>();
  for (const p of payouts) {
    // 同一人取最新一条
    const prev = payoutByAssignee.get(p.assigneeId);
    if (!prev || p.calculatedAt > prev.calculatedAt) payoutByAssignee.set(p.assigneeId, p);
  }

  // ---- 主体合集 ----
  const owners = new Set<string>();
  krs.forEach((k) => owners.add(k.ownerId));
  Array.from(bonusKpisByAssignee.keys()).forEach((a) => owners.add(a));
  Array.from(reviewByUser.keys()).forEach((s) => owners.add(s));
  Array.from(payoutByAssignee.keys()).forEach((a) => owners.add(a));

  const people: CrossRollupPerson[] = [];

  for (const userId of Array.from(owners)) {
    const ownKrs = krs.filter((k) => k.ownerId === userId);
    const okrProgress =
      ownKrs.length === 0
        ? null
        : ownKrs.reduce((sum, k) => {
            if (k.targetValue === k.startValue) return sum + 1;
            const r = (k.currentValue - k.startValue) / (k.targetValue - k.startValue);
            return sum + Math.max(0, Math.min(1, r));
          }, 0) / ownKrs.length;

    const myReviews = reviewByUser.get(userId) ?? [];
    const review360 =
      myReviews.length === 0
        ? null
        : Math.max(0, Math.min(1, (myReviews.reduce((s, n) => s + n, 0) / myReviews.length - 1) / 4));

    let ttiScore = 0;
    if (okrProgress != null && review360 != null) ttiScore = (okrProgress + review360) / 2;
    else if (okrProgress != null) ttiScore = okrProgress;
    else if (review360 != null) ttiScore = review360;

    const myBonusKpis = bonusKpisByAssignee.get(userId) ?? [];
    let kpiScore = 0;
    if (myBonusKpis.length > 0) {
      const totalW = myBonusKpis.reduce((s, k) => s + k.weight, 0);
      if (totalW > 0) {
        const sum = myBonusKpis.reduce((s, k) => s + k.weight * computeKpiCompletion(k), 0);
        kpiScore = Math.min(1, sum / totalW);
      }
    }

    const cell = classifyNineBox(kpiScore, ttiScore);

    const payout = payoutByAssignee.get(userId) ?? null;
    const bonus = payout
      ? {
          finalBonus: payout.finalBonus,
          baseBonus: payout.baseBonus,
          weightedCompletion: payout.weightedCompletion,
          committed: payout.committed,
        }
      : null;

    // ---- 错配信号 ----
    const signals: MisalignSignal[] = [];
    if (cell === 'risk_burnout')
      signals.push({ kind: 'burnout_risk', severity: 'urgent', detail: `KPI ${(kpiScore * 100).toFixed(0)}% 高 / TTI ${(ttiScore * 100).toFixed(0)}% 低` });
    if (cell === 'mismatch')
      signals.push({ kind: 'mismatch', severity: 'high', detail: `KPI ${(kpiScore * 100).toFixed(0)}% 低 / TTI ${(ttiScore * 100).toFixed(0)}% 高` });
    if (cell === 'must_intervene')
      signals.push({ kind: 'must_intervene', severity: 'urgent', detail: `双低 KPI ${(kpiScore * 100).toFixed(0)}% / TTI ${(ttiScore * 100).toFixed(0)}%` });

    if (bonus) {
      if (bonus.finalBonus > 0 && bonus.weightedCompletion < 0.7)
        signals.push({ kind: 'bonus_overpay', severity: 'high', detail: `加权完成率 ${(bonus.weightedCompletion * 100).toFixed(0)}% 却实发 ${Math.round(bonus.finalBonus).toLocaleString()} 元` });
      if (bonus.weightedCompletion >= 1.0 && bonus.baseBonus > 0 && bonus.finalBonus / bonus.baseBonus < 1.0)
        signals.push({ kind: 'bonus_underpay', severity: 'medium', detail: `完成率 ${(bonus.weightedCompletion * 100).toFixed(0)}% 但实发未超基数` });
      if (!bonus.committed && (cell === 'star' || cell === 'high_performer'))
        signals.push({ kind: 'bonus_uncommitted', severity: 'high', detail: `${cell} 奖金仍为草稿未下发 (保留风险)` });
      else if (!bonus.committed && bonus.finalBonus > 0)
        signals.push({ kind: 'bonus_uncommitted', severity: 'low', detail: `奖金草稿 ${Math.round(bonus.finalBonus).toLocaleString()} 元未 commit` });
    }

    const misalignScore = scoreToHundred(
      signals.reduce((s, sig) => s + SEVERITY_WEIGHT[sig.severity], 0),
    );

    let name = userId;
    let departmentId: string | null = null;
    try {
      const user = await store.auth.users.findById(userId);
      if (user?.name) name = user.name;
      departmentId = (user as { departmentId?: string } | null)?.departmentId ?? null;
    } catch {
      /* noop */
    }

    people.push({
      userId,
      name,
      businessUnit: resolveBusinessUnit(departmentId),
      departmentId,
      okrProgress,
      ttiScore,
      kpiScore,
      cell,
      bonus,
      signals,
      misalignScore,
    });
  }

  // ---- 单元聚合 ----
  const unitMap = new Map<string, CrossRollupPerson[]>();
  for (const p of people) {
    const arr = unitMap.get(p.businessUnit) ?? [];
    arr.push(p);
    unitMap.set(p.businessUnit, arr);
  }

  const units: CrossRollupUnit[] = Array.from(unitMap.entries()).map(([businessUnit, members]) => {
    const headcount = members.length;
    const withOkr = members.filter((m) => m.okrProgress != null);
    const avgOkrProgress = withOkr.length ? withOkr.reduce((s, m) => s + (m.okrProgress ?? 0), 0) / withOkr.length : 0;
    const avgKpiScore = headcount ? members.reduce((s, m) => s + m.kpiScore, 0) / headcount : 0;
    const withBonus = members.filter((m) => m.bonus);
    const bonusTotal = withBonus.reduce((s, m) => s + (m.bonus?.finalBonus ?? 0), 0);
    const bonusCommittedRatio = withBonus.length
      ? withBonus.filter((m) => m.bonus?.committed).length / withBonus.length
      : 0;
    const cellCounts: Partial<Record<NineBoxCell, number>> = {};
    const signalCounts: Partial<Record<MisalignKind, number>> = {};
    for (const m of members) {
      cellCounts[m.cell] = (cellCounts[m.cell] ?? 0) + 1;
      for (const sig of m.signals) signalCounts[sig.kind] = (signalCounts[sig.kind] ?? 0) + 1;
    }
    const misalignScore = headcount
      ? scoreToHundred(members.reduce((s, m) => s + m.misalignScore, 0) / headcount)
      : 0;
    return { businessUnit, headcount, avgOkrProgress, avgKpiScore, bonusTotal, bonusCommittedRatio, cellCounts, misalignScore, signalCounts };
  });
  units.sort((a, b) => b.misalignScore - a.misalignScore);

  const overallSignalCounts: Partial<Record<MisalignKind, number>> = {};
  for (const p of people) for (const sig of p.signals) overallSignalCounts[sig.kind] = (overallSignalCounts[sig.kind] ?? 0) + 1;
  const allBonus = people.filter((p) => p.bonus);
  const overall = {
    headcount: people.length,
    misalignScore: people.length ? scoreToHundred(people.reduce((s, p) => s + p.misalignScore, 0) / people.length) : 0,
    bonusTotal: allBonus.reduce((s, p) => s + (p.bonus?.finalBonus ?? 0), 0),
    bonusCommittedRatio: allBonus.length ? allBonus.filter((p) => p.bonus?.committed).length / allBonus.length : 0,
    signalCounts: overallSignalCounts,
  };

  const topRisks = people
    .filter((p) => p.misalignScore > 0)
    .sort((a, b) => b.misalignScore - a.misalignScore)
    .slice(0, 15);

  return {
    cycleId: okrCycleId,
    cycleName: okrCycle?.name ?? null,
    generatedAt: new Date().toISOString(),
    overall,
    units,
    topRisks,
    people,
  };
}
