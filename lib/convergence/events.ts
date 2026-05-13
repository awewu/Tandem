/**
 * Convergence Event Bus · 议事室状态变更推送
 *
 * 用于 SSE 实时推送: 当 dispatch() 触发状态变更时，
 * 广播到所有订阅的 SSE 连接，前端无需轮询。
 *
 * V1: 内存 EventEmitter (单进程)
 * V2: Redis pub/sub (多实例)
 */

import { EventEmitter } from 'events';
import type { DecisionCard } from '../types';

class ConvergenceBus extends EventEmitter {
  emitCardUpdated(cardId: string, card: DecisionCard): void {
    this.emit('card-updated', cardId, card);
  }
}

export const convergenceBus = new ConvergenceBus();
