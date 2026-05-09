/**
 * Convergence Room · 议事室 5 步状态机 (宪章 §3 对齐版)
 *
 * 对应 MANIFESTO 第三条 + CONVERGENCE-PRINCIPLE
 *
 * 5 步 (与宪章字面一致):
 *   1. ALIGN     (校准)   2 min  锚定 KR + 同步信息
 *   2. FRAME     (界定)   3 min  问题陈述 + 决策类型识别
 *   3. DIVERGE   (发散)   5 min  AI 给 3+1 选项 + 审议
 *   4. CONVERGE  (收敛)   4 min  选定 + 行动项
 *   5. COMMIT    (落地)   3 min  决议生效 + 进入 24h 否决窗口
 *   ─────────────────────────────────────
 *   单议题硬上限 17 min (任何步骤超时 → ESCALATED)
 *
 * 设计原则:
 *   - 纯 FSM (无 I/O), 易于单元测试
 *   - 每个事件返回新的 state + commands
 *   - 17 min 硬上限自动转 ESCALATED
 *   - 每步软预算超时 → 暴露分歧 + 再 1 轮 (V2)
 */

import type {
  DecisionCard,
  DecisionOption,
  ConvergenceState,
  ActionItem,
  DecisionClass,
} from '../types/decision-card';
import { HARD_TIME_LIMIT_SECONDS } from '../types/decision-card';

// ---------------------------------------------------------------------------
// 5 步骤的状态枚举 (与宪章字面一致)
// ---------------------------------------------------------------------------

export type Step =
  | 'ALIGN'      // 1/5 · 锚定 KR + 同步上下文
  | 'FRAME'      // 2/5 · 问题陈述 + 决策类型识别
  | 'DIVERGE'    // 3/5 · 3+1 选项生成 + 审议
  | 'CONVERGE'   // 4/5 · 选定 + 行动项
  | 'COMMIT'     // 5/5 · 决议生效 + 24h 否决窗口
  | 'ESCALATED'  // 终态: 升级到决策人
  | 'VETOED';    // 终态: 24h 否决期内被撤回

/**
 * 每步软预算 (秒). 总和 = 17min 硬上限.
 * 超过软预算: stall-detector 发 warning. 超过总硬上限: 自动 ESCALATED.
 */
export const STEP_BUDGET_SECONDS: Record<Step, number> = {
  ALIGN: 2 * 60,      // 120
  FRAME: 3 * 60,      // 180
  DIVERGE: 5 * 60,    // 300
  CONVERGE: 4 * 60,   // 240
  COMMIT: 3 * 60,     // 180
  ESCALATED: 0,
  VETOED: 0,
};

/** 5 主步骤的顺序 (用于 UI 步进展示) */
export const MAIN_STEPS: ReadonlyArray<Step> = ['ALIGN', 'FRAME', 'DIVERGE', 'CONVERGE', 'COMMIT'];

export interface ConvergenceRoomState {
  cardId: string;
  step: Step;
  /** 整个会议室开启时间戳 (ms) */
  startedAt: number;
  /** 当前 step 进入时间戳 (ms) - 用于 per-step 软预算检测 */
  stepEnteredAt: number;
  /** 最近一次活动时间戳 (用于卡顿检测) */
  lastActivityAt: number;
  /** 当前已用秒数 (整个 room) */
  elapsedSeconds: number;
  /** 上下文收集结果 (ALIGN 阶段产出) */
  context?: {
    materialRefs: string[];
    relatedKr?: string[];
    relatedTti?: string[];
  };
  /** 问题陈述 (FRAME 阶段产出) */
  frame?: {
    problemStatement: string;
    decisionClass: DecisionClass;
  };
  /** 3+1 选项 (DIVERGE 阶段产出) */
  options?: DecisionOption[];
  /** 选定 (CONVERGE 阶段) */
  selected?: 'A' | 'B' | 'C' | 'D';
  selectedById?: string;
  /** Action items (CONVERGE 阶段) */
  actionItems: ActionItem[];
  /** 是否已升级 */
  escalated: boolean;
  escalationReason?: string;
}

