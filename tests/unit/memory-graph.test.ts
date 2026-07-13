import { describe, it, expect } from 'vitest';
import { expandNeighbors, findRelatedByEntity } from '@/lib/memory/graph';
import type { MemoryEntry } from '@/lib/types/memory';

function mem(partial: Partial<MemoryEntry> & { id: string }): MemoryEntry {
  return {
    type: 'sop',
    title: partial.id,
    body: '',
    status: 'active',
    signers: [],
    ownershipLevel: 'company',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    referenceCount: 0,
    ...partial,
  } as MemoryEntry;
}

describe('memory graph · expandNeighbors (GraphRAG M1)', () => {
  it('通过共享实体 ID (KR-3) 连接记忆, edgeType=entity', () => {
    const all = [
      mem({ id: 's1', body: '关于 KR-3 的定价策略' }),
      mem({ id: 'n1', body: 'KR-3 的历史案例复盘' }),
      mem({ id: 'x1', body: '无关内容' }),
    ];
    const out = expandNeighbors(['s1'], all);
    expect(out.map((n) => n.memory.id)).toContain('n1');
    expect(out.map((n) => n.memory.id)).not.toContain('x1');
    expect(out.find((n) => n.memory.id === 'n1')?.edgeType).toBe('entity');
  });

  it('通过 supersedes 链连接, 且优先级高于 entity/tag', () => {
    const all = [
      mem({ id: 's1', body: 'KR-3 旧版', supersededBy: 'n1', tags: ['pricing'] }),
      mem({ id: 'n1', body: 'KR-3 新版', tags: ['pricing'] }),
    ];
    const out = expandNeighbors(['s1'], all);
    const n1 = out.find((n) => n.memory.id === 'n1');
    expect(n1?.edgeType).toBe('supersedes');
    expect(n1?.weight).toBe(1.0);
  });

  it('通过共享 tag 连接 (无实体重叠时), edgeType=tag', () => {
    const all = [
      mem({ id: 's1', body: '定价原则', tags: ['pricing'] }),
      mem({ id: 'n1', body: '折扣规范', tags: ['pricing'] }),
    ];
    const out = expandNeighbors(['s1'], all);
    expect(out.find((n) => n.memory.id === 'n1')?.edgeType).toBe('tag');
  });

  it('决策防火墙: 排除个人非审批记忆邻居', () => {
    const all = [
      mem({ id: 's1', body: 'KR-3 公司 SOP' }),
      mem({ id: 'p1', body: 'KR-3 我的个人笔记', ownershipLevel: 'personal', ownerUserId: 'u1' }),
    ];
    const out = expandNeighbors(['s1'], all);
    expect(out.map((n) => n.memory.id)).not.toContain('p1');
  });

  it('排除非 active 记忆邻居', () => {
    const all = [
      mem({ id: 's1', body: 'KR-3 SOP' }),
      mem({ id: 'a1', body: 'KR-3 已弃用', status: 'deprecated' }),
    ];
    const out = expandNeighbors(['s1'], all);
    expect(out.map((n) => n.memory.id)).not.toContain('a1');
  });

  it('co-citation 分组连接, edgeType=cocited', () => {
    const all = [
      mem({ id: 's1', body: '选项 A 依据' }),
      mem({ id: 'n1', body: '选项 A 另一依据' }),
    ];
    const out = expandNeighbors(['s1'], all, { coCitationGroups: [['s1', 'n1']] });
    expect(out.find((n) => n.memory.id === 'n1')?.edgeType).toBe('cocited');
  });

  it('种子不在图中时返回空', () => {
    const all = [mem({ id: 'n1', body: 'KR-3' })];
    expect(expandNeighbors(['nope'], all)).toEqual([]);
  });
});

describe('memory graph · findRelatedByEntity', () => {
  it('按实体 ID 找到组织记忆, 按 referenceCount 降序', () => {
    const all = [
      mem({ id: 'm1', body: 'KR-3 SOP', referenceCount: 2 }),
      mem({ id: 'm2', body: 'KR-3 案例', referenceCount: 5 }),
      mem({ id: 'm3', body: '无关 OBJ-1' }),
    ];
    const out = findRelatedByEntity('KR-3', all);
    expect(out.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('排除个人非审批记忆 (防火墙)', () => {
    const all = [
      mem({ id: 'm1', body: 'KR-3 公司 SOP' }),
      mem({ id: 'p1', body: 'KR-3 个人笔记', ownershipLevel: 'personal', ownerUserId: 'u1' }),
    ];
    const out = findRelatedByEntity('KR-3', all);
    expect(out.map((m) => m.id)).toEqual(['m1']);
  });

  it('空 entityId 返回空', () => {
    expect(findRelatedByEntity('', [mem({ id: 'm1', body: 'KR-3' })])).toEqual([]);
  });
});
