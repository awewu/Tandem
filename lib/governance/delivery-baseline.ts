/**
 * FP&A · 交付基线推演 (DeliveryBaseline)
 *
 * 三省六部 FP&A 引擎的核心机理 (docs/GOVERNANCE-FPA-ENGINE-2026-06-09.md §3):
 *   抓 OKR live 进度 → 经 KR→KPI 锚定 (targetKpiId + expectedKpiDelta) 投影直接 KPI 末值
 *   → 经 BSC causal 战略地图 (strength) 把改善按比例传导到下游 KPI
 *   → 产出 DeliveryBaseline (纯预测, 永不写真值)。
 *
 * 设计纪律:
 *   - 纯函数, 无副作用, 无 DB/网络/时钟依赖 (generatedAt 由调用方注入)。
 *   - 只产预测, 不写 OKR/KPI 真值 (铁律 §3.1)。
 *   - 单位一致性: causal 传导按"改善比例 × strength"作用到下游自身量纲, 不跨量纲直接加和。
 */

import { BSC_PERSPECTIVE, type BscPerspective } from '@/lib/design-tokens';

// ---------------------------------------------------------------------------
// 输入类型
// ---------------------------------------------------------------------------

/** 一个锚定到某 KPI 的 OKR 驱动 (来自 KeyResult.targetKpiId + expectedKpiDelta) */
export interface OkrDriver {
  krId: string;
  krTitle: string;
  /** KR 当前进度 0-1 (来自 computeKRProgress) */
  progress: number;
  /**
   * KR 100% 完成时预期把目标 KPI 推动的绝对增量 (与 KPI 同量纲, 可正可负)。
   * 例: KR"支付链路重构"对"SLA"的 expectedKpiDelta = +0.3 (pt)。
   */
  expectedKpiDelta: number;
}

/** 一个 BSC KPI 的现状快照 (只读输入) */
export interface KpiSnapshotInput {
  kpiId: string;
  title: string;
  perspective?: BscPerspective;
  startValue: number;
  currentValue: number;
  targetValue: number;
  /** 直接锚定到该 KPI 的 OKR 驱动 (可空) */
  drivers?: OkrDriver[];
}

/** BSC 战略地图因果边 (来自 KpiCausalLink) */
export interface CausalEdgeInput {
  fromKpiId: string;
  toKpiId: string;
  /** 因果置信强度 0-1 */
  strength: number;
  /** 溯源到 KpiCausalLink.id (供差异校准回写定位; 可空) */
  linkId?: string;
}

export interface DeliveryBaselineInput {
  cycleId: string;
  kpis: KpiSnapshotInput[];
  causalEdges?: CausalEdgeInput[];
  /** 调用方注入, 保持纯函数 (默认空串) */
  generatedAt?: string;
}

// ---------------------------------------------------------------------------
// 输出类型
// ---------------------------------------------------------------------------

export type ProjectionConfidence = 'on-track' | 'at-risk' | 'off-track';

export interface ProjectionContribution {
  /** 来源描述 (KR 标题 或 上游 KPI 标题) */
  source: string;
  /** 对该 KPI 投影末值的贡献增量 (同量纲) */
  value: number;
  kind: 'okr' | 'causal';
  /** causal 贡献时溯源到 KpiCausalLink.id (供校准定位; okr 贡献为空) */
  linkId?: string;
}

export interface KpiProjection {
  kpiId: string;
  title: string;
  perspective?: BscPerspective;
  startValue: number;
  currentValue: number;
  targetValue: number;
  /** 仅 OKR 直接驱动产生的投影末值 */
  directProjectedValue: number;
  /** 叠加 causal 上游传导后的最终投影末值 */
  projectedValue: number;
  /** 投影完成率 = (projected - start) / (target - start), clamp [0, 1.5] */
  projectedCompletion: number;
  /** 目标差距 = target - projected (>0 表示还差) */
  gap: number;
  confidence: ProjectionConfidence;
  drivers: OkrDriver[];
  contributions: ProjectionContribution[];
}

export interface DeliveryBaseline {
  readonly kind: 'baseline';
  cycleId: string;
  generatedAt: string;
  projections: KpiProjection[];
}

// ---------------------------------------------------------------------------
// 内部 helper
// ---------------------------------------------------------------------------

/** 完成率: 与 KPI 体系一致 (允许超额至 150%) */
export function projectedCompletionOf(start: number, target: number, projected: number): number {
  const range = target - start;
  if (range === 0) return projected >= target ? 1 : 0;
  const r = (projected - start) / range;
  return Math.max(0, Math.min(1.5, r));
}

/** 完成率 → 信心 (与 kpiCompletionColor green/yellow/red 同阈值) */
export function completionToConfidence(c: number): ProjectionConfidence {
  if (c >= 1.0) return 'on-track';
  if (c >= 0.85) return 'at-risk';
  return 'off-track';
}

/** 改善比例: (projected - current) / (target - current), 用于 causal 传导。clamp [0,1] */
function improvementRatio(current: number, target: number, projected: number): number {
  const room = target - current;
  if (room === 0) return 0;
  const r = (projected - current) / room;
  // 只传导"正向改善" (≤0 不放大下游); 超过 1 截顶 (KR 超额不无限放大传导)
  return Math.max(0, Math.min(1, r));
}

function perspectiveRank(p?: BscPerspective): number {
  // 无维度的排最前 (当纯直接驱动处理, 不参与传导上游)
  return p ? BSC_PERSPECTIVE[p].rank : 0;
}

