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
