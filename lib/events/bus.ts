/**
 * lib/events/bus.ts · 类型化 Domain Event Bus (V1)
 *
 * 目的: 让跨域调用从"硬编 await 跨域 service.X()" → 改为"发 event, 各域订阅".
 *
 * V1 范围 (Owner 2026-05-30 立项):
 *   - 进程内 EventEmitter (不引入 Redis Pub/Sub / Kafka)
 *   - 类型化 payload + handler 错误隔离 (一个订阅者炸不影响其他)
 *   - 内置 deduplication (按 eventId, 防 scanner 重复触发)
 *   - 历史 buffer (供集成测试 expect)
 *
 * V2 路线 (不在本次):
 *   - Redis Streams 跨进程 (multi-instance 自用 30 同事够)
 *   - Outbox pattern (commit DB + emit event 原子化)
 *
 * 使用约束 (从今天起的纪律):
 *   - 任何跨域副作用必须经 event bus 触发, 不允许 service A 直接 await service B 的副作用方法
 *   - 单域内同步逻辑可以保持直接调用 (event 只走域边界)
 */

import { logger } from '@/lib/infra/logger';

// ============================================================================
// §A · Event 类型表 (单一权威, 添加事件必须先加这里)
// ============================================================================

/**
 * Domain event 类型定义.
 *
 * 命名规范: `<域>.<动词过去时>` (e.g. `convergence.committed`, `memory.upgraded`)
 *           过去时 = 事件 (Fact, 已发生); 现在时 = 命令 (Command, 不在本表)
 */
export interface DomainEventMap {
  // ── Convergence (议事) ────────────────────────────────────────
  'convergence.committed': {
    cardId: string;
    primaryKrId?: string;
    decidedBy: string;
    okrAnchor: { type: 'kr' | 'objective' | 'none'; id?: string; reason?: string };
    timestamp: number;
  };
  'convergence.escalated': {
    cardId: string;
    reason: 'time-limit' | 'manual' | 'over-quorum';
    elapsedSeconds: number;
    timestamp: number;
  };

  // ── Memory ────────────────────────────────────────────────────
  'memory.upgraded': {
    memoryId: string;
    fromLevel: 1 | 2 | 3;
    toLevel: 2 | 3 | 4;
    approvedBy: string;
    timestamp: number;
  };
  'memory.downgrade-proposed': {
    memoryId: string;
    referenceRate: number;
    timestamp: number;
  };
  'memory.promotion-sla-overdue': {
    promotionId: string;
    level: 1 | 2 | 3;
    overdueHours: number;
    timestamp: number;
  };

  // ── Persona ──────────────────────────────────────────────────
  'persona.stage-upgraded': {
    userId: string;
    personaId: string;
    fromStage: string;
    toStage: string;
    auto: boolean;
    timestamp: number;
  };

  // ── OKR ──────────────────────────────────────────────────────
  'okr.kr-progressed': {
    krId: string;
    from: number;
    to: number;
    by: string;
    source: 'check-in' | 'daily-report' | 'manual' | 'ai-bulk';
    timestamp: number;
  };
  'okr.drift-detected': {
    actorId: string;
    targetId: string;
    targetType: string;
    source: string;
    alignmentScore: number;
    timestamp: number;
  };

  // ── Audit (用于全局可观测) ───────────────────────────────────
  'audit.event-emitted': {
    eventName: keyof DomainEventMap;
    eventId: string;
    timestamp: number;
  };
}

export type DomainEventName = keyof DomainEventMap;
export type DomainEventPayload<K extends DomainEventName> = DomainEventMap[K];

// ============================================================================
// §B · Bus 实现 (单例 + 错误隔离 + 去重 + history buffer)
// ============================================================================

type Handler<K extends DomainEventName> = (payload: DomainEventPayload<K>) => void | Promise<void>;

interface EmittedRecord {
  eventName: DomainEventName;
  eventId: string;
  payload: unknown;
  emittedAt: number;
}

