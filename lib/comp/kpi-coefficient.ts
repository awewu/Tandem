/**
 * KPI 达成率 → 绩效系数 派生 (PRD §8 结算↔KPI 联动)
 *
 * 纯函数: 从 KPI 完成度计算绩效系数 (0~1.3)。
 * 规则:
 *   - 达成率 < 80% (未达预算线) → 系数 0 (P1 硬截断: 只发基本工资)
 *   - 80% ≤ 达成率 < 100% → 线性插值 0 → 1.0
 *   - 100% ≤ 达成率 < 130% → 线性插值 1.0 → 1.3
 *   - 达成率 ≥ 130% → 1.3 (上界封顶)
 */

export interface KpiAchievementInput {
  /** KPI 当前值 */
  currentValue: number;
  /** KPI 目标值 */
  targetValue: number;
  /** KPI 起始值 (可选, 默认 0) */
  startValue?: number;
  /** 是否正向指标 (越大越好=true, 越小越好=false 如成本/不良率) */
  positive?: boolean;
}

export interface KpiAchievementResult {
  /** 达成率 0~∞ */
  achievementRate: number;
  /** 派生绩效系数 0~1.3 */
  coefficient: number;
  /** 是否被 P1 硬截断 */
  hardCutoff: boolean;
}

/** 单条 KPI 达成率 → 系数 */
export function kpiToCoefficient(input: KpiAchievementInput): KpiAchievementResult {
  const { currentValue, targetValue, startValue = 0, positive = true } = input;

  if (targetValue === 0) {
    return { achievementRate: 1, coefficient: 1, hardCutoff: false };
  }

  const progress = positive
    ? (currentValue - startValue) / (targetValue - startValue)
    : (startValue - currentValue) / (startValue - targetValue);

  const rate = Math.max(0, progress);

  let coefficient: number;
  let hardCutoff = false;

  if (rate < 0.8) {
    coefficient = 0;
    hardCutoff = true;
  } else if (rate < 1.0) {
    coefficient = (rate - 0.8) / 0.2;
  } else if (rate < 1.3) {
    coefficient = 1.0 + (rate - 1.0) / 0.3 * 0.3;
  } else {
    coefficient = 1.3;
  }

  return { achievementRate: rate, coefficient, hardCutoff };
}

export interface AggregatedKpiInput {
  /** 多条 KPI 的达成率 */
  items: KpiAchievementInput[];
  /** 权重 (默认等权) */
  weights?: number[];
}

/** 多条 KPI 加权汇总 → 综合系数 */
export function aggregateKpiToCoefficient(input: AggregatedKpiInput): KpiAchievementResult {
  const { items, weights } = input;
  if (items.length === 0) {
    return { achievementRate: 1, coefficient: 1, hardCutoff: false };
  }

  const w = weights ?? items.map(() => 1);
  const totalWeight = w.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) {
    return { achievementRate: 1, coefficient: 1, hardCutoff: false };
  }

  let weightedRate = 0;
  let anyHardCutoff = false;

  for (let i = 0; i < items.length; i++) {
    const r = kpiToCoefficient(items[i]);
    weightedRate += r.achievementRate * (w[i] ?? 1);
    if (r.hardCutoff) anyHardCutoff = true;
  }

  const avgRate = weightedRate / totalWeight;

  const result = kpiToCoefficient({
    currentValue: avgRate,
    targetValue: 1,
    startValue: 0,
    positive: true,
  });

  return {
    achievementRate: avgRate,
    coefficient: anyHardCutoff ? 0 : result.coefficient,
    hardCutoff: anyHardCutoff,
  };
}
