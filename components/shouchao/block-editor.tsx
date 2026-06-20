'use client';

/**
 * 搭字手抄 · 块编辑器 (对标 Notion 的 block 编辑体验)
 *
 * 务实设计: 块级编辑, 但序列化回 Markdown 字符串. 这样底层数据模型 (content: string)
 * 完全不变, 现有笔记/同步/语义检索全部向后兼容, 又给用户 Notion 式的块操作体验.
 *
 * 支持的块类型: 段落 / H1-H3 / 无序列表 / 有序列表 / 待办 / 引用 / 代码 / 分割线.
 * 交互:
 *   - Enter        新建同类型块 (列表/待办继承, 标题降级为段落)
 *   - Backspace@行首 与上一块合并
 *   - "/" 行首唤起块类型菜单
 *   - 每行左侧悬停出现类型切换 + 删除
 *
 * 不引入 tiptap/slate/prosemirror 等重依赖: 个人笔记场景, 轻量受控组件足够,
 * 且避免与现有 react-markdown 渲染体系冲突.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';

import {
  parseMarkdown,
  serializeBlocks,
  olOrdinal,
  newId,
  type Block,
  type BlockType,
} from './block-serialize';

// 兼容旧引用: 从组件 re-export 序列化函数
export { parseMarkdown, serializeBlocks } from './block-serialize';

const BLOCK_MENU: Array<{ type: BlockType; label: string; Icon: typeof Type }> = [
  { type: 'p', label: '正文', Icon: Type },
  { type: 'h1', label: '标题 1', Icon: Heading1 },
  { type: 'h2', label: '标题 2', Icon: Heading2 },
  { type: 'h3', label: '标题 3', Icon: Heading3 },
  { type: 'ul', label: '无序列表', Icon: List },
  { type: 'ol', label: '有序列表', Icon: ListOrdered },
  { type: 'todo', label: '待办', Icon: CheckSquare },
  { type: 'quote', label: '引用', Icon: Quote },
  { type: 'code', label: '代码', Icon: Code },
  { type: 'hr', label: '分割线', Icon: Minus },
];

interface BlockEditorProps {
  /** 受控: Markdown 字符串 */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

