/**
 * 趋势数据 — 把 CheckIn 历史转成时间序列，用于画进度/信心双线图
 */

import type { CheckIn, Confidence, KeyResult, Objective } from '../store';

export interface TrendPoint {
  /** 时间戳 ms */
  t: number;
  /** 进度 0-100 */
  progress: number;
  /** 信心数值化：on=2 / at-risk=1 / off=0 */
  confidence: number;
  confidenceLabel: Confidence;
}

const CONF_TO_NUM: Record<Confidence, number> = {
  'on-track': 2, 'at-risk': 1, 'off-track': 0,
};

/** Objective 的时间序列：合并 Objective 自身的 check-in + 其下 KR 的最新进度推算 */
export function objectiveTrend(
  obj: Objective,
  krs: KeyResult[],
  checkIns: CheckIn[],
): TrendPoint[] {
  const objKRs = krs.filter((k) => k.objectiveId === obj.id);
  const krIds = new Set(objKRs.map((k) => k.id));

  // 收集本目标相关的所有 check-in
  const relevant = checkIns
    .filter((c) =>
      (c.scope === 'objective' && c.scopeId === obj.id) ||
      (c.scope === 'kr' && krIds.has(c.scopeId))
    )
    .sort((a, b) => a.createdAt - b.createdAt);

  if (relevant.length === 0) return [];

  // 简单策略：用每个 check-in 时刻的 confidence + progress（KR 范围以加权平均替代）
  // 维持一个累积态：每个 KR 的"截至此时"进度
  const krProg: Record<string, number> = {};
  for (const k of objKRs) {
    const span = k.targetValue - k.startValue;
    krProg[k.id] = span === 0 ? 0 : Math.max(0, Math.min(100, ((k.currentValue - k.startValue) / span) * 100));
  }
  // 不知道历史值，先用最新；遇到 KR check-in 则更新
  // 注意：这是简化模型，假设 check-in 之间的进度线性
  const points: TrendPoint[] = [];
  let lastConf: Confidence = obj.confidence;

  for (const c of relevant) {
    if (c.scope === 'kr') {
      krProg[c.scopeId] = c.progressAfter;
    } else {
      // objective 级 check-in 直接覆盖
      // 但需要算"目标自身"进度
    }
    lastConf = c.confidenceAfter;

    let progress: number;
    if (c.scope === 'objective') {
      progress = c.progressAfter;
    } else {
      // 加权 KR 进度
      const w = objKRs.reduce((s, k) => s + (k.weight || 1), 0);
      const wp = objKRs.reduce((s, k) => s + (krProg[k.id] || 0) * (k.weight || 1), 0);
      progress = w === 0 ? 0 : Math.round(wp / w);
    }
    points.push({
      t: c.createdAt,
      progress,
      confidence: CONF_TO_NUM[lastConf],
      confidenceLabel: lastConf,
    });
  }

  return points;
}

/** KR 的时间序列：直接用其 check-in 数据 */
export function krTrend(kr: KeyResult, checkIns: CheckIn[]): TrendPoint[] {
  return checkIns
    .filter((c) => c.scope === 'kr' && c.scopeId === kr.id)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      t: c.createdAt,
      progress: c.progressAfter,
      confidence: CONF_TO_NUM[c.confidenceAfter],
      confidenceLabel: c.confidenceAfter,
    }));
}

// ---------------------------------------------------------------------------
// KR Forecast (vs Tita 2025 H2 #缺口 · 2026-05-30 落)
//
// 基于历史 check-in 趋势线性回归推算季末完成度 + 风险等级.
// 输入: KR + 周期 endDate + check-in 序列
// 输出: { forecastValue, forecastProgress, riskLevel, slope, confidence }
//
// 算法:
//   1. 取该 KR 所有 'kr' scope 的 check-in (≥ 2 条才能回归)
//   2. 对 (t, progressAfter) 做最小二乘线性回归 → slope (pp/天)
//   3. 推到 cycleEndAt → forecastProgress (0-100)
//   4. forecastValue = startValue + (forecastProgress/100) * (targetValue - startValue)
//   5. riskLevel:
//        forecastProgress >= 90 → 'on-track'
//        forecastProgress >= 60 → 'at-risk'
//        else                   → 'off-track'
//   6. confidence = R²(简化为 1 - 残差比), 0-1
// ---------------------------------------------------------------------------