// ---------------------------------------------------------------------------
// 事件 (Event)
// ---------------------------------------------------------------------------

export type ConvergenceEvent =
  | { type: 'START'; cardId: string; userId: string; at: number }
  /** ALIGN → FRAME · 锚定 KR + 拉取材料完成 */
  | {
      type: 'ALIGN_DONE';
      materialRefs: string[];
      relatedKr?: string[];
      relatedTti?: string[];
      at: number;
    }
  /** FRAME → DIVERGE · 问题陈述 + 决策类型确定 */
  | {
      type: 'FRAMED';
      problemStatement: string;
      decisionClass: DecisionClass;
      at: number;
    }
  /** DIVERGE 内部事件: 3+1 选项就绪 (由 LLM 异步生成) */
  | { type: 'OPTIONS_GENERATED'; options: DecisionOption[]; at: number }
  /** DIVERGE 内部事件: 审议讨论 (不切状态, 仅记录活动) */
  | { type: 'DELIBERATION_INPUT'; userId: string; comment: string; at: number }
  /** DIVERGE → CONVERGE · 选定 */
  | {
      type: 'PICK_OPTION';
      userId: string;
      option: 'A' | 'B' | 'C' | 'D';
      at: number;
    }
  /** CONVERGE 内部事件: 行动项录入 */
  | { type: 'ACTIONS_DEFINED'; actions: ActionItem[]; at: number }
  /** CONVERGE → COMMIT · 决议生效 */
  | { type: 'COMMIT'; userId: string; at: number }
  | { type: 'TICK'; at: number }
  | { type: 'ESCALATE'; reason: string; at: number }
  | { type: 'VETO'; userId: string; reason: string; at: number };

// 兼容别名 (废弃, 仅供过渡): CONTEXT_LOADED 等价于 ALIGN_DONE.
// V2 移除. 不在 ConvergenceEvent union, 上层不要用.

// ---------------------------------------------------------------------------
// 副作用 (Command - 状态机产出, 调用方负责执行)
// ---------------------------------------------------------------------------

export type Command =
  | { type: 'GATHER_CONTEXT'; cardId: string }
  | { type: 'FRAME_PROBLEM'; cardId: string; context: NonNullable<ConvergenceRoomState['context']> }
  | { type: 'GENERATE_OPTIONS'; cardId: string; context: NonNullable<ConvergenceRoomState['context']>; frame: NonNullable<ConvergenceRoomState['frame']> }
  | { type: 'NOTIFY_PARTICIPANTS'; cardId: string; message: string }
  | { type: 'PERSIST_STATE'; state: ConvergenceRoomState }
  | { type: 'EMIT_DECISION_CARD'; cardId: string; partial: Partial<DecisionCard> }
  | { type: 'TRIGGER_ESCALATION'; cardId: string; reason: string }
  | { type: 'START_VETO_WINDOW'; cardId: string; expiresAt: number };

export interface StepResult {
  state: ConvergenceRoomState;
  commands: Command[];
  /** 业务事件 (供 UI / 日志订阅) */
  events: string[];
}

// ---------------------------------------------------------------------------
// 主 reducer
// ---------------------------------------------------------------------------

