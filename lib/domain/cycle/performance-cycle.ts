/**
 * PerformanceCycle 解析器 · 统一三套并行周期实体的对齐逻辑
 *
 * 背景 (P1#4): 全公司「绩效周期」此前由三个互相独立的实体表达 ——
 *   - OKR `Cycle`        (store.cycles, KvStore)        ← 主实体 / 标准来源
 *   - `KpiCycle`         (store.kpiCycles, 强类型表)     ← KPI 子系统投影
 *   - `Review360Cycle`   (store.review360Cycles, KvStore)← 360 子系统投影
 *
 * 它们曾靠「id 偶然相等」对齐 (nine-box 旧注释断言"同一 ID 空间", 实则无任何约束),
 * 一旦某子系统独立生成 id, 跨子系统按周期筛选就会把某条轴静默清零 (P0#1)。
 *
 * 现在: OKR Cycle 作为主实体显式持有 `kpiCycleId` / `review360CycleId` 链接。
 * 所有「给定 OKR 周期 → 找它在 KPI/360 子系统的对应周期」的需求, 一律走本解析器:
 *   1. 显式链接 (推荐, 由创建/补种流程回填)
 *   2. id 相等   (历史约定回退)
 *   3. 起止日期区间重叠 (无链接的历史数据兜底)
 *
 * 这样彻底消除「靠 id 巧合对齐」这一类脆弱性, 而无需破坏式合表 / DB 迁移
 * (OKR Cycle 与 Review360Cycle 都是 KvStore JSON, 新增链接字段零迁移)。
 */

import type { TandemStore } from '@/lib/storage/repository';
import type { Cycle } from '@/lib/types/okr-tti';

type Dated = { id: string; startDate?: string; endDate?: string };

/** 两个 [start,end] 区间是否重叠 (任一端缺失 → 不重叠) */
function rangesOverlap(aS?: string, aE?: string, bS?: string, bE?: string): boolean {
  if (!aS || !aE || !bS || !bE) return false;
  return (
    new Date(aS).getTime() <= new Date(bE).getTime() &&
    new Date(bS).getTime() <= new Date(aE).getTime()
  );
}

/**
 * 三级回退解析: 显式链接 → id 相等 → 日期重叠。
 * 返回属于该 OKR 周期的子系统周期 id 集合 (可能 0/1/多个)。
 */
function resolveOne(
  explicitLink: string | undefined,
  candidates: Dated[],
  okrCycleId: string,
  okr: Cycle | null,
): Set<string> {
  if (explicitLink) return new Set([explicitLink]);
  const byId = candidates.filter((c) => c.id === okrCycleId);
  if (byId.length > 0) return new Set(byId.map((c) => c.id));
  if (okr) {
    const byDate = candidates.filter((c) =>
      rangesOverlap(c.startDate, c.endDate, okr.startDate, okr.endDate),
    );
    return new Set(byDate.map((c) => c.id));
  }
  return new Set();
}

export interface CycleScope {
  /** 选定的 OKR 主周期 (null = 未指定/未找到) */
  okrCycle: Cycle | null;
  /** 关联 KPI 周期 id 集合; null = 不按周期过滤 (全部) */
  kpiCycleIds: Set<string> | null;
  /** 关联 360 周期 id 集合; null = 不按周期过滤 (全部) */
  review360CycleIds: Set<string> | null;
}

/**
 * 给定 OKR 周期 id, 解析出它在 KPI / 360 子系统对应的周期 id 集合。
 * okrCycleId 为空 → 各集合返回 null (调用方据此表示"不过滤")。
 */
export async function resolveCycleScope(
  store: TandemStore,
  okrCycleId: string | null,
): Promise<CycleScope> {
  if (!okrCycleId) {
    return { okrCycle: null, kpiCycleIds: null, review360CycleIds: null };
  }
  const okrCycle = (await store.cycles.get(okrCycleId)) ?? null;
  const [kpiCycles, r360Cycles] = await Promise.all([
    store.kpiCycles.list(),
    store.review360Cycles.list(),
  ]);
  return {
    okrCycle,
    kpiCycleIds: resolveOne(okrCycle?.kpiCycleId, kpiCycles, okrCycleId, okrCycle),
    review360CycleIds: resolveOne(
      okrCycle?.review360CycleId,
      r360Cycles,
      okrCycleId,
      okrCycle,
    ),
  };
}

/**
 * 反向解析: 给定 KPI/360 子周期 id, 找回它所属的 OKR 主周期。
 * 优先显式链接, 其次 id 相等, 最后日期重叠。
 */
export async function resolveOkrCycle(
  store: TandemStore,
  subCycleId: string,
  kind: 'kpi' | 'review360',
): Promise<Cycle | null> {
  const okrCycles = await store.cycles.list();
  const linkField = kind === 'kpi' ? 'kpiCycleId' : 'review360CycleId';
  const byLink = okrCycles.find((c) => c[linkField] === subCycleId);
  if (byLink) return byLink;
  const byId = okrCycles.find((c) => c.id === subCycleId);
  if (byId) return byId;
  const sub =
    kind === 'kpi'
      ? await store.kpiCycles.get(subCycleId)
      : await store.review360Cycles.get(subCycleId);
  if (!sub) return null;
  return (
    okrCycles.find((c) => rangesOverlap(c.startDate, c.endDate, sub.startDate, sub.endDate)) ??
    null
  );
}
