/**
 * 季度闸门触发器 (PRD §6.1) — 从 KPI 结果推导季度达成/未达,
 * 驱动 grade-machine 状态机, 生成 Acknowledgement 记录。
 *
 * 纯函数: KPI 达成率 → QuarterOutcome → grade-machine step → 是否需要书面确认。
 */

import { kpiToCoefficient } from './kpi-coefficient';
import { step, type GradeMachineState, type GradeMachineConfig, DEFAULT_GRADE_CONFIG, type RequiredAck } from './grade-machine';

export interface KpiQuarterResult {
  /** KPI 当前值 */
  currentValue: number;
  /** KPI 目标值 */
  targetValue: number;
  /** 起始值 */
  startValue?: number;
  /** 正向指标 */
  positive?: boolean;
}

export interface QuarterGateResult {
  /** 季度结果 */
  outcome: 'meet' | 'below';
  /** 达成率 */
  achievementRate: number;
  /** 状态机转移后的新状态 */
  newState: GradeMachineState;
  /** 是否需要书面确认 */
  requiresAck: boolean;
  /** 确认类型 */
  ackType: RequiredAck;
}

/** 从单条 KPI 推导季度结果并跑状态机一步 */
export function evaluateQuarter(
  kpi: KpiQuarterResult,
  currentState: GradeMachineState,
  cfg: GradeMachineConfig = DEFAULT_GRADE_CONFIG,
): QuarterGateResult {
  const { achievementRate, hardCutoff } = kpiToCoefficient(kpi);
  const outcome = hardCutoff ? 'below' : 'meet';
  const newState = step(currentState, outcome, cfg);

  return {
    outcome,
    achievementRate,
    newState,
    requiresAck: newState.requiredAck !== null,
    ackType: newState.requiredAck,
  };
}

export interface MultiKpiQuarterResult {
  items: KpiQuarterResult[];
  weights?: number[];
}

/** 从多条 KPI 加权汇总后推导季度结果 */
export function evaluateQuarterMulti(
  input: MultiKpiQuarterResult,
  currentState: GradeMachineState,
  cfg: GradeMachineConfig = DEFAULT_GRADE_CONFIG,
): QuarterGateResult {
  const { items, weights } = input;
  if (items.length === 0) {
    const newState = step(currentState, 'meet', cfg);
    return {
      outcome: 'meet',
      achievementRate: 1,
      newState,
      requiresAck: newState.requiredAck !== null,
      ackType: newState.requiredAck,
    };
  }

  const w = weights ?? items.map(() => 1);
  const totalWeight = w.reduce((a, b) => a + b, 0);
  let weightedRate = 0;
  let anyBelow = false;

  for (let i = 0; i < items.length; i++) {
    const r = kpiToCoefficient(items[i]);
    weightedRate += r.achievementRate * (w[i] ?? 1);
    if (r.hardCutoff) anyBelow = true;
  }

  const avgRate = weightedRate / totalWeight;
  const outcome = anyBelow || avgRate < 0.8 ? 'below' : 'meet';
  const newState = step(currentState, outcome, cfg);

  return {
    outcome,
    achievementRate: avgRate,
    newState,
    requiresAck: newState.requiredAck !== null,
    ackType: newState.requiredAck,
  };
}
