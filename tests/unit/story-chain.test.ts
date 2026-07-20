/**
 * tests/unit/story-chain.test.ts · 故事链 provenance 聚合 (Phase 4 · 2026-07-20)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { buildStoryChain, listAnchorKrs } from '@/lib/story-chain/aggregate';

beforeEach(() => setStore(createInMemoryStore()));

async function seedChain() {
  const s = getStore();
  await s.objectives.create({ id: 'o1', title: '提升华东交付', cycleId: 'c1', level: 'team', ownerId: 'u1', tenantId: 'default' } as never);
  await s.keyResults.create({
    id: 'kr1', objectiveId: 'o1', ownerId: 'u1', coOwnerIds: [], title: 'NPS 从 30 到 60',
    measureType: 'numeric', computeMethod: 'latest', startValue: 30, targetValue: 60, currentValue: 45,
    confidence: 'at-risk', riskStatus: 'at_risk', weight: 1, status: 'active', tenantId: 'default',
  } as never);
  await s.initiatives.create({ id: 'i1', keyResultId: 'kr1', ownerId: 'u1', title: '重构客诉响应流程', status: 'in_progress', decisionCardIds: ['d1'], tenantId: 'default' } as never);
  await s.decisionCards.create({
    id: 'd1', title: '客诉 SLA 决议', convergenceState: 'COMMIT', primaryKrId: 'kr1',
    materialRefs: ['mat1'], options: [{ id: 'A', citedMemory: ['mem-cited'] }], tenantId: 'default',
  } as never);
  await s.memories.create({ id: 'mem-cited', type: 'case', title: '历史客诉案例', status: 'active', ownershipLevel: 'company', referenceCount: 0 } as never);
  await s.materials.create({ id: 'mat1', type: 'decision_card', title: 'SLA 会议纪要', originRefs: [], participants: [], createdBy: 'u1' } as never);
  await s.memories.create({ id: 'mem1', type: 'sop', title: '客诉响应 SOP', status: 'active', ownershipLevel: 'company', sourceMaterialId: 'mat1', referenceCount: 3 } as never);
  await s.checkIns.create({ id: 'ci1', scope: 'kr', scopeId: 'kr1', authorId: 'u1', progressBefore: 0.3, progressAfter: 0.5, confidenceBefore: 'at-risk', confidenceAfter: 'at-risk', achievements: '响应时间下降', tenantId: 'default', createdAt: new Date().toISOString() } as never);
  await s.oneOnOneActionItems.create({ id: 'ai1', meetingId: 'm1', text: '推动流程重构', assigneeId: 'u1', linkedInitiativeId: 'i1' } as never);
  await s.oneOnOneMeetings.create({ id: 'm1', title: 'W3 主管 1on1' } as never);
}

describe('buildStoryChain', () => {
  it('组装完整链路: KR → Initiative(源自1on1+决议) → Decision → Material → Memory + CheckIn', async () => {
    await seedChain();
    const chain = await buildStoryChain('kr1', 'default');
    expect(chain).not.toBeNull();
    expect(chain!.anchor.krId).toBe('kr1');
    expect(chain!.anchor.objectiveTitle).toBe('提升华东交付');
    expect(chain!.anchor.progress).toBeCloseTo(0.5, 5); // (45-30)/(60-30)

    // Initiative + 双来源
    expect(chain!.initiatives).toHaveLength(1);
    expect(chain!.initiatives[0].fromActionItem?.id).toBe('ai1');
    expect(chain!.initiatives[0].fromActionItem?.meetingTitle).toBe('W3 主管 1on1');
    expect(chain!.initiatives[0].fromDecisionCardIds).toContain('d1');

    // Decision → Material → Memory
    expect(chain!.decisions).toHaveLength(1);
    expect(chain!.decisions[0].anchoredDirectly).toBe(true);
    expect(chain!.decisions[0].materials).toHaveLength(1);
    expect(chain!.decisions[0].materials[0].memory?.id).toBe('mem1');
    expect(chain!.decisions[0].citedMemory.map((m) => m.id)).toContain('mem-cited');

    // CheckIn
    expect(chain!.checkIns).toHaveLength(1);
    expect(chain!.stats).toMatchObject({ initiativeCount: 1, decisionCount: 1, materialCount: 1, memoryCount: 1, checkInCount: 1 });
  });

  it('租户隔离: 跨租户查询返回 null', async () => {
    await seedChain();
    expect(await buildStoryChain('kr1', 'other-tenant')).toBeNull();
  });

  it('不存在的 KR → null', async () => {
    expect(await buildStoryChain('nope', 'default')).toBeNull();
  });

  it('Material 未晋升为 Memory 时 memory=null', async () => {
    const s = getStore();
    await s.keyResults.create({ id: 'kr2', objectiveId: 'o9', ownerId: 'u1', coOwnerIds: [], title: 'K', measureType: 'numeric', computeMethod: 'latest', startValue: 0, targetValue: 10, currentValue: 0, confidence: 'on-track', riskStatus: 'on_track', weight: 1, status: 'active', tenantId: 'default' } as never);
    await s.decisionCards.create({ id: 'd2', title: 'D', convergenceState: 'COMMIT', primaryKrId: 'kr2', materialRefs: ['mat2'], options: [], tenantId: 'default' } as never);
    await s.materials.create({ id: 'mat2', type: 'meeting_minutes', title: '未沉淀素材', originRefs: [], participants: [], createdBy: 'u1' } as never);
    const chain = await buildStoryChain('kr2', 'default');
    expect(chain!.decisions[0].materials[0].memory).toBeNull();
    expect(chain!.stats.memoryCount).toBe(0);
  });
});

describe('listAnchorKrs', () => {
  it('返回本租户 KR 列表', async () => {
    await seedChain();
    const anchors = await listAnchorKrs('default');
    expect(anchors.map((a) => a.krId)).toContain('kr1');
    expect(anchors.find((a) => a.krId === 'kr1')?.progress).toBeCloseTo(0.5, 5);
  });
});
