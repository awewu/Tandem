/**
 * tests/unit/event-bus.test.ts · Domain Event Bus 单测
 *
 * 锁住: 类型化 / 错误隔离 / 去重 / history buffer / 多订阅者
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus, fireEvent } from '@/lib/events/bus';

describe('event-bus · 类型化 Domain Event Bus', () => {
  beforeEach(() => {
    eventBus.__clearHandlers();
    eventBus.__reset();
  });

  it('emit → 订阅者被调用, payload 透传', async () => {
    const seen: Array<{ cardId: string }> = [];
    eventBus.on('convergence.committed', (p) => {
      seen.push({ cardId: p.cardId });
    });

    const r = await eventBus.emit('convergence.committed', {
      cardId: 'c1',
      decidedBy: 'u1',
      okrAnchor: { type: 'kr', id: 'kr-1' },
      timestamp: Date.now(),
    });

    expect(r.delivered).toBe(1);
    expect(r.deduped).toBe(false);
    expect(seen).toEqual([{ cardId: 'c1' }]);
  });

  it('多订阅者全部触发', async () => {
    const a = vi.fn();
    const b = vi.fn();
    eventBus.on('memory.upgraded', a);
    eventBus.on('memory.upgraded', b);

    const r = await eventBus.emit('memory.upgraded', {
      memoryId: 'm1',
      fromLevel: 1,
      toLevel: 2,
      approvedBy: 'u-steward',
      timestamp: Date.now(),
    });

    expect(r.delivered).toBe(2);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('一个订阅者抛错不影响其他订阅者', async () => {
    const ok = vi.fn();
    eventBus.on('persona.stage-upgraded', () => {
      throw new Error('boom');
    });
    eventBus.on('persona.stage-upgraded', ok);

    const r = await eventBus.emit('persona.stage-upgraded', {
      userId: 'u1',
      personaId: 'p1',
      fromStage: 'newborn',
      toStage: 'intern',
      auto: true,
      timestamp: Date.now(),
    });

    expect(r.delivered).toBe(1); // 抛错的不计入 delivered
    expect(ok).toHaveBeenCalledOnce();
  });

  it('异步 handler reject 被隔离, 不传播', async () => {
    const ok = vi.fn();
    eventBus.on('okr.kr-progressed', async () => {
      throw new Error('async boom');
    });
    eventBus.on('okr.kr-progressed', ok);

    await expect(
      eventBus.emit('okr.kr-progressed', {
        krId: 'kr1', from: 0, to: 50, by: 'u1', source: 'check-in', timestamp: Date.now(),
      }),
    ).resolves.toBeDefined();

    expect(ok).toHaveBeenCalledOnce();
  });

  it('同 eventId 在 30s 内不重发 (去重)', async () => {
    const h = vi.fn();
    eventBus.on('convergence.escalated', h);

    const payload = {
      cardId: 'c1', reason: 'time-limit' as const, elapsedSeconds: 1020, timestamp: Date.now(),
    };

    const a = await eventBus.emit('convergence.escalated', payload, 'escalate:c1');
    const b = await eventBus.emit('convergence.escalated', payload, 'escalate:c1');

    expect(a.deduped).toBe(false);
    expect(b.deduped).toBe(true);
    expect(h).toHaveBeenCalledOnce();
  });

  it('unsubscribe 后不再触发', async () => {
    const h = vi.fn();
    const off = eventBus.on('memory.downgrade-proposed', h);
    off();

    await eventBus.emit('memory.downgrade-proposed', {
      memoryId: 'm1', referenceRate: 0.1, timestamp: Date.now(),
    });

    expect(h).not.toHaveBeenCalled();
  });

  it('history buffer 记录 emit 历史 (供集成测试)', async () => {
    eventBus.on('okr.drift-detected', () => {});
    await eventBus.emit('okr.drift-detected', {
      actorId: 'u1', targetId: 't1', targetType: 'im_persona_reply',
      source: 'im_persona_reply', alignmentScore: 0.15, timestamp: Date.now(),
    });

    const recent = eventBus.getRecentHistory(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].eventName).toBe('okr.drift-detected');
  });

  it('subscriberCount 反映真实订阅数', () => {
    expect(eventBus.subscriberCount()).toBe(0);
    eventBus.on('convergence.committed', () => {});
    eventBus.on('memory.upgraded', () => {});
    eventBus.on('memory.upgraded', () => {});
    expect(eventBus.subscriberCount()).toBe(3);
  });

  it('fireEvent fire-and-forget 不抛错', () => {
    eventBus.on('audit.event-emitted', () => {
      throw new Error('boom');
    });
    expect(() =>
      fireEvent('audit.event-emitted', {
        eventName: 'memory.upgraded', eventId: 'x', timestamp: Date.now(),
      }),
    ).not.toThrow();
  });
});