export function transition(
  state: ConvergenceRoomState,
  event: ConvergenceEvent
): StepResult {
  const elapsed = Math.floor((event.at - state.startedAt) / 1000);
  const next: ConvergenceRoomState = {
    ...state,
    elapsedSeconds: elapsed,
    lastActivityAt: event.at,
  };

  // 全局硬上限校验 (任何状态超 17min 直接 ESCALATED, COMMIT/终态除外)
  if (
    elapsed >= HARD_TIME_LIMIT_SECONDS &&
    state.step !== 'COMMIT' &&
    state.step !== 'ESCALATED' &&
    state.step !== 'VETOED'
  ) {
    return {
      state: { ...next, step: 'ESCALATED', escalated: true, escalationReason: 'hard_time_limit' },
      commands: [
        { type: 'TRIGGER_ESCALATION', cardId: state.cardId, reason: 'hard_time_limit' },
        { type: 'PERSIST_STATE', state: next },
      ],
      events: ['escalated:hard_time_limit'],
    };
  }

  switch (event.type) {
    case 'START': {
      // 通常初始化已在外部完成, 此处仅 idempotent 切到 ALIGN
      return {
        state: { ...next, step: 'ALIGN', stepEnteredAt: event.at },
        commands: [{ type: 'GATHER_CONTEXT', cardId: state.cardId }],
        events: ['step:align'],
      };
    }

    case 'ALIGN_DONE': {
      if (state.step !== 'ALIGN') return noOp(state);
      const ctx = {
        materialRefs: event.materialRefs,
        relatedKr: event.relatedKr,
        relatedTti: event.relatedTti,
      };
      return {
        state: { ...next, step: 'FRAME', stepEnteredAt: event.at, context: ctx },
        commands: [{ type: 'FRAME_PROBLEM', cardId: state.cardId, context: ctx }],
        events: ['step:frame'],
      };
    }

    case 'FRAMED': {
      if (state.step !== 'FRAME') return noOp(state);
      const frame = {
        problemStatement: event.problemStatement,
        decisionClass: event.decisionClass,
      };
      const ctx = next.context ?? { materialRefs: [] };
      return {
        state: { ...next, step: 'DIVERGE', stepEnteredAt: event.at, frame },
        commands: [{ type: 'GENERATE_OPTIONS', cardId: state.cardId, context: ctx, frame }],
        events: ['step:diverge'],
      };
    }

    case 'OPTIONS_GENERATED': {
      // DIVERGE 内部事件: 选项就绪. 不切状态.
      if (state.step !== 'DIVERGE') return noOp(state);
      // 必须含 D 选项 (员工原创, 宪章第二/九条)
      const hasD = event.options.some((o) => o.id === 'D');
      if (!hasD) {
        return {
          state: { ...next, step: 'ESCALATED', escalated: true, escalationReason: 'd_option_missing' },
          commands: [{ type: 'TRIGGER_ESCALATION', cardId: state.cardId, reason: 'd_option_missing' }],
          events: ['error:d_option_missing'],
        };
      }
      return {
        state: { ...next, options: event.options },
        commands: [
          { type: 'NOTIFY_PARTICIPANTS', cardId: state.cardId, message: '3+1 选项已生成, 请审议' },
        ],
        events: ['options:ready'],
      };
    }

    case 'DELIBERATION_INPUT': {
      // 不切状态, 仅记录活动 (DIVERGE 阶段内的审议)
      if (state.step !== 'DIVERGE') return noOp(state);
      return { state: next, commands: [], events: ['deliberation:input'] };
    }

    case 'PICK_OPTION': {
      // DIVERGE → CONVERGE
      if (state.step !== 'DIVERGE') return noOp(state);
      return {
        state: {
          ...next,
          step: 'CONVERGE',
          stepEnteredAt: event.at,
          selected: event.option,
          selectedById: event.userId,
        },
        commands: [],
        events: ['step:converge'],
      };
    }

    case 'ACTIONS_DEFINED': {
      // CONVERGE 内部事件
      if (state.step !== 'CONVERGE') return noOp(state);
      return {
        state: { ...next, actionItems: event.actions },
        commands: [],
        events: ['actions:defined'],
      };
    }

    case 'COMMIT': {
      // CONVERGE → COMMIT
      if (state.step !== 'CONVERGE' || !state.selected) {
        return noOp(state);
      }
      const vetoExpiresAt = event.at + 24 * 60 * 60 * 1000;
      return {
        state: { ...next, step: 'COMMIT', stepEnteredAt: event.at },
        commands: [
          {
            type: 'EMIT_DECISION_CARD',
            cardId: state.cardId,
            partial: {
              convergenceState: 'COMMIT',
              selected: state.selected,
              selectedBy: state.selectedById,
              selectedAt: new Date(event.at).toISOString(),
              actionItems: state.actionItems,
              vetoWindowEnds: new Date(vetoExpiresAt).toISOString(),
            },
          },
          { type: 'START_VETO_WINDOW', cardId: state.cardId, expiresAt: vetoExpiresAt },
          { type: 'PERSIST_STATE', state: next },
        ],
        events: ['step:commit', 'veto_window:opened'],
      };
    }

    case 'TICK': {
      // 仅刷新 elapsed; 卡顿 / 硬上限检测在更高层 + 在本函数顶部
      return { state: next, commands: [], events: [] };
    }

    case 'ESCALATE': {
      return {
        state: { ...next, step: 'ESCALATED', escalated: true, escalationReason: event.reason },
        commands: [
          { type: 'TRIGGER_ESCALATION', cardId: state.cardId, reason: event.reason },
          { type: 'PERSIST_STATE', state: next },
        ],
        events: [`escalated:${event.reason}`],
      };
    }

    case 'VETO': {
      // 仅在 COMMIT 状态下且 24h 内有效 (24h 校验在调用方)
      if (state.step !== 'COMMIT') return noOp(state);
      return {
        state: { ...next, step: 'VETOED' },
        commands: [
          {
            type: 'EMIT_DECISION_CARD',
            cardId: state.cardId,
            partial: { convergenceState: 'VETOED' },
          },
          { type: 'PERSIST_STATE', state: next },
        ],
        events: [`vetoed:${event.reason}`],
      };
    }

    default:
      return noOp(state);
  }
}

