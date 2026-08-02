/**
 * 职级变更状态机 (PIP 合规链, PRD §6.2) — 纯函数
 *
 *   stable
 *    └(below,达 belowToWatch)→ watch            [知悉]
 *         └(连续达 belowToPip)→ improvement       [书面确认 PIP告知]
 *              ├(meet)→ stable                    [知悉]
 *              └(below 用尽改进期)→ demotion       [书面确认 降职生效]
 *
 * 合规红线: 连续未达只触发 PIP告知 + 改进期, 不直接降薪; 改进期用尽仍未达才降职。
 * 阈值按族可配 (belowToWatch/belowToPip/improvementQuarters)。
 */

export type GradeState = 'stable' | 'watch' | 'improvement' | 'demotion';
export type QuarterOutcome = 'meet' | 'below';
export type RequiredAck = 'PIP告知' | '降职生效' | null;

export interface GradeMachineConfig {
  /** 连续未达触发观察预警 (默认 1) */
  belowToWatch: number;
  /** 连续未达触发 PIP + 改进期 (默认 2) */
  belowToPip: number;
  /** 改进期季度数 (默认 1) */
  improvementQuarters: number;
}

export const DEFAULT_GRADE_CONFIG: GradeMachineConfig = {
  belowToWatch: 1,
  belowToPip: 2,
  improvementQuarters: 1,
};

export interface GradeMachineState {
  state: GradeState;
  consecutiveBelow: number;
  improvementRemaining: number;
  /** 本次转移要求的书面确认 (null = 仅知悉或无) */
  requiredAck: RequiredAck;
}

export function initGradeState(): GradeMachineState {
  return { state: 'stable', consecutiveBelow: 0, improvementRemaining: 0, requiredAck: null };
}

/** 单步转移 */
export function step(
  s: GradeMachineState,
  outcome: QuarterOutcome,
  cfg: GradeMachineConfig = DEFAULT_GRADE_CONFIG,
): GradeMachineState {
  // 达标: 任何状态下回到稳定 (改进期内达标即恢复)
  if (outcome === 'meet') {
    return { state: 'stable', consecutiveBelow: 0, improvementRemaining: 0, requiredAck: null };
  }

  // 未达: 改进期内继续未达 → 用尽即降职
  if (s.state === 'improvement') {
    const remaining = s.improvementRemaining - 1;
    if (remaining <= 0) {
      return { state: 'demotion', consecutiveBelow: s.consecutiveBelow + 1, improvementRemaining: 0, requiredAck: '降职生效' };
    }
    return { state: 'improvement', consecutiveBelow: s.consecutiveBelow + 1, improvementRemaining: remaining, requiredAck: null };
  }

  // 未达: stable / watch / demotion(降职后重新计) 累计连续未达
  const cb = s.consecutiveBelow + 1;
  if (cb >= cfg.belowToPip) {
    return { state: 'improvement', consecutiveBelow: cb, improvementRemaining: cfg.improvementQuarters, requiredAck: 'PIP告知' };
  }
  if (cb >= cfg.belowToWatch) {
    return { state: 'watch', consecutiveBelow: cb, improvementRemaining: 0, requiredAck: null };
  }
  return { state: s.state === 'demotion' ? 'stable' : s.state, consecutiveBelow: cb, improvementRemaining: 0, requiredAck: null };
}

export interface GradeMachineTrace {
  final: GradeMachineState;
  /** 途中产生的所有书面确认 (审计/合规链) */
  acks: { atIndex: number; ack: Exclude<RequiredAck, null> }[];
  history: GradeMachineState[];
}

/** 按季度结果序列跑完整条链, 收集书面确认 (供测试 / 审计) */
export function runSequence(
  outcomes: QuarterOutcome[],
  cfg: GradeMachineConfig = DEFAULT_GRADE_CONFIG,
  initial: GradeMachineState = initGradeState(),
): GradeMachineTrace {
  let cur = initial;
  const history: GradeMachineState[] = [];
  const acks: GradeMachineTrace['acks'] = [];
  outcomes.forEach((o, i) => {
    cur = step(cur, o, cfg);
    history.push(cur);
    if (cur.requiredAck) acks.push({ atIndex: i, ack: cur.requiredAck });
  });
  return { final: cur, acks, history };
}