export type ForecastRiskLevel = 'on-track' | 'at-risk' | 'off-track' | 'insufficient-data';

export interface KrForecast {
  /** 是否数据足够 (需 ≥ 2 条 check-in) */
  hasData: boolean;
  /** 推算季末值 (KR 单位, e.g. 1500 万元 / 92%) */
  forecastValue: number;
  /** 推算季末完成度 0-100 */
  forecastProgress: number;
  /** 风险等级 */
  riskLevel: ForecastRiskLevel;
  /** 线性回归斜率 (pp / 天) */
  slope: number;
  /** 拟合置信度 0-1 (1 = 完美线性) */
  confidence: number;
  /** 当前进度 0-100 */
  currentProgress: number;
  /** 距离季末天数 (≤ 0 则已结束) */
  daysToEnd: number;
  /** 距离季末预期完成差距 pp (forecastProgress - 100) */
  gapToTarget: number;
  /** 解释性文本, 用于 UI tooltip */
  reasoning: string;
}

/**
 * 对 KR 做季末预测.
 *
 * @param kr           KeyResult (有 startValue / targetValue / currentValue)
 * @param checkIns     全部 check-in (函数自筛 scope=kr & scopeId)
 * @param cycleEndAt   周期结束时间戳 (ms)
 * @param now          当前时间戳 (默认 Date.now)
 */
export function forecastKr(
  kr: KeyResult,
  checkIns: CheckIn[],
  cycleEndAt: number,
  now: number = Date.now(),
): KrForecast {
  const points = checkIns
    .filter((c) => c.scope === 'kr' && c.scopeId === kr.id)
    .sort((a, b) => a.createdAt - b.createdAt);

  const span = kr.targetValue - kr.startValue;
  const currentProgress =
    span === 0
      ? 0
      : Math.max(0, Math.min(100, ((kr.currentValue - kr.startValue) / span) * 100));
  const daysToEnd = Math.max(0, (cycleEndAt - now) / 86_400_000);

  // 数据不足: ≥ 2 条 check-in 才能回归
  if (points.length < 2) {
    return {
      hasData: false,
      forecastValue: kr.currentValue,
      forecastProgress: currentProgress,
      riskLevel: 'insufficient-data',
      slope: 0,
      confidence: 0,
      currentProgress,
      daysToEnd,
      gapToTarget: currentProgress - 100,
      reasoning: `历史 check-in ${points.length} 条 (< 2), 无法回归. 建议先做 check-in.`,
    };
  }

  // 最小二乘线性回归 — y = a + b*x, x = days from first check-in
  const t0 = points[0].createdAt;
  const xs = points.map((p) => (p.createdAt - t0) / 86_400_000); // 天
  const ys = points.map((p) => p.progressAfter);

  const n = points.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den; // pp / 天
  const intercept = meanY - slope * meanX;

  // 推到周期末: 距离 t0 的天数
  const daysToEndFromT0 = (cycleEndAt - t0) / 86_400_000;
  const forecastProgressRaw = intercept + slope * daysToEndFromT0;
  const forecastProgress = Math.max(0, Math.min(100, forecastProgressRaw));

  const forecastValue = kr.startValue + (forecastProgress / 100) * span;

  // 拟合置信度 (1 - SSres/SStot, 简化版)
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yPred = intercept + slope * xs[i];
    ssRes += (ys[i] - yPred) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  // 风险等级
  let riskLevel: ForecastRiskLevel;
  if (forecastProgress >= 90) riskLevel = 'on-track';
  else if (forecastProgress >= 60) riskLevel = 'at-risk';
  else riskLevel = 'off-track';

  const reasoning = buildForecastReasoning({
    n,
    slope,
    daysToEnd,
    currentProgress,
    forecastProgress,
    riskLevel,
    r2,
  });

  return {
    hasData: true,
    forecastValue: Math.round(forecastValue * 100) / 100,
    forecastProgress: Math.round(forecastProgress * 10) / 10,
    riskLevel,
    slope: Math.round(slope * 1000) / 1000,
    confidence: Math.round(r2 * 100) / 100,
    currentProgress: Math.round(currentProgress * 10) / 10,
    daysToEnd: Math.round(daysToEnd * 10) / 10,
    gapToTarget: Math.round((forecastProgress - 100) * 10) / 10,
    reasoning,
  };
}

