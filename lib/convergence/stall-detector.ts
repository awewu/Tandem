/**
 * Stall Detector · 议事室卡顿检测
 *
 * 触发条件:
 *   - 5 分钟无活动 (单个 step 内)
 *   - 同一 option 反复修改超 3 次
 *   - 选项信心 / 风险评估在多次重生成后仍 < 阈值
 *
 * 触发后动作:
 *   1. UI 显示"卡顿信号"
 *   2. 推送通知给参与者
 *   3. 超 17min 自动 ESCALATE
 */

import type { ConvergenceRoomState } from './state-machine';
import { getEventBus } from '../realtime/event-bus';
import { audit } from '../audit/log';

export interface StallSignal {
  cardId: string;
  type: 'idle' | 'flip_flop' | 'low_confidence' | 'time_limit_warning';
  severity: 'info' | 'warning' | 'critical';
  detail: string;
  suggestedAction: string;
}

const STALL_IDLE_SECONDS = 5 * 60;
const TIME_WARNING_AT = 12 * 60; // 17min - 5min = 12min
const TIME_HARD_LIMIT = 17 * 60;

const flipFlopCount = new Map<string, Map<string, number>>(); // cardId → option → count

export function recordOptionPick(cardId: string, option: string): void {
  let m = flipFlopCount.get(cardId);
  if (!m) {
    m = new Map();
    flipFlopCount.set(cardId, m);
  }
  m.set(option, (m.get(option) ?? 0) + 1);
}

export function detectSignals(state: ConvergenceRoomState, nowMs: number): StallSignal[] {
  const signals: StallSignal[] = [];

  // 1. Idle (5min 无活动)
  const idleSec = Math.floor((nowMs - state.lastActivityAt) / 1000);
  if (idleSec >= STALL_IDLE_SECONDS && !isFinalState(state.step)) {
    signals.push({
      cardId: state.cardId,
      type: 'idle',
      severity: 'warning',
      detail: `${Math.floor(idleSec / 60)} 分钟无活动`,
      suggestedAction: '主持人催促 或 自动选择默认选项 A',
    });
  }

  // 2. Flip-flop
  const m = flipFlopCount.get(state.cardId);
  if (m) {
    Array.from(m.entries()).forEach(([opt, count]) => {
      if (count >= 3) {
        signals.push({
          cardId: state.cardId,
          type: 'flip_flop',
          severity: 'warning',
          detail: `选项 ${opt} 被反复选择 ${count} 次`,
          suggestedAction: '建议升级到主管做最终决定',
        });
      }
    });
  }

  // 3. Time warning
  if (state.elapsedSeconds >= TIME_WARNING_AT && state.elapsedSeconds < TIME_HARD_LIMIT) {
    signals.push({
      cardId: state.cardId,
      type: 'time_limit_warning',
      severity: 'critical',
      detail: `已用 ${Math.floor(state.elapsedSeconds / 60)} 分钟, 剩余不足 5 分钟`,
      suggestedAction: '立即收敛, 或主动 ESCALATE',
    });
  }

  return signals;
}

function isFinalState(step: string): boolean {
  return step === 'COMMIT' || step === 'ESCALATED' || step === 'VETOED';
}

/**
 * 推送 stall 信号 (通过 event bus)
 */
export async function publishSignals(signals: StallSignal[]): Promise<void> {
  const bus = getEventBus();
  for (const sig of signals) {
    bus.publish({
      type: 'convergence.stall',
      channel: `convergence:${sig.cardId}`,
      payload: { ...sig },
    });
    if (sig.severity === 'critical') {
      await audit('convergence.escalate', 'system', {
        targetId: sig.cardId,
        targetType: 'decision_card',
        metadata: { stall_type: sig.type, detail: sig.detail },
      });
    }
  }
}

/**
 * 清理 (议事室结束后)
 */
export function clearStallTracking(cardId: string): void {
  flipFlopCount.delete(cardId);
}
