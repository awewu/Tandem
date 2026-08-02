/**
 * useNoteDraft · 搭子手抄编辑器草稿状态 (上帝组件拆分, 2026-08)
 *
 * 从 app/shouchao/page.tsx 抽出编辑器草稿这一内聚状态簇 (原本散在 ~9 个 useState),
 * 收拢为单一 hook. 调用方以同名解构使用, 全部渲染/回调站点无需改动 —— 行为完全不变.
 *
 * 覆盖字段: title / content / tags / summary / sourceUrl / pinned / shared / editorMode / dirty.
 * 附带: markDirty (置脏, 幂等) 与 loadDraft (从一条笔记载入草稿, 用于选中/新建).
 */

import { useCallback, useState } from 'react';

/** loadDraft 接受的最小笔记形状 (与 ShouchaoNote 兼容). */
export interface NoteDraftSource {
  title: string;
  content: string;
  tags?: string[];
  summary?: string;
  sourceUrl?: string;
  pinned?: boolean;
  sharedToPersona?: boolean;
}

export function useNoteDraft() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [pinned, setPinned] = useState(false);
  const [shared, setShared] = useState(false);
  /** 编辑器模式: block=块编辑(Notion 式) / md=Markdown 源码 */
  const [editorMode, setEditorMode] = useState<'block' | 'md'>('block');
  const [dirty, setDirty] = useState(false);

  /** 置脏 (幂等): 等价于原 `if (!dirty) setDirty(true)`, 用函数式更新避免 stale closure. */
  const markDirty = useCallback(() => {
    setDirty((d) => (d ? d : true));
  }, []);

  /** 从一条笔记载入草稿 (选中/新建时). 与原 selectNote 内联赋值逐字段等价. */
  const loadDraft = useCallback((n: NoteDraftSource) => {
    setTitle(n.title);
    setContent(n.content);
    setTags(n.tags ?? []);
    setSummary(n.summary ?? '');
    setSourceUrl(n.sourceUrl);
    setPinned(!!n.pinned);
    setShared(!!n.sharedToPersona);
    setDirty(false);
  }, []);

  return {
    title, setTitle,
    content, setContent,
    tags, setTags,
    summary, setSummary,
    sourceUrl, setSourceUrl,
    pinned, setPinned,
    shared, setShared,
    editorMode, setEditorMode,
    dirty, setDirty,
    markDirty, loadDraft,
  };
}
