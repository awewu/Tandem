/**
 * tests/integration/convergence-event-bus.integration.test.ts
 *
 * 集成测试 (跨域真链路):
 *   议事 dispatch (COMMIT / ESCALATE) → eventBus 广播
 *   外部域 (Material / Memory / Persona) 可订阅而不需 await orchestrator 内部调用
 *
 * 锁住 Owner 2026-05-30 立的纪律:
 *   "任何跨域副作用必须经 event bus 触发, 不允许 service A 直接 await service B 的副作用方法"
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConvergenceOrchestrator } from '@/lib/convergence/orchestrator';
import { eventBus } from '@/lib/events/bus';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import { TandemRouter } from '@/lib/taf/router';
import type { DecisionCard } from '@/lib/types/decision-card';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function seedDecisionCard(id: string, primaryKrId?: string): Promise<DecisionCard> {
  const store = getStore();
  const now = new Date().toISOString();
  const card = (await store.decisionCards.create({
    id,
    schemaVersion: 'tandem.v1',
    title: 'test card',
    decisionClass: 'simple',
    convergenceState: 'CONVERGE',
    primaryKrId,
    relatedKr: [],
    relatedTti: [],
    materialRefs: [],
    actionItems: [],
    options: [],
    elapsedSeconds: 0,
    createdAt: now,
    updatedAt: now,
  } as unknown as Omit<DecisionCard, 'id'> & { id?: string })) as DecisionCard;
  return card;
}

describe('integration · convergence → eventBus 跨域广播', () => {
  beforeEach(async () => {
    eventBus.__clearHandlers();
    eventBus.__reset();
    // 清理 store decisionCards
    const store = getStore();
    for (const c of await store.decisionCards.list()) {
      await store.decisionCards.delete(c.id);
    }
  });

  it('COMMIT 后 eventBus 广播 convergence.committed (cardId + primaryKrId + decidedBy + okrAnchor)', async () => {
    const seen: Array<{
      cardId: string;
      primaryKrId?: string;
      decidedBy: string;
      okrAnchor: { type: string; id?: string };
    }> = [];

    eventBus.on('convergence.committed', (p) => {
      seen.push({
        cardId: p.cardId,
        primaryKrId: p.primaryKrId,
        decidedBy: p.decidedBy,
        okrAnchor: p.okrAnchor,
      });
    });

    await seedDecisionCard('card-1', 'kr-100');
    const router = new TandemRouter();
    const orch = new ConvergenceOrchestrator(router);

    await orch.dispatch('card-1', {
      type: 'COMMIT',
      userId: 'u-ceo',
      at: Date.now(),
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      cardId: 'card-1',
      primaryKrId: 'kr-100',
      decidedBy: 'u-ceo',
      okrAnchor: { type: 'kr', id: 'kr-100' },
    });
  });

  it('ESCALATE (time-limit) 后 eventBus 广播 convergence.escalated', async () => {
    const seen: Array<{ cardId: string; reason: string }> = [];
    eventBus.on('convergence.escalated', (p) => {
      seen.push({ cardId: p.cardId, reason: p.reason });
    });

    await seedDecisionCard('card-2');
    const orch = new ConvergenceOrchestrator(new TandemRouter());

    await orch.dispatch('card-2', {
      type: 'ESCALATE',
      reason: 'hard_time_limit',
      at: Date.now(),
    });

    expect(seen).toEqual([{ cardId: 'card-2', reason: 'time-limit' }]);
  });

  it('订阅者抛错不影响主流程 dispatch 完成 (错误隔离)', async () => {
    eventBus.on('convergence.escalated', () => {
      throw new Error('subscriber boom');
    });

    await seedDecisionCard('card-3', 'kr-200');
    const orch = new ConvergenceOrchestrator(new TandemRouter());

    // 主流程不应该抛错 (event bus 错误隔离)
    await expect(
      orch.dispatch('card-3', { type: 'ESCALATE', reason: 'hard_time_limit', at: Date.now() }),
    ).resolves.toBeDefined();

    // event 已记入 history (说明 bus 真的尝试广播, 而不是没发)
    const recent = eventBus.getRecentHistory();
    expect(
      recent.some(
        (r) =>
          r.eventName === 'convergence.escalated' &&
          (r.payload as { cardId: string }).cardId === 'card-3',
      ),
    ).toBe(true);
  });

  it('同 cardId 重复 dispatch ESCALATE 被去重 (30s 窗口)', async () => {
    const seen: string[] = [];
    eventBus.on('convergence.escalated', (p) => {
      seen.push(p.cardId);
    });

    await seedDecisionCard('card-4');
    const orch = new ConvergenceOrchestrator(new TandemRouter());

    await orch.dispatch('card-4', { type: 'ESCALATE', reason: 'hard_time_limit', at: Date.now() });
    // 第二次相同事件
    await orch.dispatch('card-4', { type: 'ESCALATE', reason: 'hard_time_limit', at: Date.now() });

    // 30s 内同 cardId 去重, 订阅者只见一次
    expect(seen).toEqual(['card-4']);
  });

  it('history buffer 记录所有 emit (供观测)', async () => {
    await seedDecisionCard('card-5', 'kr-300');
    const orch = new ConvergenceOrchestrator(new TandemRouter());

    await orch.dispatch('card-5', { type: 'COMMIT', userId: 'u1', at: Date.now() });

    const recent = eventBus.getRecentHistory();
    const committed = recent.filter((r) => r.eventName === 'convergence.committed');
    expect(committed.length).toBeGreaterThanOrEqual(1);
  });
});