export function BlockEditor({ value, onChange, placeholder }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(value));
  // 防止外部 value 与内部循环互相打架: 仅当外部 value 与当前序列化结果不同才重建
  const lastSerialized = useRef<string>(serializeBlocks(blocks));
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const focusAfter = useRef<string | null>(null);
  // 拖拽排序: 当前被拖块 id + 悬停目标块 id (插入到目标块之前)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    if (value !== lastSerialized.current) {
      const parsed = parseMarkdown(value);
      setBlocks(parsed);
      lastSerialized.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = useCallback(
    (next: Block[]) => {
      setBlocks(next);
      const md = serializeBlocks(next);
      lastSerialized.current = md;
      onChange(md);
    },
    [onChange],
  );

  // 自动聚焦新建块
  useEffect(() => {
    if (focusAfter.current && inputRefs.current[focusAfter.current]) {
      const el = inputRefs.current[focusAfter.current];
      el?.focus();
      // 光标移到末尾
      const len = el?.value.length ?? 0;
      el?.setSelectionRange(len, len);
      focusAfter.current = null;
    }
  });

  const updateBlock = (id: string, patch: Partial<Block>) => {
    commit(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const setType = (id: string, type: BlockType) => {
    setMenuFor(null);
    commit(blocks.map((b) => (b.id === id ? { ...b, type } : b)));
    focusAfter.current = id;
  };

  const removeBlock = (id: string) => {
    if (blocks.length === 1) {
      commit([{ id: newId(), type: 'p', text: '' }]);
      return;
    }
    const idx = blocks.findIndex((b) => b.id === id);
    const next = blocks.filter((b) => b.id !== id);
    commit(next);
    focusAfter.current = next[Math.max(0, idx - 1)]?.id ?? null;
  };

  // 把 sourceId 移动到 targetId 之前; targetId 为 null 表示移到末尾
  const moveBlock = (sourceId: string, targetId: string | null) => {
    if (sourceId === targetId) return;
    const from = blocks.findIndex((b) => b.id === sourceId);
    if (from < 0) return;
    const without = blocks.filter((b) => b.id !== sourceId);
    const moved = blocks[from];
    if (targetId === null) {
      commit([...without, moved]);
      return;
    }
    const to = without.findIndex((b) => b.id === targetId);
    if (to < 0) return;
    commit([...without.slice(0, to), moved, ...without.slice(to)]);
  };

  const endDrag = () => {
    setDragId(null);
    setDragOverId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block, idx: number) => {
    const el = e.currentTarget;
    // 行首 "/" 唤起菜单
    if (e.key === '/' && el.value === '') {
      e.preventDefault();
      setMenuFor(block.id);
      return;
    }
    // Enter: 新建块 (代码块允许换行, 用 Shift+Enter 出块)
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      const inheritType: BlockType =
        block.type === 'ul' || block.type === 'ol' || block.type === 'todo' ? block.type : 'p';
      // 空列表项再回车 → 退回段落 (Notion 行为)
      if ((block.type === 'ul' || block.type === 'ol' || block.type === 'todo') && block.text === '') {
        updateBlock(block.id, { type: 'p' });
        return;
      }
      const nb: Block = { id: newId(), type: inheritType, text: '', checked: inheritType === 'todo' ? false : undefined };
      const next = [...blocks.slice(0, idx + 1), nb, ...blocks.slice(idx + 1)];
      commit(next);
      focusAfter.current = nb.id;
      return;
    }
    // Backspace@行首: 与上一块合并
    if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && idx > 0) {
      e.preventDefault();
      const prev = blocks[idx - 1];
      const merged = { ...prev, text: prev.text + block.text };
      const next = [...blocks.slice(0, idx - 1), merged, ...blocks.slice(idx + 1)];
      commit(next);
      focusAfter.current = prev.id;
    }
  };

  const blockClass = (type: BlockType): string => {
    switch (type) {
      case 'h1': return 'text-title-2 font-bold';
      case 'h2': return 'text-title-3 font-bold';
      case 'h3': return 'text-body font-semibold';
      case 'quote': return 'border-l-2 border-brand-300 pl-3 italic text-ink-secondary';
      case 'code': return 'font-mono text-caption bg-surface-2 rounded-md p-2';
      default: return 'text-body';
    }
  };

  return (
    <div className="space-y-0.5">
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          className={`group relative flex items-start gap-1 rounded-md transition-colors ${
            dragOverId === block.id ? 'border-t-2 border-brand-400' : 'border-t-2 border-transparent'
          } ${dragId === block.id ? 'opacity-40' : ''}`}
          onDragOver={(e) => {
            if (!dragId || dragId === block.id) return;
            e.preventDefault();
            if (dragOverId !== block.id) setDragOverId(block.id);
          }}
          onDrop={(e) => {
            if (!dragId) return;
            e.preventDefault();
            moveBlock(dragId, block.id);
            endDrag();
          }}
        >
          {/* 左侧悬浮控制 */}
          <div className="flex w-10 shrink-0 items-center justify-end gap-0.5 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              title="块类型"
              onClick={() => setMenuFor(menuFor === block.id ? null : block.id)}
              className="rounded p-0.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span
              draggable
              title="拖拽排序"
              onDragStart={(e) => {
                setDragId(block.id);
                e.dataTransfer.effectAllowed = 'move';
                // 某些浏览器需要设置数据才会触发 drag
                e.dataTransfer.setData('text/plain', block.id);
              }}
              onDragEnd={endDrag}
              className="cursor-grab text-ink-tertiary active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          </div>

          {/* 块类型菜单 */}
          {menuFor === block.id && (
            <div className="absolute left-10 top-7 z-20 w-40 rounded-lg border border-border bg-surface-1 p-1 shadow-lg">
              {BLOCK_MENU.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setType(block.id, type)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-caption text-ink-secondary hover:bg-surface-2"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          )}

          {/* 块主体 */}
          <div className="flex-1 py-0.5">
            {block.type === 'hr' ? (
              <div className="flex items-center py-2">
                <div className="h-px flex-1 bg-border" />
                <button type="button" onClick={() => removeBlock(block.id)} className="ml-2 text-ink-tertiary opacity-0 group-hover:opacity-100 hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                {block.type === 'todo' && (
                  <input
                    type="checkbox"
                    checked={Boolean(block.checked)}
                    onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
                    className="mt-1.5 h-4 w-4 shrink-0 accent-brand-500"
                  />
                )}
                {(block.type === 'ul' || block.type === 'ol') && (
                  <span className="mt-1 select-none text-ink-tertiary text-caption">
                    {block.type === 'ul' ? '•' : `${olOrdinal(blocks, idx)}.`}
                  </span>
                )}
                <textarea
                  ref={(el) => { inputRefs.current[block.id] = el; }}
                  value={block.text}
                  rows={1}
                  onChange={(e) => {
                    updateBlock(block.id, { text: e.target.value });
                    // 自动高度
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => handleKeyDown(e, block, idx)}
                  placeholder={idx === 0 ? (placeholder ?? "输入正文，按 “/” 选择块类型…") : ''}
                  className={`w-full resize-none bg-transparent leading-relaxed text-ink-primary placeholder:text-ink-tertiary focus:outline-none ${blockClass(block.type)} ${block.checked ? 'line-through text-ink-tertiary' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  title="删除块"
                  className="mt-1 shrink-0 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {/* 末尾落点: 把块拖到这里移到最后 */}
      {dragId && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (dragOverId !== '__end__') setDragOverId('__end__');
          }}
          onDrop={(e) => {
            e.preventDefault();
            moveBlock(dragId, null);
            endDrag();
          }}
          className={`h-6 rounded-md transition-colors ${
            dragOverId === '__end__' ? 'border-t-2 border-brand-400' : ''
          }`}
        />
      )}
    </div>
  );
}
