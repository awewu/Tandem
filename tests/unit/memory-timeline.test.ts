/**
 * 记忆时间/因果链 (MAGMA-lite) 单测。
 *
 * 覆盖: 按实体筛选 + 时间升序 · 时间主干 temporal_next (n-1 条) ·
 *       版本取代 supersedes 边 · 同会话 same_session 边 · 决策防火墙排除个人 ·
 *       maxEvents 截断保留最近 · summarizeTimeline 文本。
 */

import { describe, it, expect } from 'vitest';
import { buildEntityTimeline, summarizeTimeline } from '@/lib/memory/timeline';
import type { MemoryEntry } from '@/lib/types/memory';

function mem(over: Partial<MemoryEntry> & { id: string }): MemoryEntry {
  return {
    type: 'case',
    title: over.title ?? '记忆',
    body: over.body ?? '',
    status: 'active',
    signers: [],
    ownershipLevel: 'company',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    referenceCount: 0,
    ...over,
  } as MemoryEntry;
}

describe('buildEntityTimeline', () => {
  it('按实体筛选并按时间升序排列, 建时间主干 temporal_next (n-1 条)', () => {
    const mems = [
      mem({ id: 'm2', title: 'KR-5 中期复盘', body: '围绕 KR-5', createdAt: '2026-03-01T00:00:00Z' }),
      mem({ id: 'm1', title: 'KR-5 立项', body: 'KR-5 启动', createdAt: '2026-01-01T00:00:00Z' }),
      mem({ id: 'm3', title: 'KR-5 收尾', body: 'KR-5 完成', createdAt: '2026-05-01T00:00:00Z' }),
      mem({ id: 'other', title: '无关记忆', body: '与 KR-9 有关', createdAt: '2026-02-01T00:00:00Z' }),
    ];
    const tl = buildEntityTimeline('KR-5', mems);
    expect(tl.events.map((e) => e.memory.id)).toEqual(['m1', 'm2', 'm3']);
    expect(tl.events.map((e) => e.order)).toEqual([0, 1, 2]);
    const tnext = tl.causalLinks.filter((l) => l.kind === 'temporal_next');
    expect(tnext).toHaveLength(2);
    expect(tnext[0]).toMatchObject({ fromId: 'm1', toId: 'm2' });
    expect(tnext[1]).toMatchObject({ fromId: 'm2', toId: 'm3' });
  });

  it('版本取代生成 supersedes 因果边 (旧 → 新)', () => {
    const mems = [
      mem({ id: 'v1', title: 'KR-5 方案 v1', body: 'KR-5', createdAt: '2026-01-01T00:00:00Z', supersededBy: 'v2' }),
      mem({ id: 'v2', title: 'KR-5 方案 v2', body: 'KR-5', createdAt: '2026-02-01T00:00:00Z', supersedes: 'v1' }),
    ];
    const tl = buildEntityTimeline('KR-5', mems);
    const sup = tl.causalLinks.filter((l) => l.kind === 'supersedes');
    expect(sup.length).toBeGreaterThanOrEqual(1);
    expect(sup.every((l) => l.fromId === 'v1' && l.toId === 'v2')).toBe(true);
    expect(sup[0].weight).toBe(1.0);
  });

  it('同会话生成 same_session 弱因果边', () => {
    const mems = [
      mem({ id: 'a', title: 'KR-5 议事纪要 A', body: 'KR-5', createdAt: '2026-01-01T00:00:00Z', sessionId: 's1' }),
      mem({ id: 'b', title: 'KR-5 议事纪要 B', body: 'KR-5', createdAt: '2026-01-01T01:00:00Z', sessionId: 's1' }),
    ];
    const tl = buildEntityTimeline('KR-5', mems);
    const ss = tl.causalLinks.filter((l) => l.kind === 'same_session');
    expect(ss).toHaveLength(1);
    expect(ss[0]).toMatchObject({ fromId: 'a', toId: 'b', kind: 'same_session' });
  });

  it('决策防火墙: 默认排除 ownershipLevel=personal', () => {
    const mems = [
      mem({ id: 'org', title: 'KR-5 组织记忆', body: 'KR-5', createdAt: '2026-01-01T00:00:00Z' }),
      mem({ id: 'pers', title: 'KR-5 个人记事', body: 'KR-5', createdAt: '2026-02-01T00:00:00Z', ownershipLevel: 'personal', ownerUserId: 'u1' }),
    ];
    const tl = buildEntityTimeline('KR-5', mems);
    expect(tl.events.map((e) => e.memory.id)).toEqual(['org']);
  });

  it('maxEvents 截断保留最近 N, 再回到时间序', () => {
    const mems = Array.from({ length: 5 }, (_, i) =>
      mem({ id: `m${i}`, title: `KR-5 事件 ${i}`, body: 'KR-5', createdAt: `2026-0${i + 1}-01T00:00:00Z` }),
    );
    const tl = buildEntityTimeline('KR-5', mems, { maxEvents: 3 });
    // 最近 3 = m2,m3,m4 (时间序)
    expect(tl.events.map((e) => e.memory.id)).toEqual(['m2', 'm3', 'm4']);
  });

  it('空实体 / 无匹配 → 空时间线', () => {
    expect(buildEntityTimeline('', []).events).toHaveLength(0);
    expect(buildEntityTimeline('KR-99', [mem({ id: 'x', body: 'KR-1' })]).events).toHaveLength(0);
  });

  it('summarizeTimeline 输出带日期的编号事件', () => {
    const mems = [mem({ id: 'm1', title: 'KR-5 立项', body: 'KR-5', createdAt: '2026-01-01T00:00:00Z' })];
    const s = summarizeTimeline(buildEntityTimeline('KR-5', mems));
    expect(s).toMatch(/KR-5/);
    expect(s).toMatch(/2026-01-01/);
    expect(s).toMatch(/1\. /);
  });
});
