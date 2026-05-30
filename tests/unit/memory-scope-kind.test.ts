/**
 * Memory 4-Scope + Kind 单测 · lib/types/memory.ts
 */
import { describe, it, expect } from 'vitest';
import {
  getMemoryKind,
  filterMemoriesByScope,
  bucketMemoriesByKind,
  type MemoryEntry,
} from '@/lib/types/memory';

function mem(over: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: over.id ?? 'm-' + Math.random().toString(36).slice(2, 6),
    type: 'case',
    title: 't',
    body: 'b',
    status: 'active',
    signers: [],
    ownershipLevel: 'company',
    createdAt: '2026-05-29T00:00:00Z',
    updatedAt: '2026-05-29T00:00:00Z',
    referenceCount: 0,
    ...over,
  };
}

describe('getMemoryKind', () => {
  it('显式 kind 优先', () => {
    expect(getMemoryKind({ kind: 'episodic', type: 'sop' })).toBe('episodic');
    expect(getMemoryKind({ kind: 'procedural', type: 'case' })).toBe('procedural');
  });

  it('按 type 推断: sop/value/redline → procedural', () => {
    expect(getMemoryKind({ type: 'sop' })).toBe('procedural');
    expect(getMemoryKind({ type: 'value' })).toBe('procedural');
    expect(getMemoryKind({ type: 'redline' })).toBe('procedural');
  });

  it('按 type 推断: case/lesson → episodic', () => {
    expect(getMemoryKind({ type: 'case' })).toBe('episodic');
    expect(getMemoryKind({ type: 'lesson' })).toBe('episodic');
  });
});

describe('filterMemoriesByScope', () => {
  const memories: MemoryEntry[] = [
    mem({ id: 'a', ownerUserId: 'u1', sessionId: 'sess-1' }),
    mem({ id: 'b', agentId: 'agent-boss', orgId: 'org-tandem' }),
    mem({ id: 'c', ownerUserId: 'u2' }),
    mem({ id: 'd', orgId: 'org-tandem' }),
    mem({ id: 'e' }), // 无 scope 字段
  ];

  it('空 scope = 不过滤', () => {
    expect(filterMemoriesByScope(memories, {})).toHaveLength(5);
  });

  it('按 sessionId 单字段过滤', () => {
    const r = filterMemoriesByScope(memories, { sessionId: 'sess-1' });
    expect(r.map((m) => m.id)).toEqual(['a']);
  });

  it('按 userId 单字段过滤', () => {
    const r = filterMemoriesByScope(memories, { userId: 'u1' });
    expect(r.map((m) => m.id)).toEqual(['a']);
  });

  it('按 orgId 过滤命中多条', () => {
    const r = filterMemoriesByScope(memories, { orgId: 'org-tandem' });
    expect(r.map((m) => m.id).sort()).toEqual(['b', 'd']);
  });

  it('多字段 OR 语义', () => {
    const r = filterMemoriesByScope(memories, { userId: 'u2', agentId: 'agent-boss' });
    expect(r.map((m) => m.id).sort()).toEqual(['b', 'c']);
  });

  it('无字段命中返回空', () => {
    const r = filterMemoriesByScope(memories, { sessionId: 'sess-nope' });
    expect(r).toHaveLength(0);
  });
});

describe('bucketMemoriesByKind', () => {
  it('按 kind 分三桶, 隐式 kind 也走推断', () => {
    const memories: MemoryEntry[] = [
      mem({ id: 'a', type: 'sop' }),           // → procedural
      mem({ id: 'b', type: 'case' }),          // → episodic
      mem({ id: 'c', type: 'redline' }),       // → procedural
      mem({ id: 'd', type: 'lesson' }),        // → episodic
      mem({ id: 'e', kind: 'semantic', type: 'sop' }), // 显式 semantic 覆盖推断
    ];
    const buckets = bucketMemoriesByKind(memories);
    expect(buckets.procedural.map((m) => m.id).sort()).toEqual(['a', 'c']);
    expect(buckets.episodic.map((m) => m.id).sort()).toEqual(['b', 'd']);
    expect(buckets.semantic.map((m) => m.id)).toEqual(['e']);
  });
});
