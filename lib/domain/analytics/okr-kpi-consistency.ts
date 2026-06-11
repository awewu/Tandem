/**
 * OKR-KPI 一致性校验 (机会#2) · 解决"目标与底线两张皮"
 *
 * 现状: Objective/KR 与 KPI 各自独立, KR 设计常偏过程性, 不锚定营收硬底线,
 * 导致"个人营收 KPI 红, 事业部 OKR 却 on-track"的错配。
 *
 * 本模块基于既有的 FP&A 数据契约桥 (KeyResult.targetKpiId / expectedKpiDelta,
 * 见 lib/types/okr-tti.ts §FP&A) 做**只读**一致性体检, 不强改创建流程:
 *   - 每个 Objective 是否有至少一个 KR 锚定到「营收类 (financial) KPI」(营收硬锚)
 *   - KR 锚定覆盖率 (有多少 KR 通过 targetKpiId 挂到了真实 KPI)
 *   - 悬空锚 (targetKpiId 指向不存在的 KPI)
 *
 * 输出供 /api/analytics/okr-kpi-consistency 与一致性仪表板消费。
 */

import type { TandemStore } from '@/lib/storage/repository';
import type { Objective, KeyResult } from '@/lib/types/okr-tti';
import type { Kpi } from '@/lib/types/kpi';
import { resolveCycleScope } from '@/lib/domain/cycle/performance-cycle';

export type ConsistencyStatus =
  | 'ok' // 有营收锚 + 全部 KR 已锚定
  | 'no_revenue_anchor' // 有锚定但无 financial KPI 锚
  | 'partially_anchored' // 部分 KR 锚定
  | 'unanchored' // 无任何 KR 锚定到 KPI
  | 'orphan_link'; // 存在悬空锚 (targetKpiId 无效)

export interface ObjectiveConsistency {
  objectiveId: string;
  title: string;
  level: Objective['level'];
  ownerId: string;
  krCount: number;
  anchoredKrCount: number;
  revenueAnchorCount: number;
  orphanLinkCount: number;
  status: ConsistencyStatus;
}

export interface OkrKpiConsistencyResult {
  cycleId: string | null;
  cycleName: string | null;
  generatedAt: string;
  summary: {
    objectiveCount: number;
    withRevenueAnchor: number;
    revenueAnchorRate: number; // 0-1
    fullyAnchored: number;
    anchorCoverage: number; // 0-1, 全部 KR 中锚定比例
    orphanLinks: number;
    consistencyScore: number; // 0-100, 越高越一致
  };
  /** 不一致的 Objective (status !== 'ok'), 按严重度排序 */
  issues: ObjectiveConsistency[];
  objectives: ObjectiveConsistency[];
}

/** 是否营收/财务类 KPI (营收硬锚判定) */
function isRevenueKpi(kpi: Kpi): boolean {
  return kpi.bscPerspective === 'financial';
}

const STATUS_SEVERITY: Record<ConsistencyStatus, number> = {
  orphan_link: 4,
  unanchored: 3,
  no_revenue_anchor: 2,
  partially_anchored: 1,
  ok: 0,
};

export async function computeOkrKpiConsistency(
  store: TandemStore,
  tenantId: string,
  okrCycleId: string | null,
): Promise<OkrKpiConsistencyResult> {
  const { okrCycle, kpiCycleIds } = await resolveCycleScope(store, okrCycleId);

  const objectives = (await store.objectives.list()).filter(
    (o) => (o.tenantId ?? 'default') === tenantId && (!okrCycleId || o.cycleId === okrCycleId),
  );
  const allKrs = await store.keyResults.list();
  const krsByObjective = new Map<string, KeyResult[]>();
  for (const kr of allKrs) {
    const arr = krsByObjective.get(kr.objectiveId) ?? [];
    arr.push(kr);
    krsByObjective.set(kr.objectiveId, arr);
  }

  const kpis = (await store.kpis.list()).filter(
    (k) => k.tenantId === tenantId && (!kpiCycleIds || kpiCycleIds.has(k.cycleId)),
  );
  const kpiById = new Map(kpis.map((k) => [k.id, k]));

  const rows: ObjectiveConsistency[] = objectives.map((o) => {
    const krs = krsByObjective.get(o.id) ?? [];
    let anchoredKrCount = 0;
    let revenueAnchorCount = 0;
    let orphanLinkCount = 0;
    for (const kr of krs) {
      if (!kr.targetKpiId) continue;
      const kpi = kpiById.get(kr.targetKpiId);
      if (!kpi) {
        orphanLinkCount += 1;
        continue;
      }
      anchoredKrCount += 1;
      if (isRevenueKpi(kpi)) revenueAnchorCount += 1;
    }

    let status: ConsistencyStatus;
    if (orphanLinkCount > 0) status = 'orphan_link';
    else if (krs.length === 0 || anchoredKrCount === 0) status = 'unanchored';
    else if (revenueAnchorCount === 0) status = 'no_revenue_anchor';
    else if (anchoredKrCount < krs.length) status = 'partially_anchored';
    else status = 'ok';

    return {
      objectiveId: o.id,
      title: o.title,
      level: o.level,
      ownerId: o.ownerId,
      krCount: krs.length,
      anchoredKrCount,
      revenueAnchorCount,
      orphanLinkCount,
      status,
    };
  });

  const objectiveCount = rows.length;
  const withRevenueAnchor = rows.filter((r) => r.revenueAnchorCount > 0).length;
  const fullyAnchored = rows.filter((r) => r.krCount > 0 && r.anchoredKrCount === r.krCount).length;
  const totalKrs = rows.reduce((s, r) => s + r.krCount, 0);
  const totalAnchored = rows.reduce((s, r) => s + r.anchoredKrCount, 0);
  const orphanLinks = rows.reduce((s, r) => s + r.orphanLinkCount, 0);
  const revenueAnchorRate = objectiveCount ? withRevenueAnchor / objectiveCount : 0;
  const anchorCoverage = totalKrs ? totalAnchored / totalKrs : 0;

  // 一致性得分: 营收锚率 60% + 锚定覆盖率 40%, 悬空锚每个扣 5 分
  const consistencyScore = Math.max(
    0,
    Math.round((revenueAnchorRate * 60 + anchorCoverage * 40) - orphanLinks * 5),
  );

  const issues = rows
    .filter((r) => r.status !== 'ok')
    .sort((a, b) => STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status]);

  return {
    cycleId: okrCycleId,
    cycleName: okrCycle?.name ?? null,
    generatedAt: new Date().toISOString(),
    summary: {
      objectiveCount,
      withRevenueAnchor,
      revenueAnchorRate,
      fullyAnchored,
      anchorCoverage,
      orphanLinks,
      consistencyScore,
    },
    issues,
    objectives: rows,
  };
}
