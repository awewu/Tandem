/**
 * tests/unit/event-subscribers.test.ts
 *
 * 锁: registerCrossDomainSubscribers 幂等 + 注册后 emit 触发 logger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { eventBus } from '@/lib/events/bus';
import {
  __isRegistered,
  __resetSubscribers,
  registerCrossDomainSubscribers,
} from '@/lib/events/subscribers';

// Mock logger so we can assert calls without spilling stdout
vi.mock('@/lib/infra/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '@/lib/infra/logger';

beforeEach(() => {
  eventBus.__clearHandlers();
  eventBus.__reset();
  __resetSubscribers();
  vi.clearAllMocks();
});

afterEach(() => {
  eventBus.__clearHandlers();
  __resetSubscribers();
});

describe('event subscribers · 注册中心', () => {
  it('register() 幂等 (重复调用只订一次)', async () => {
    expect(__isRegistered()).toBe(false);
    registerCrossDomainSubscribers();
    expect(__isRegistered()).toBe(true);
    registerCrossDomainSubscribers(); // 再调一次
    registerCrossDomainSubscribers(); // 再调一次

    // emit 一次 → logger 也只调一次 (说明只订了一次, 不是 3 次)
    await eventBus.emit('memory.upgraded', {
      memoryId: 'm1',
      promotionId: 'p1',
      toLevel: 'team',
      approvedBy: 'u1',
      timestamp: Date.now(),
    });

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ memoryId: 'm1', toLevel: 'team' }),
      '[event] memory.upgraded',
    );
    // 一次 emit 一次 [event] log + 1 次 register banner = 2 info 总数
    // (但每事件类型 mock 共享, 看具体 [event] memory.upgraded 调用数)
    const memoryUpgradedCalls = vi
      .mocked(logger.info)
      .mock.calls.filter((c) => c[1] === '[event] memory.upgraded');
    expect(memoryUpgradedCalls).toHaveLength(1);
  });

  it('convergence.committed 触发 logger.info', async () => {
    registerCrossDomainSubscribers();
    await eventBus.emit('convergence.committed', {
      cardId: 'c1',
      decidedBy: 'u1',
      okrAnchor: { type: 'kr', id: 'kr1' },
      timestamp: Date.now(),
    });
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c1', anchorType: 'kr' }),
      '[event] convergence.committed',
    );
  });

  it('convergence.escalated 触发 logger.warn', async () => {
    registerCrossDomainSubscribers();
    await eventBus.emit('convergence.escalated', {
      cardId: 'c2',
      reason: 'time-limit',
      elapsedSeconds: 1020,
      timestamp: Date.now(),
    });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'c2', reason: 'time-limit' }),
      '[event] convergence.escalated',
    );
  });

  it('memory.promotion-sla-overdue 触发 logger.warn (含 governance flag)', async () => {
    registerCrossDomainSubscribers();
    await eventBus.emit('memory.promotion-sla-overdue', {
      promotionId: 'p1',
      fromLevel: 'company',
      toLevel: 'company',
      notifiedGovernance: true,
      timestamp: Date.now(),
    });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ notifiedGovernance: true }),
      '[event] memory.promotion-sla-overdue',
    );
  });

  it('persona.stage-upgraded 触发 logger.info', async () => {
    registerCrossDomainSubscribers();
    await eventBus.emit('persona.stage-upgraded', {
      userId: 'u1',
      personaId: 'p1',
      fromStage: 'newborn',
      toStage: 'apprentice',
      auto: true,
      timestamp: Date.now(),
    });
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ fromStage: 'newborn', toStage: 'apprentice', auto: true }),
      '[event] persona.stage-upgraded',
    );
  });

  it('okr.kr-progressed 触发 logger.info', async () => {
    registerCrossDomainSubscribers();
    await eventBus.emit('okr.kr-progressed', {
      krId: 'kr1',
      from: 30,
      to: 60,
      by: 'u1',
      source: 'check-in',
      timestamp: Date.now(),
    });
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ krId: 'kr1', from: 30, to: 60 }),
      '[event] okr.kr-progressed',
    );
  });
});