function noOp(state: ConvergenceRoomState): StepResult {
  return { state, commands: [], events: [] };
}

// ---------------------------------------------------------------------------
// 工厂函数
// ---------------------------------------------------------------------------

export function createInitialState(cardId: string, startedAt: number): ConvergenceRoomState {
  return {
    cardId,
    step: 'ALIGN',
    startedAt,
    stepEnteredAt: startedAt,
    lastActivityAt: startedAt,
    elapsedSeconds: 0,
    actionItems: [],
    escalated: false,
  };
}

/** 当前 step → DecisionCard.convergenceState 映射 */
export function stepToConvergenceState(step: Step): ConvergenceState {
  switch (step) {
    case 'ALIGN':
    case 'FRAME':
    case 'DIVERGE':
      return 'DIVERGE';
    case 'CONVERGE':
      return 'CONVERGE';
    case 'COMMIT':
      return 'COMMIT';
    case 'ESCALATED':
      return 'ESCALATED';
    case 'VETOED':
      return 'VETOED';
  }
}

/** 是否最终状态 (不再可被外部事件改变) */
export function isFinalStep(step: Step): boolean {
  return step === 'COMMIT' || step === 'ESCALATED' || step === 'VETOED';
}

/** 当前 step 软预算剩余秒数 (负数 = 超预算) */
export function stepBudgetRemainingSeconds(state: ConvergenceRoomState, nowMs: number): number {
  const budget = STEP_BUDGET_SECONDS[state.step];
  if (budget <= 0) return 0;
  const usedInStep = Math.floor((nowMs - state.stepEnteredAt) / 1000);
  return budget - usedInStep;
}

/** 卡顿检测: 任何 step 超 5 分钟无活动 → 升级 */
export const STALL_THRESHOLD_SECONDS = 5 * 60;

export function detectStall(state: ConvergenceRoomState, nowMs: number): boolean {
  if (isFinalStep(state.step)) {
    return false;
  }
  const idleSeconds = Math.floor((nowMs - state.lastActivityAt) / 1000);
  return idleSeconds >= STALL_THRESHOLD_SECONDS;
}
