/**
 * 搭子手抄 · 页面树构建 (buildPageTree / collectDescendantIds)
 *
 * 契约: 按 parentId 组装森林, 孤儿回收为顶层, 环保护, 同级 pinned+updatedAt 排序.
 */
import { describe, it, expect } from 'vitest';
import { buildPageTree, collectDescendantIds, type TreeNoteLike } from '@/lib/shouchao/tree';

function n(id: string, parentId?: string, updatedAt = '2026-01-01', pinned = false): TreeNoteLike {
  return { id, parentId, title: id, updatedAt, pinned };
}

describe('buildPageTree', () => {
  it('扁平列表按 parentId 组装成嵌套森林', () => {
    const tree = buildPageTree([n('a'), n('b', 'a'), n('c', 'b'), n('d')]);
    expect(tree.map((t) => t.note.id).sort()).toEqual(['a', 'd']);
    const a = tree.find((t) => t.note.id === 'a')!;
    expect(a.children.map((c) => c.note.id)).toEqual(['b']);
    expect(a.children[0].children.map((c) => c.note.id)).toEqual(['c']);
    expect(a.children[0].children[0].depth).toBe(2);
  });

  it('父不存在的孤儿回收为顶层', () => {
    const tree = buildPageTree([n('x', 'ghost'), n('y')]);
    expect(tree.map((t) => t.note.id).sort()).toEqual(['x', 'y']);
  });

  it('自引用不会死循环, 当作顶层', () => {
    const tree = buildPageTree([n('self', 'self')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].note.id).toBe('self');
  });

  it('相互引用的环不死循环', () => {
    const tree = buildPageTree([n('p', 'q'), n('q', 'p')]);
    // 至少有一个被回收为顶层, 不抛栈溢出
    expect(tree.length).toBeGreaterThanOrEqual(1);
  });

  it('同级 pinned 优先, 再按 updatedAt 倒序', () => {
    const tree = buildPageTree([
      n('old', undefined, '2026-01-01'),
      n('new', undefined, '2026-02-01'),
      n('pin', undefined, '2025-01-01', true),
    ]);
    expect(tree.map((t) => t.note.id)).toEqual(['pin', 'new', 'old']);
  });
});

describe('collectDescendantIds', () => {
  it('收集全部后代含自身', () => {
    const notes = [n('a'), n('b', 'a'), n('c', 'b'), n('d')];
    const ids = collectDescendantIds(notes, 'a');
    expect(Array.from(ids).sort()).toEqual(['a', 'b', 'c']);
  });
});
