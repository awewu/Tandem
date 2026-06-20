'use client';

/**
 * 搭子手抄 · AI 笔记 (精简内核 MVP)
 *
 * 员工个人资产 · 独立笔记体系 (对标行业笔记: flomo / Get笔记 / Notion).
 * 跟 Tandem 的关系 = 像财务 ERP 一样, 只是首页一个入口 (跳板 tile), 不归公司治理.
 *
 *   - 文字/Markdown 笔记 (列表 + 编辑器 + 自动保存)
 *   - 链接/网页剪藏 (服务端抓取正文)
 *   - AI 一键 总结 / 润色 / 生成标签
 *   - 列表搜索
 *
 * 数据按 userId(ownerId) 个人归属, 跟 OKR / 公司 Memory 解耦.
 * 独立模块: 仅依赖自身 /api/shouchao/*, 可整体抽离为独立 app.
 * (若未来要与个人体系打通, 对接的是 /persona 拿捏板块, 由员工本人授权, 详见 backlog.)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { enqueue as enqueueOffline, flushQueue } from '@/lib/shouchao/offline-queue';
import { BlockEditor } from '@/components/shouchao/block-editor';
import {
  NotebookPen,
  Plus,
  Search,
  Trash2,
  Link2,
  Sparkles,
  Wand2,
  Tags,
  Loader2,
  Check,
  Cloud,
  X,
  ArrowLeft,
  Pin,
  PinOff,
  ExternalLink,
  Share2,
  MessageCircleQuestion,
  Send as SendIcon,
  LayoutList,
  FileText,
  FileUp,
} from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
  summary?: string;
  pinned?: boolean;
  archived?: boolean;
  sharedToPersona?: boolean;
  createdAt: string;
  updatedAt: string;
}

type Toast = { kind: 'ok' | 'err'; text: string } | null;

export default function ShouchaoPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // 编辑草稿
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [pinned, setPinned] = useState(false);
  const [shared, setShared] = useState(false);
  /** 编辑器模式: block=块编辑(Notion 式) / md=Markdown 源码 */
  const [editorMode, setEditorMode] = useState<'block' | 'md'>('block');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | 'summarize' | 'polish' | 'tags'>(null);
  const [clipOpen, setClipOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // 跨笔记 AI 问答 (Ask) · 问你的第二大脑
  const [askOpen, setAskOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askAnswer, setAskAnswer] = useState('');
  const [askCitations, setAskCitations] = useState<{ index: number; id: string; title: string }[]>([]);

  // 双向链接: 出链 (本笔记引用谁) + 反链 (谁引用本笔记)
  const [outgoing, setOutgoing] = useState<{ id: string | null; title: string; unresolved: boolean }[]>([]);
  const [backlinks, setBacklinks] = useState<{ id: string; title: string; updatedAt: string }[]>([]);

  // 刚需 · 随手记快速捕获 (1 步落库, 不开编辑器)
  const [quick, setQuick] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const quickRef = useRef<HTMLTextAreaElement | null>(null);
  // 自动保存序列化: 取消上一笔在途 PATCH + 丢弃过期响应, 防快速打字时旧请求覆盖新内容
  const saveAbortRef = useRef<AbortController | null>(null);
  const saveSeqRef = useRef(0);

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);

  // 全部标签 (卡片流上方筛选用)
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => (n.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  // 当前可见笔记 (叠加标签筛选; 搜索已在服务端过滤)
  const visibleNotes = useMemo(
    () => (tagFilter ? notes.filter((n) => (n.tags ?? []).includes(tagFilter)) : notes),
    [notes, tagFilter],
  );

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- 列表加载 (debounced search) ----
  const loadNotes = useCallback(async (q: string) => {
    try {
      const r = await fetch(`/api/shouchao/notes?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const d = await r.json();
        setNotes(d.notes ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadNotes(search), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, loadNotes]);

  // ---- 选中笔记 → 载入草稿 ----
  function selectNote(n: Note) {
    setActiveId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setTags(n.tags ?? []);
    setSummary(n.summary ?? '');
    setSourceUrl(n.sourceUrl);
    setPinned(!!n.pinned);
    setShared(!!n.sharedToPersona);
    setDirty(false);
    setOutgoing([]);
    setBacklinks([]);
    void loadLinks(n.id);
  }

  // ---- 双向链接: 拉取出链 + 反链 ----
  const loadLinks = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/shouchao/notes/${id}/links`);
      if (!r.ok) return;
      const d = await r.json();
      setOutgoing(Array.isArray(d.outgoing) ? d.outgoing : []);
      setBacklinks(Array.isArray(d.backlinks) ? d.backlinks : []);
    } catch {
      /* 链接面板非关键, 失败静默 */
    }
  }, []);

  // ---- 跳转到某笔记 (双链点击): 在已加载列表里找, 找不到则按 id 拉取 ----
  async function navigateToNote(id: string) {
    const local = notes.find((x) => x.id === id);
    if (local) {
      selectNote(local);
      return;
    }
    try {
      const r = await fetch(`/api/shouchao/notes/${id}`);
      if (!r.ok) throw new Error('not found');
      const d = await r.json();
      if (d.note) selectNote(d.note as Note);
    } catch {
      showToast('err', '该笔记可能已删除');
    }
  }

  // ---- 双链点击: 已存在则跳转, 未创建 (unresolved) 则按标题新建 ----
  async function followWikiLink(ref: { id: string | null; title: string }) {
    if (ref.id) {
      void navigateToNote(ref.id);
      return;
    }
    // 未解析: 用该标题新建笔记
    try {
      const r = await fetch('/api/shouchao/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ref.title, content: '', tags: [] }),
      });
      if (!r.ok) throw new Error('create failed');
      const d = await r.json();
      await loadNotes(search);
      if (d.note) selectNote(d.note as Note);
    } catch {
      showToast('err', '创建笔记失败');
    }
  }

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  // ---- 新建 ----
  async function createNote(seed?: Partial<Note>) {
    try {
      const r = await fetch('/api/shouchao/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: seed?.title ?? '',
          content: seed?.content ?? '',
          tags: seed?.tags ?? [],
          sourceUrl: seed?.sourceUrl,
        }),
      });
      if (!r.ok) throw new Error('create failed');
      const d = await r.json();
      const note: Note = d.note;
      setNotes((prev) => [note, ...prev]);
      selectNote(note);
      return note;
    } catch {
      showToast('err', '新建失败');
      return null;
    }
  }

  // ---- 刚需 · 随手记 (1 步落库, 不开编辑器, 存完留焦点接着记) ----
  const quickCapture = useCallback(async () => {
    const body = quick.trim();
    if (!body || quickBusy) return;
    setQuickBusy(true);
    // 首行做标题, 其余做正文 (列表展示更友好)
    const lines = body.split('\n');
    const firstLine = lines[0].trim();
    const title = firstLine.length > 40 ? firstLine.slice(0, 40) : firstLine;
    try {
      const r = await fetch('/api/shouchao/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: body, tags: [] }),
      });
      if (!r.ok) throw new Error('quick capture failed');
      const d = await r.json();
      setNotes((prev) => [d.note as Note, ...prev]);
      setQuick('');
      showToast('ok', '已记下');
      quickRef.current?.focus();
    } catch {
      // 断网/请求失败 → 落本地离线队列, 恢复网络自动回传 (手机端刚需)
      const offline = enqueueOffline({ title, content: body, tags: [] });
      setNotes((prev) => [offline as Note, ...prev]);
      setQuick('');
      showToast('ok', '已离线保存 · 联网后自动同步');
      quickRef.current?.focus();
    } finally {
      setQuickBusy(false);
    }
  }, [quick, quickBusy, showToast]);

  // 冲洗离线队列: 成功后用服务端权威态刷新列表
  const flushOffline = useCallback(async () => {
    const synced = await flushQueue();
    if (synced && synced.length > 0) {
      await loadNotes(search);
      showToast('ok', `已同步 ${synced.length} 条离线笔记`);
    }
  }, [loadNotes, search, showToast]);

  // 进页面先冲一次离线队列; 恢复网络时再冲
  useEffect(() => {
    void flushOffline();
    const onOnline = () => void flushOffline();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushOffline]);

  // 进入页面即聚焦随手记 (?capture=1 或默认), 把捕获摩擦压到 0
  useEffect(() => {
    quickRef.current?.focus();
  }, []);

  // ---- 保存 (PATCH active) ----
  const saveActive = useCallback(async () => {
    if (!activeId) return;
    // 取消上一笔在途保存, 并领取本次序列号
    saveAbortRef.current?.abort();
    const ctrl = new AbortController();
    saveAbortRef.current = ctrl;
    const seq = ++saveSeqRef.current;
    setSaving(true);
    try {
      const r = await fetch(`/api/shouchao/notes/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags, summary, pinned }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('save failed');
      const d = await r.json();
      // 过期响应丢弃: 已有更晚的保存发出, 不能用旧权威态回写覆盖新输入
      if (seq !== saveSeqRef.current) return;
      const updated: Note = d.note;
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setDirty(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 被新保存取消, 正常
      showToast('err', '保存失败');
    } finally {
      if (seq === saveSeqRef.current) setSaving(false);
    }
  }, [activeId, title, content, tags, summary, pinned, showToast]);

  // 自动保存 (1.2s 防抖)
  useEffect(() => {
    if (!dirty || !activeId) return;
    const t = setTimeout(() => void saveActive(), 1200);
    return () => clearTimeout(t);
  }, [dirty, activeId, title, content, tags, summary, pinned, saveActive]);

  // ---- 删除 ----
  async function deleteActive() {
    if (!activeId) return;
    if (!confirm('确认删除这条笔记？不可撤销。')) return;
    const id = activeId;
    try {
      const r = await fetch(`/api/shouchao/notes/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('delete failed');
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveId(null);
      showToast('ok', '已删除');
    } catch {
      showToast('err', '删除失败');
    }
  }

  // ---- AI 加工 ----
  async function runAi(action: 'summarize' | 'polish' | 'tags') {
    if (!content.trim()) {
      showToast('err', '正文为空');
      return;
    }
    setAiBusy(action);
    try {
      const r = await fetch('/api/shouchao/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, content }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? 'AI 失败');
      if (action === 'tags') {
        const merged = Array.from(new Set([...tags, ...(d.tags ?? [])]));
        setTags(merged);
        showToast('ok', `已生成 ${d.tags?.length ?? 0} 个标签`);
      } else if (action === 'summarize') {
        setSummary(d.result ?? '');
        showToast('ok', 'AI 摘要已生成');
      } else {
        setContent(d.result ?? content);
        showToast('ok', '已润色');
      }
      markDirty();
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'AI 失败');
    } finally {
      setAiBusy(null);
    }
  }

  // ---- 跨笔记 AI 问答 (Ask) · 问你的第二大脑 ----
  async function askNotes() {
    const q = askQuestion.trim();
    if (!q || askBusy) return;
    setAskBusy(true);
    setAskAnswer('');
    setAskCitations([]);
    try {
      const r = await fetch('/api/shouchao/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? 'AI 问答失败');
      setAskAnswer(d.answer ?? '');
      setAskCitations(Array.isArray(d.citations) ? d.citations : []);
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'AI 问答失败');
    } finally {
      setAskBusy(false);
    }
  }

  // 点引用 → 打开对应笔记
  function openCitation(id: string) {
    const n = notes.find((x) => x.id === id);
    if (n) {
      selectNote(n);
      setAskOpen(false);
    } else {
      showToast('err', '该笔记可能已归档或删除');
    }
  }

  // ---- 员工本人闸门: 喂给我的工作分身 (默认关, 可撤回) ----
  async function toggleShare() {
    if (!activeId) return;
    const next = !shared;
    setShared(next); // 乐观
    try {
      const r = await fetch(`/api/shouchao/notes/${activeId}/share-to-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      setNotes((prev) => prev.map((n) => (n.id === d.note.id ? d.note : n)));
      showToast('ok', next ? '已授权喂给工作分身' : '已撤回授权');
    } catch {
      setShared(!next); // 回滚
      showToast('err', '操作失败, 稍后再试');
    }
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
    markDirty();
  }
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    markDirty();
  }

  // ---- 关闭滑出式编辑 (先冲一次未保存草稿, 再退出) ----
  const closeEditor = useCallback(async () => {
    if (dirty && activeId) await saveActive();
    setActiveId(null);
  }, [dirty, activeId, saveActive]);

  // 编辑器打开时锁背景滚动 + Esc 关闭
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void closeEditor();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, closeEditor]);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-surface-1 to-surface-2/50">
      {/* ── 模块头 ── */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-1/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          {/* 公司 VI 锚点 (Rheem Red 品牌 mark) — 独立运行时也带公司标准 */}
          <BrandLogo variant="mark" theme="auto" size={32} alt="Tandem" />
          <span className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-brand-500" />
            <div>
              <h1 className="text-headline font-bold text-ink-primary leading-none">搭子手抄</h1>
              <p className="mt-0.5 text-footnote text-ink-tertiary">AI 笔记 · 记录 → 加工 → 沉淀</p>
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回 Tandem
        </Link>
      </header>

      {/* ── 单列卡片流 (Get 式: 速记框置顶 + 卡片瀑布) ── */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-5 md:px-6">
          {/* 刚需 · 随手记 (flomo 式速记, 1 步落库, 常驻置顶) */}
          <div className="rounded-2xl border border-border bg-surface-1 p-3 shadow-soft-sm focus-within:border-brand-400">
            <textarea
              ref={quickRef}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void quickCapture();
                }
              }}
              placeholder="此刻在想什么？随手记一笔…"
              rows={3}
              className="w-full resize-none bg-transparent px-1 py-1 text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setClipOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                  title="剪藏网页链接"
                >
                  <Link2 className="h-3.5 w-3.5" /> 剪藏
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                  title="导入 PDF / Word / 文本文件"
                >
                  <FileUp className="h-3.5 w-3.5" /> 导入文件
                </button>
                <button
                  type="button"
                  onClick={() => void createNote()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                  title="打开编辑器写长文"
                >
                  <NotebookPen className="h-3.5 w-3.5" /> 写长文
                </button>
              </div>
              <button
                type="button"
                onClick={() => void quickCapture()}
                disabled={!quick.trim() || quickBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-caption font-semibold text-white hover:bg-brand-600 shadow-soft-sm disabled:opacity-40 surface-interactive"
              >
                {quickBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                记下
                <span className="ml-0.5 hidden font-mono text-[10px] opacity-70 md:inline">⌘↵</span>
              </button>
            </div>
          </div>

          {/* 搜索 */}
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索标题 / 正文 / 标签"
              className="w-full rounded-2xl border border-border bg-surface-1 py-2 pl-9 pr-3 text-caption text-ink-primary placeholder:text-ink-tertiary focus:border-brand-400 focus:outline-none"
            />
          </div>

          {/* 问笔记 (跨笔记 AI 问答 · NotebookLM 式"第二大脑") */}
          <div className="mt-3">
            {!askOpen ? (
              <button
                type="button"
                onClick={() => setAskOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-300/60 bg-brand-50/40 py-2.5 text-caption font-semibold text-brand-600 hover:bg-brand-50 surface-interactive"
              >
                <MessageCircleQuestion className="h-4 w-4" /> 问笔记 · 让 AI 检索你的全部笔记作答
              </button>
            ) : (
              <div className="rounded-2xl border border-brand-300/60 bg-surface-1 p-3 shadow-soft-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-brand-600">
                    <MessageCircleQuestion className="h-4 w-4" /> 问笔记
                  </span>
                  <button
                    type="button"
                    onClick={() => setAskOpen(false)}
                    className="rounded-md p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                    aria-label="关闭"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        e.preventDefault();
                        void askNotes();
                      }
                    }}
                    placeholder="问问你的笔记，比如「我之前记过关于定价的想法吗？」"
                    rows={2}
                    className="min-h-[2.5rem] w-full resize-none rounded-lg border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary placeholder:text-ink-tertiary focus:border-brand-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void askNotes()}
                    disabled={!askQuestion.trim() || askBusy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-caption font-semibold text-white hover:bg-brand-600 shadow-soft-sm disabled:opacity-40 surface-interactive"
                  >
                    {askBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendIcon className="h-3.5 w-3.5" />}
                    {askBusy ? '检索中' : '提问'}
                  </button>
                </div>

                {/* 回答 + 引用溯源 */}
                {askAnswer && (
                  <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
                    <div className="whitespace-pre-wrap text-caption leading-relaxed text-ink-primary">{askAnswer}</div>
                    {askCitations.length > 0 && (
                      <div className="mt-2.5 border-t border-border pt-2">
                        <p className="mb-1.5 text-footnote text-ink-tertiary">引用来源（点开查看）</p>
                        <div className="flex flex-wrap gap-1.5">
                          {askCitations.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => openCitation(c.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-1 px-2 py-1 text-footnote text-ink-secondary hover:border-brand-300 hover:text-brand-600 surface-interactive"
                              title={c.title}
                            >
                              <span className="font-mono text-brand-500">[{c.index}]</span>
                              <span className="max-w-[12rem] truncate">{c.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 标签筛选 chips */}
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                className={`rounded-full px-2.5 py-1 text-footnote surface-interactive ${
                  tagFilter === null
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
                }`}
              >
                全部
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={`rounded-full px-2.5 py-1 text-footnote surface-interactive ${
                    tagFilter === t
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {/* 卡片流 */}
          {loading ? (
            <div className="flex justify-center py-16 text-ink-tertiary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-ink-tertiary">
              <NotebookPen className="h-10 w-10 text-ink-tertiary/50" />
              <p className="text-body">
                {search || tagFilter ? '没有匹配的笔记' : '还没有笔记，上面随手记一笔开始'}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {visibleNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => selectNote(n)}
                  className="w-full rounded-2xl border border-border bg-surface-1 p-4 text-left shadow-soft-sm hover:border-brand-200 hover:shadow-soft-md surface-interactive"
                >
                  <div className="flex items-center gap-1.5 text-footnote text-ink-tertiary">
                    <span>{fmtTime(n.updatedAt)}</span>
                    {n.pinned && <Pin className="h-3 w-3 text-brand-500" />}
                    {n.sourceUrl && <Link2 className="h-3 w-3" />}
                    {n.sharedToPersona && <Share2 className="h-3 w-3 text-brand-500" />}
                  </div>
                  {n.title && n.title !== '未命名笔记' && (
                    <h3 className="mt-1.5 truncate text-headline font-semibold text-ink-primary">{n.title}</h3>
                  )}
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-body leading-relaxed text-ink-secondary">
                    {n.content || n.summary || '空笔记'}
                  </p>
                  {n.tags?.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {n.tags.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-footnote text-ink-secondary"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── 滑出式编辑 sheet (Get 式: 卡片点开从右侧覆盖) ── */}
      {active && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm"
          onClick={() => void closeEditor()}
        >
          <div
            className="flex h-full w-full max-w-2xl flex-col bg-surface-1 shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* sheet 头: 返回 + 状态 + 动作 */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={() => void closeEditor()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-caption font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
                title="关闭 (Esc)"
              >
                <ArrowLeft className="h-4 w-4" /> 关闭
              </button>
              <span className="ml-1 inline-flex items-center gap-1 text-footnote text-ink-tertiary">
                {saving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> 保存中
                  </>
                ) : dirty ? (
                  <>
                    <Cloud className="h-3 w-3" /> 待保存
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-success" /> 已保存
                  </>
                )}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void toggleShare()}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 surface-interactive ${
                    shared
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-tertiary hover:bg-surface-2 hover:text-ink-primary'
                  }`}
                  title={shared ? '已喂给工作分身 · 点击撤回' : '喂给我的工作分身 (默认关, 可撤回)'}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden text-footnote font-medium md:inline">
                    {shared ? '已喂分身' : '喂给分身'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinned((p) => !p);
                    markDirty();
                  }}
                  className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
                  title={pinned ? '取消置顶' : '置顶'}
                >
                  {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteActive()}
                  className="rounded-md p-1.5 text-danger hover:bg-danger/10 surface-interactive"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* sheet 体: 可滚动 */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-4">
                {/* AI 工具条 */}
                <div className="flex flex-wrap items-center gap-2">
                  <AiButton icon={Sparkles} label="AI 总结" busy={aiBusy === 'summarize'} onClick={() => runAi('summarize')} />
                  <AiButton icon={Wand2} label="润色" busy={aiBusy === 'polish'} onClick={() => runAi('polish')} />
                  <AiButton icon={Tags} label="生成标签" busy={aiBusy === 'tags'} onClick={() => runAi('tags')} />
                </div>

                {/* 来源链接 */}
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-footnote text-brand-600 hover:text-brand-700"
                  >
                    <ExternalLink className="h-3 w-3" /> 剪藏来源
                  </a>
                )}

                {/* 标题 */}
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder="笔记标题"
                  className="w-full bg-transparent text-title-2 font-bold text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
                />

                {/* 标签 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-footnote text-ink-secondary"
                    >
                      {t}
                      <button type="button" onClick={() => removeTag(t)} className="text-ink-tertiary hover:text-danger">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                    placeholder="+ 标签"
                    className="w-20 bg-transparent text-footnote text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
                  />
                </div>

                {/* AI 摘要 */}
                {summary && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-footnote font-semibold text-brand-700">
                      <Sparkles className="h-3.5 w-3.5" /> AI 摘要
                    </div>
                    <p className="whitespace-pre-wrap text-caption text-ink-secondary">{summary}</p>
                  </div>
                )}

                {/* 正文 · 块编辑 / Markdown 双模式 */}
                <div>
                  <div className="mb-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditorMode('block')}
                      title="块编辑"
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote ${editorMode === 'block' ? 'bg-brand-50 text-brand-700' : 'text-ink-tertiary hover:bg-surface-2'}`}
                    >
                      <LayoutList className="h-3.5 w-3.5" /> 块编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('md')}
                      title="Markdown 源码"
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote ${editorMode === 'md' ? 'bg-brand-50 text-brand-700' : 'text-ink-tertiary hover:bg-surface-2'}`}
                    >
                      <FileText className="h-3.5 w-3.5" /> Markdown
                    </button>
                  </div>
                  {editorMode === 'block' ? (
                    <div className="min-h-[55vh] rounded-lg border border-border bg-surface-1 p-4">
                      <BlockEditor
                        value={content}
                        onChange={(md) => {
                          setContent(md);
                          markDirty();
                        }}
                        placeholder="开始记录，按 “/” 选择块类型…"
                      />
                    </div>
                  ) : (
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        markDirty();
                      }}
                      placeholder="开始记录…支持 Markdown。可口述草稿后点「润色」让 AI 整理成稿。"
                      className="min-h-[55vh] w-full resize-y rounded-lg border border-border bg-surface-1 p-4 text-body leading-relaxed text-ink-primary placeholder:text-ink-tertiary focus:border-brand-400 focus:outline-none"
                    />
                  )}
                </div>

                {/* 双向链接面板 */}
                {(outgoing.length > 0 || backlinks.length > 0) && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    {outgoing.length > 0 && (
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-footnote font-semibold text-ink-tertiary">
                          <Link2 className="h-3.5 w-3.5" /> 引用了 ({outgoing.length})
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {outgoing.map((ref) => (
                            <button
                              key={`${ref.title}-${ref.id ?? 'new'}`}
                              type="button"
                              onClick={() => void followWikiLink(ref)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote ${ref.unresolved ? 'border border-dashed border-border text-ink-tertiary hover:text-brand-600' : 'bg-surface-2 text-ink-secondary hover:bg-brand-50 hover:text-brand-700'}`}
                            >
                              {ref.title}
                              {ref.unresolved && <Plus className="h-3 w-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {backlinks.length > 0 && (
                      <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-footnote font-semibold text-ink-tertiary">
                          <MessageCircleQuestion className="h-3.5 w-3.5" /> 被引用 ({backlinks.length})
                        </div>
                        <div className="flex flex-col gap-1">
                          {backlinks.map((bl) => (
                            <button
                              key={bl.id}
                              type="button"
                              onClick={() => void navigateToNote(bl.id)}
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-caption text-ink-secondary hover:bg-surface-2 hover:text-brand-700"
                            >
                              <ArrowLeft className="h-3 w-3 shrink-0" /> {bl.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 剪藏弹窗 */}
      {clipOpen && (
        <ClipDialog
          onClose={() => setClipOpen(false)}
          onClipped={async (res) => {
            setClipOpen(false);
            await createNote({ title: res.title, content: res.content, sourceUrl: res.url });
            showToast('ok', '剪藏成功');
          }}
          onError={(m) => showToast('err', m)}
        />
      )}

      {/* 导入文件弹窗 */}
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={async (note) => {
            setImportOpen(false);
            await loadNotes(search);
            if (note) selectNote(note);
            showToast('ok', '导入成功');
          }}
          onError={(m) => showToast('err', m)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-caption font-medium text-white shadow-soft-lg ${
            toast.kind === 'ok' ? 'bg-success' : 'bg-danger'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

// 卡片流时间: 当天显示时分, 否则显示月日
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function AiButton({
  icon: Icon,
  label,
  busy,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-caption font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary disabled:opacity-50 surface-interactive"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function ClipDialog({
  onClose,
  onClipped,
  onError,
}: {
  onClose: () => void;
  onClipped: (res: { title: string; content: string; url: string }) => void;
  onError: (msg: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function go() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/shouchao/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? '剪藏失败');
      onClipped({ title: d.title, content: d.content, url: d.url });
    } catch (e) {
      onError(e instanceof Error ? e.message : '剪藏失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-surface-1 p-6 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-brand-500" />
          <h2 className="text-headline font-bold text-ink-primary">剪藏链接</h2>
        </div>
        <p className="mb-3 text-footnote text-ink-tertiary">
          粘贴网页/文章链接，自动抓取标题与正文存为新笔记。可再用 AI 总结。
        </p>
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void go()}
          placeholder="https://..."
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary placeholder:text-ink-tertiary focus:border-brand-400 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-caption text-ink-secondary hover:bg-surface-2 surface-interactive"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void go()}
            disabled={busy || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-caption font-semibold text-white hover:bg-brand-600 disabled:opacity-50 surface-interactive"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            剪藏
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportDialog({
  onClose,
  onImported,
  onError,
}: {
  onClose: () => void;
  onImported: (note: Note | null) => void;
  onError: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'distill' | 'full'>('distill');
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
  }

  async function go() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      const r = await fetch('/api/shouchao/import', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error ?? '导入失败');
      onImported((d.note as Note) ?? null);
    } catch (e) {
      onError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-surface-1 p-6 shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <FileUp className="h-5 w-5 text-brand-500" />
          <h2 className="text-headline font-bold text-ink-primary">导入文件</h2>
        </div>
        <p className="mb-3 text-footnote text-ink-tertiary">
          支持 PDF / Word(.docx) / 文本(.txt/.md)。AI 提炼成结构化笔记，或保留全文。
        </p>

        {/* 拖拽 / 点击选择区 */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive ? 'border-brand-400 bg-brand-50' : 'border-border hover:bg-surface-2'
          }`}
        >
          <FileUp className="h-6 w-6 text-ink-tertiary" />
          {file ? (
            <span className="text-caption font-medium text-ink-primary">{file.name}</span>
          ) : (
            <span className="text-caption text-ink-tertiary">点击选择，或拖拽文件到此处</span>
          )}
          <span className="text-footnote text-ink-tertiary">PDF · DOCX · TXT · MD（≤20MB）</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        {/* 模式选择 */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('distill')}
            className={`flex-1 rounded-lg border px-3 py-2 text-caption font-medium surface-interactive ${
              mode === 'distill'
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-border text-ink-secondary hover:bg-surface-2'
            }`}
          >
            AI 提炼要点
          </button>
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`flex-1 rounded-lg border px-3 py-2 text-caption font-medium surface-interactive ${
              mode === 'full'
                ? 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-border text-ink-secondary hover:bg-surface-2'
            }`}
          >
            保留全文
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-caption text-ink-secondary hover:bg-surface-2 surface-interactive"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void go()}
            disabled={busy || !file}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-caption font-semibold text-white hover:bg-brand-600 disabled:opacity-50 surface-interactive"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            导入
          </button>
        </div>
      </div>
    </div>
  );
}
