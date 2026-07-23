/**
 * 搭子手抄 · 页面树构建 (Notion 式无限嵌套) — 纯函数, 无 React 依赖, 便于单测.
 *
 * 从扁平笔记列表按 parentId 组装成森林:
 *   - 顶层 = parentId 为空, 或 parentId 指向不存在/已删的笔记 (孤儿回收为顶层)
 *   - 同级排序: pinned 优先, 再按 updatedAt 倒序 (与 listNotes 一致)
 *   - 环保护: 检测到祖先环时把该节点当顶层, 避免无限递归
 */

export interface TreeNoteLike {
  id: string;
  parentId?: string;
  pinned?: boolean;
  title: string;
  updatedAt: string;
}

export interface PageNode<T extends TreeNoteLike> {
  note: T;
  children: PageNode<T>[];
  depth: number;
}

function sortSiblings<T extends TreeNoteLike>(a: T, b: T): number {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function buildPageTree<T extends TreeNoteLike>(notes: T[]): PageNode<T>[] {
  const byId = new Map<string, T>();
  for (const n of notes) byId.set(n.id, n);

  // 判定有效父: 存在且不构成环
  const effectiveParent = (n: T): string | undefined => {
    const pid = n.parentId;
    if (!pid || !byId.has(pid) || pid === n.id) return undefined;
    // 环检测: 沿 parent 链上溯, 若回到 n 自身则视为顶层
    const seen = new Set<string>([n.id]);
    let cur: T | undefined = byId.get(pid);
    while (cur) {
      if (seen.has(cur.id)) return undefined;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return pid;
  };

  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const n of notes) {
    const pid = effectiveParent(n);
    if (pid) {
      const arr = childrenOf.get(pid) ?? [];
      arr.push(n);
      childrenOf.set(pid, arr);
    } else {
      roots.push(n);
    }
  }

  const build = (note: T, depth: number): PageNode<T> => {
    const kids = (childrenOf.get(note.id) ?? []).slice().sort(sortSiblings);
    return { note, children: kids.map((k) => build(k, depth + 1)), depth };
  };

  return roots.slice().sort(sortSiblings).map((r) => build(r, 0));
}

/** 收集某节点的全部后代 id (含自身), 用于删除/移动时的级联判断. */
export function collectDescendantIds<T extends TreeNoteLike>(notes: T[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of notes) {
    if (n.parentId) {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    }
  }
  const out = new Set<string>();
  const walk = (id: string) => {
    if (out.has(id)) return;
    out.add(id);
    for (const c of childrenOf.get(id) ?? []) walk(c);
  };
  walk(rootId);
  return out;
}
