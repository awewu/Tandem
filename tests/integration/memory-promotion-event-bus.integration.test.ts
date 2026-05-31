/**
 * tests/integration/memory-promotion-event-bus.integration.test.ts
 *
 * 集成测试 (跨域真链路):
 *   Memory promotion 三级签批 SLA → eventBus 广播
 *   - sign 全签批通过 → emit memory.upgraded
 *   - escalateOverduePromotions Lv1→Lv2 → emit memory.promotion-sla-overdue
 *   - escalateOverduePromotions Lv3 逾期 → emit (notifiedGovernance=true)
 *   - proposeDowngrade → emit memory.downgrade-proposed
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { eventBus } from '@/lib/events/bus';
import { proposeDowngrade } from '@/lib/memory/downgrade-flow';
import {
  escalateOverduePromotions,
  proposePromotion,
  sign,
} from '@/lib/memory/promotion-flow';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import type { Steward } from '@/lib/types/memory';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function seedSteward(userId: string): Promise<void> {
  const store = getStore();
  const s: Steward = {
    userId,
    appointedAt: new Date().toISOString(),
    conflictWith: [],
  };
  await store.stewards.set(s);
}

async function seedMaterial(id: string): Promise<void> {
  const store = getStore();
  await store.materials.create({
    id,
    title: 'mat-' + id,
    body: 'demo',
    sourceType: 'manual',
    createdBy: 'u_alice',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

async function reset() {
  const store = getStore();
  for (const p of await store.promotions.list()) await store.promotions.delete(p.id);
  for (const m of await store.materials.list()) await store.materials.delete(m.id);
  for (const m of await store.memories.list()) await store.memories.delete(m.id);
  for (const d of await store.downgrades.list()) await store.downgrades.delete(d.id);
  eventBus.__clearHandlers();
  eventBus.__reset();
}

describe('integration · memory promotion → eventBus 跨域广播', () => {
  beforeEach(async () => {
    await reset();
    await seedSteward('u_steward');
    await seedMaterial('mat_1');
  });

  it('sign 全签批通过 → emit memory.upgraded', async () => {
    const seen: Array<{
      memoryId: string;
      promotionId: string;
      toLevel: string;
      approvedBy: string;
    }> = [];
    eventBus.on('memory.upgraded', (p) => {
      seen.push({
        memoryId: p.memoryId,
        promotionId: p.promotionId,
        toLevel: p.toLevel,
        approvedBy: p.approvedBy,
      });
    });

    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'SOP-1',
      proposedBody: 'demo body',
      proposerId: 'u_alice',
      level: 'team',
    });
    // 让公示期已过
    await getStore().promotions.update(req.id, {
      publicReviewUntil: new Date(Date.now() - 86400_000).toISOString(),
    });

    await sign(req.id, 'u_team_lead', 'team_leader');
    const after = await sign(req.id, 'u_steward', 'steward');
    expect(after.status).toBe('approved');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      promotionId: req.id,
      toLevel: 'team',
      approvedBy: 'u_steward', // 最后签字人
    });
    expect(seen[0].memoryId).toMatch(/.+/);
  });

  it('escalateOverduePromotions Lv1→Lv2 → emit memory.promotion-sla-overdue', async () => {
    const seen: Array<{
      promotionId: string;
      fromLevel: string;
      toLevel: string;
      notifiedGovernance: boolean;
    }> = [];
    eventBus.on('memory.promotion-sla-overdue', (p) => {
      seen.push({
        promotionId: p.promotionId,
        fromLevel: p.fromLevel,
        toLevel: p.toLevel,
        notifiedGovernance: p.notifiedGovernance,
      });
    });

    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: '',
      proposerId: 'u_alice',
      level: 'team',
    });
    // 让 SLA 过期
    await getStore().promotions.update(req.id, {
      slaDeadline: new Date(Date.now() - 86400_000).toISOString(),
    });

    const r = await escalateOverduePromotions();
    expect(r.escalated).toBeGreaterThanOrEqual(1);

    expect(seen).toEqual([
      {
        promotionId: req.id,
        fromLevel: 'team',
        toLevel: 'dept',
        notifiedGovernance: false,
      },
    ]);
  });

  it('escalateOverduePromotions Lv3 逾期 → emit (notifiedGovernance=true)', async () => {
    const seen: Array<{ notifiedGovernance: boolean }> = [];
    eventBus.on('memory.promotion-sla-overdue', (p) => {
      seen.push({ notifiedGovernance: p.notifiedGovernance });
    });

    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'redline',
      proposedTitle: 'R',
      proposedBody: '',
      proposerId: 'u_alice',
      level: 'company',
    });
    await getStore().promotions.update(req.id, {
      slaDeadline: new Date(Date.now() - 86400_000).toISOString(),
    });

    const r = await escalateOverduePromotions();
    expect(r.notifiedGovernance).toBe(1);
    expect(seen).toEqual([{ notifiedGovernance: true }]);
  });

  it('proposeDowngrade → emit memory.downgrade-proposed', async () => {
    const seen: Array<{ memoryId: string; referenceRate: number }> = [];
    eventBus.on('memory.downgrade-proposed', (p) => {
      seen.push({ memoryId: p.memoryId, referenceRate: p.referenceRate });
    });

    // 先造一个 memory
    const store = getStore();
    const mem = await store.memories.create({
      type: 'sop',
      title: 'M-low',
      body: '',
      status: 'active',
      sourceMaterialId: 'mat_1',
      signers: [],
      referenceCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);

    await proposeDowngrade({
      memoryId: mem.id,
      proposedBy: 'ai',
      reason: 'low ref',
      metrics: { referenceCount: 1, averageReferenceCount: 10 },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].memoryId).toBe(mem.id);
    expect(seen[0].referenceRate).toBeCloseTo(0.1, 5);
  });

  it('订阅者抛错不影响主流程 (错误隔离 · 端到端)', async () => {
    eventBus.on('memory.upgraded', () => {
      throw new Error('subscriber boom');
    });

    const req = await proposePromotion({
      materialId: 'mat_1',
      proposedType: 'sop',
      proposedTitle: 'X',
      proposedBody: '',
      proposerId: 'u_alice',
      level: 'team',
    });
    await getStore().promotions.update(req.id, {
      publicReviewUntil: new Date(Date.now() - 86400_000).toISOString(),
    });

    await sign(req.id, 'u_team_lead', 'team_leader');
    // 主流程不应该抛错
    const after = await sign(req.id, 'u_steward', 'steward');
    expect(after.status).toBe('approved');
  });
});
