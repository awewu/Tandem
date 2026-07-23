'use client';

/**
 * 搭子手抄 · 页面树侧栏 (Notion 式无限嵌套导航)
 *
 * 受控展示: 从扁平 notes 用 buildPageTree 组装, 递归渲染.
 * 交互: 点击打开笔记 / 展开收起 / 悬停出现"+"新建子页面.
 * 纯展示组件, 不直接读写数据 — 由父组件通过回调落库.
 */

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, FileText } from 'lucide-react';
import { buildPageTree, type PageNode, type TreeNoteLike } from '@/lib/shouchao/tree';

export interface PageTreeNote extends TreeNoteLike {
  icon?: string;
}

interface PageTreeProps {
  notes: PageTreeNote[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddRoot: () => void;
}

export function PageTree({ notes, activeId, onSelect, onAddChild, onAddRoot }: PageTreeProps) {
  const tree = useMemo(() => buildPageTree(notes), [notes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: PageNode<PageTreeNote>) => {
    const { note, children } = node;
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(note.id);
    return (
      <div key={note.id}>
        <div
          className={`group/row flex items-center gap-1 rounded-md pr-1 surface-interactive ${
            activeId === note.id ? 'bg-brand-50 text-brand-700' : 'text-ink-secondary hover:bg-surface-2'
          }`}
          style={{ paddingLeft: `${node.depth * 12 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(note.id)}
            className={`shrink-0 rounded p-0.5 ${hasChildren ? 'text-ink-tertiary hover:bg-surface-3' : 'invisible'}`}
            title={isCollapsed ? '展开' : '收起'}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onSelect(note.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-caption"
          >
            <span className="shrink-0">
              {note.icon ? <span>{note.icon}</span> : <FileText className="h-3.5 w-3.5 text-ink-tertiary" />}
            </span>
            <span className="truncate">{note.title || '未命名'}</span>
          </button>
          <button
            type="button"
            onClick={() => onAddChild(note.id)}
            title="新建子页面"
            className="shrink-0 rounded p-0.5 text-ink-tertiary opacity-0 transition-opacity hover:bg-surface-3 group-hover/row:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {hasChildren && !isCollapsed && <div>{children.map(renderNode)}</div>}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-footnote font-semibold text-ink-tertiary">页面</span>
        <button
          type="button"
          onClick={onAddRoot}
          title="新建顶层页面"
          className="rounded p-0.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {tree.length === 0 ? (
          <p className="px-3 py-4 text-footnote text-ink-tertiary">还没有页面，点右上角 + 新建。</p>
        ) : (
          tree.map(renderNode)
        )}
      </div>
    </div>
  );
}
