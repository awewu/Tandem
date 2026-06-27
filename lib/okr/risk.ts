/**
 * lib/okr/risk.ts · 进度基准线客观风险 (挣值法 EVM-lite, 2026-06-25)
 *
 * 借鉴 Tita 项目"风险%"算法本质 (见 docs/COMPETITOR-TITA-2026-06.md §六):
 *   按时间应完成的进度 (基准线) 与实际进度的偏差 = schedule variance。
 *   例: 周期已过 93% 但实际只完成 60% → 落后 33% → 高风险。
 *
 * 与现有信号的关系 (互补, 不替代):
 *   - confidence (on/at-risk/off-track): 人工主观标注 (红黄绿)
 *   - lib/okr/health.ts: Hygiene 结构检查 (无 KR / 权重失衡 / 久未 check-in)
 *   - 本文件: 纯客观的"时间 vs 进度"偏差, 不依赖人工标注
 *
 * 纯函数, 无副作用, 不改 schema。进度计算统一走 lib/okr/progress.ts SSOT。
 */

import type { Cycle, KeyResult, Objective } from '../store';
import { objectiveProgress } from './progress';

export type RiskBand = 'on-track' | 'at-risk' | 'off-track';

export interface ScheduleRisk {
  /** 按时间应完成的进度 0-100 (基准线) */
  expectedProgress: number;
  /** 实际进度 0-100 */
  actualProgress: number;
  /** expectedProgress - actualProgress, 正数=落后, 负数=领先 */
  variance: number;
  /** 风险等级 (基于 variance 阈值) */
  band: RiskBand;
  /** 时间进度 0-1 (已过周期比例) */
  timeElapsedRatio: number;
  daysElapsed: number;
  daysTotal: number;
}

/** variance 阈值: <=10 绿, (10,25] 黄, >25 红 (与 confidence 三档对齐) */
export const RISK_THRESHOLDS = { atRisk: 10, offTrack: 25 } as const;

export function bandForVariance(variance: number): RiskBand {
  if (variance > RISK_THRESHOLDS.offTrack) return 'off-track';
  if (variance > RISK_THRESHOLDS.atRisk) return 'at-risk';
  return 'on-track';
}

/**
 * 核心: 基于时间基准线计算进度风险。
 * @param startDate 周期开始 (ms)
 * @param endDate   周期结束 (ms)
 * @param actualProgress 实际进度 0-100
 * @param now 当前时间 (ms), 默认 Date.now()
 */
export function calcScheduleRisk(opts: {
  startDate: number;
  endDate: number;
  actualProgress: number;
  now?: number;
}): ScheduleRisk {
  const { startDate, endDate, actualProgress } = opts;
  const now = opts.now ?? Date.now();

  const span = endDate - startDate;
  // 时间进度比例, 钳制 [0,1]; span<=0 视为已结束 (基准 100%)
  let timeElapsedRatio: number;
  if (span <= 0) {
    timeElapsedRatio = 1;
  } else {
    timeElapsedRatio = Math.max(0, Math.min(1, (now - startDate) / span));
  }

  const expectedProgress = Math.round(timeElapsedRatio * 100);
  const actual = Math.max(0, Math.min(100, Math.round(actualProgress)));
  const variance = expectedProgress - actual;

  const DAY = 24 * 60 * 60 * 1000;
  const daysTotal = span > 0 ? Math.round(span / DAY) : 0;
  const daysElapsed = Math.max(0, Math.min(daysTotal, Math.round((now - startDate) / DAY)));

  return {
    expectedProgress,
    actualProgress: actual,
    variance,
    // 周期未开始 (timeElapsedRatio=0) 时不该报风险
    band: timeElapsedRatio <= 0 ? 'on-track' : bandForVariance(variance),
    timeElapsedRatio,
    daysElapsed,
    daysTotal,
  };
}

/**
 * 便捷封装: 基于 Objective + 其周期 + KR 计算风险。
 * 进度取 objectiveProgress SSOT (progressOverride > KR 加权)。
 */
export function objectiveScheduleRisk(
  obj: Objective,
  cycle: Cycle | undefined,
  allKrs: KeyResult[],
  now?: number,
): ScheduleRisk | null {
  if (!cycle) return null;
  return calcScheduleRisk({
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    actualProgress: objectiveProgress(obj, allKrs),
    now,
  });
}