function buildForecastReasoning(p: {
  n: number;
  slope: number;
  daysToEnd: number;
  currentProgress: number;
  forecastProgress: number;
  riskLevel: ForecastRiskLevel;
  r2: number;
}): string {
  const parts: string[] = [];
  parts.push(`基于 ${p.n} 条 check-in 线性回归`);
  parts.push(`日均进度变化 ${p.slope >= 0 ? '+' : ''}${p.slope.toFixed(2)} pp/天`);
  parts.push(`距季末 ${p.daysToEnd.toFixed(0)} 天`);
  parts.push(`推算季末进度 ${p.forecastProgress.toFixed(0)}%`);
  if (p.riskLevel === 'on-track') {
    parts.push('✓ 按当前节奏可达成');
  } else if (p.riskLevel === 'at-risk') {
    parts.push(`⚠ 预计差 ${(100 - p.forecastProgress).toFixed(0)}pp, 建议加速 / 降目标`);
  } else if (p.riskLevel === 'off-track') {
    parts.push(`✗ 严重落后, 建议拆解阻碍 / 调整 KR 目标值`);
  }
  if (p.r2 < 0.5) {
    parts.push(`(波动较大, 拟合置信度 ${(p.r2 * 100).toFixed(0)}%, 仅供参考)`);
  }
  return parts.join('; ');
}

/**
 * 批量对一组 KR 预测, 返回按风险排序 (off-track > at-risk > on-track > insufficient).
 * UI 用来一屏看 "本季度哪些 KR 救火".
 */
export function forecastObjective(
  obj: Objective,
  krs: KeyResult[],
  checkIns: CheckIn[],
  cycleEndAt: number,
  now: number = Date.now(),
): Array<{ kr: KeyResult; forecast: KrForecast }> {
  const objKrs = krs.filter((k) => k.objectiveId === obj.id);
  const results = objKrs.map((kr) => ({
    kr,
    forecast: forecastKr(kr, checkIns, cycleEndAt, now),
  }));
  // 排序: off-track 先, 然后 at-risk, on-track, insufficient 最后
  const order: Record<ForecastRiskLevel, number> = {
    'off-track': 0,
    'at-risk': 1,
    'on-track': 2,
    'insufficient-data': 3,
  };
  results.sort((a, b) => order[a.forecast.riskLevel] - order[b.forecast.riskLevel]);
  return results;
}

/** 把序列转成 SVG 折线图坐标 */
export function trendToSVGPath(
  points: TrendPoint[],
  width: number,
  height: number,
  field: 'progress' | 'confidence',
): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const cx = width / 2, cy = height / 2;
    return `M${cx},${cy}`;
  }

  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tRange = Math.max(1, tMax - tMin);

  const yMax = field === 'progress' ? 100 : 2;

  const coords = points.map((p) => {
    const x = ((p.t - tMin) / tRange) * width;
    const y = height - (p[field] / yMax) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return 'M' + coords.join(' L');
}