// ---------------------------------------------------------------------------
// 主推演
// ---------------------------------------------------------------------------

/**
 * 推演交付基线。
 *
 * 步骤:
 *   1. 直接投影: 每个 KPI 末值 = currentValue + Σ(driver.expectedKpiDelta × driver.progress)。
 *      (按"已实现比例"投影: 进度 60% 即认为已兑现 60% 的预期增量)
 *   2. causal 传导: 按 BSC 维度 rank 升序 (growth→process→customer→financial) 单遍传播。
 *      下游投影 += 上游改善比例 × strength × (下游 target - 下游 current)。
 *      —— 用下游自身量纲, 避免跨量纲直接加和。
 *   3. 计算完成率 / 差距 / 信心。
 */
export function projectDeliveryBaseline(input: DeliveryBaselineInput): DeliveryBaseline {
  const { cycleId, kpis, causalEdges = [], generatedAt = '' } = input;

  // ---- 1. 直接投影 ----
  const proj = new Map<string, KpiProjection>();
  for (const k of kpis) {
    const drivers = k.drivers ?? [];
    const contributions: ProjectionContribution[] = [];
    let directDelta = 0;
    for (const d of drivers) {
      const p = Math.max(0, Math.min(1, d.progress));
      const contrib = d.expectedKpiDelta * p;
      directDelta += contrib;
      contributions.push({ source: d.krTitle, value: contrib, kind: 'okr' });
    }
    const directProjectedValue = k.currentValue + directDelta;
    proj.set(k.kpiId, {
      kpiId: k.kpiId,
      title: k.title,
      perspective: k.perspective,
      startValue: k.startValue,
      currentValue: k.currentValue,
      targetValue: k.targetValue,
      directProjectedValue,
      projectedValue: directProjectedValue, // 传导后覆盖
      projectedCompletion: 0,
      gap: 0,
      confidence: 'off-track',
      drivers,
      contributions,
    });
  }

  // ---- 2. causal 传导 (按维度 rank 升序单遍) ----
  // 上游 (growth, rank 1) 先于下游 (financial, rank 4) 计算, 保证传导用的是上游已含直接投影的值。
  const ordered = Array.from(proj.values()).sort(
    (a, b) => perspectiveRank(a.perspective) - perspectiveRank(b.perspective),
  );
  // edge 按 from 维度 rank 升序处理
  const edges = Array.from(causalEdges).sort((a, b) => {
    const fa = proj.get(a.fromKpiId);
    const fb = proj.get(b.fromKpiId);
    return perspectiveRank(fa?.perspective) - perspectiveRank(fb?.perspective);
  });
  // 逐 rank 处理: 先把同 rank 上游的直接投影定型, 再向下游传导
  void ordered; // 排序仅用于文档化意图; 实际传导按 edge 顺序累加到下游 projectedValue
  for (const e of edges) {
    const from = proj.get(e.fromKpiId);
    const to = proj.get(e.toKpiId);
    if (!from || !to) continue;
    const ratio = improvementRatio(from.currentValue, from.targetValue, from.projectedValue);
    const strength = Math.max(0, Math.min(1, e.strength));
    const room = to.targetValue - to.currentValue;
    const propagated = ratio * strength * room;
    if (propagated !== 0) {
      to.projectedValue += propagated;
      to.contributions.push({
        source: from.title,
        value: propagated,
        kind: 'causal',
        linkId: e.linkId,
      });
    }
  }

  // ---- 3. 完成率 / 差距 / 信心 ----
  for (const p of Array.from(proj.values())) {
    p.projectedCompletion = projectedCompletionOf(p.startValue, p.targetValue, p.projectedValue);
    p.gap = p.targetValue - p.projectedValue;
    p.confidence = completionToConfidence(p.projectedCompletion);
  }

  return {
    kind: 'baseline',
    cycleId,
    generatedAt,
    projections: Array.from(proj.values()),
  };
}

// ---------------------------------------------------------------------------
// 差异分析 (闭环 §3: actual vs baseline)
// ---------------------------------------------------------------------------

export interface VarianceRow {
  kpiId: string;
  title: string;
  projectedValue: number;
  actualValue: number;
  /** actual - projected (>0 = 实际优于推演; <0 = 不及推演) */
  variance: number;
  /** |variance| / |target - start| 占比, 用于显著性判断 */
  variancePct: number;
  /** 是否显著 (超过阈值, 触发 causal strength 校正建议) */
  significant: boolean;
}

/**
 * 对比推演基线与真实交付, 算出每个 KPI 的差异。
 * significantThreshold: 相对量程的显著阈值 (默认 10%)。
 */
export function analyzeBaselineVariance(
  baseline: DeliveryBaseline,
  actuals: Record<string, number>,
  significantThreshold = 0.1,
): VarianceRow[] {
  const rows: VarianceRow[] = [];
  for (const p of baseline.projections) {
    const actual = actuals[p.kpiId];
    if (actual == null) continue;
    const variance = actual - p.projectedValue;
    const range = Math.abs(p.targetValue - p.startValue) || 1;
    const variancePct = Math.abs(variance) / range;
    rows.push({
      kpiId: p.kpiId,
      title: p.title,
      projectedValue: p.projectedValue,
      actualValue: actual,
      variance,
      variancePct,
      significant: variancePct >= significantThreshold,
    });
  }
  return rows;
}