const HISTORY_BUFFER_SIZE = 200;

class DomainEventBus {
  private handlers = new Map<DomainEventName, Set<Handler<DomainEventName>>>();
  private dedupeWindow = new Map<string, number>(); // eventId → emittedAt
  private history: EmittedRecord[] = [];

  /** 订阅事件. 返回 unsubscribe 函数. */
  on<K extends DomainEventName>(name: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as Handler<DomainEventName>);
    return () => set!.delete(handler as Handler<DomainEventName>);
  }

  /**
   * 发出事件.
   *
   * @param eventId 用于去重 (默认: name + payload hash). 30 秒内同 id 不重发.
   *                scanner 应传入幂等 id (例: `escalate:${cardId}:${tickRound}`).
   */
  async emit<K extends DomainEventName>(
    name: K,
    payload: DomainEventPayload<K>,
    eventId?: string,
  ): Promise<{ delivered: number; deduped: boolean }> {
    const id = eventId ?? `${name}:${JSON.stringify(payload).slice(0, 200)}`;
    const now = Date.now();

    // 30s 去重窗口
    const lastEmitted = this.dedupeWindow.get(id);
    if (lastEmitted && now - lastEmitted < 30_000) {
      return { delivered: 0, deduped: true };
    }
    this.dedupeWindow.set(id, now);

    // 清理超过 5min 的去重记录
    if (this.dedupeWindow.size > 1000) {
      const cutoff = now - 5 * 60_000;
      for (const [k, t] of Array.from(this.dedupeWindow.entries())) {
        if (t < cutoff) this.dedupeWindow.delete(k);
      }
    }

    // 写 history buffer
    this.history.push({ eventName: name, eventId: id, payload, emittedAt: now });
    if (this.history.length > HISTORY_BUFFER_SIZE) {
      this.history.shift();
    }

    // 分发 + 错误隔离 (一个订阅者炸不影响其他)
    const set = this.handlers.get(name);
    if (!set || set.size === 0) {
      return { delivered: 0, deduped: false };
    }

    let delivered = 0;
    for (const h of Array.from(set)) {
      try {
        const r = h(payload);
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          await (r as Promise<void>).catch((err) => {
            logger.warn(
              { event: name, eventId: id, err: String(err) },
              '[event-bus] handler async error (isolated)',
            );
          });
        }
        delivered++;
      } catch (err) {
        logger.warn(
          { event: name, eventId: id, err: String(err) },
          '[event-bus] handler sync error (isolated)',
        );
      }
    }

    return { delivered, deduped: false };
  }

  /** 获取最近 N 条事件 (供集成测试 expect). */
  getRecentHistory(limit = 50): EmittedRecord[] {
    return this.history.slice(-limit);
  }

  /** 清空 history + dedupe (仅测试用). */
  __reset(): void {
    this.history = [];
    this.dedupeWindow.clear();
  }

  /** 移除所有订阅 (仅测试用). */
  __clearHandlers(): void {
    this.handlers.clear();
  }

  /** 当前订阅者总数 (供 health endpoint). */
  subscriberCount(): number {
    let n = 0;
    for (const set of Array.from(this.handlers.values())) n += set.size;
    return n;
  }
}

// ============================================================================
// §C · 全局单例 (跨 dev HMR 也只一份)
// ============================================================================

type GlobalWithBus = typeof globalThis & {
  __tandem_event_bus__?: DomainEventBus;
};

const _g = globalThis as GlobalWithBus;

export const eventBus: DomainEventBus =
  _g.__tandem_event_bus__ ?? (_g.__tandem_event_bus__ = new DomainEventBus());

// ============================================================================
// §D · 便利 helper
// ============================================================================

/** 同步 emit 包装. 不等待 handler 完成, 适合 fire-and-forget. */
export function fireEvent<K extends DomainEventName>(
  name: K,
  payload: DomainEventPayload<K>,
  eventId?: string,
): void {
  void eventBus.emit(name, payload, eventId);
}
