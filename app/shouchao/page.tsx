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
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { enqueue as enqueueOffline, flushQueue } from '@/lib/shouchao/offline-queue';
import { BlockEditor } from '@/components/shouchao/block-editor';
import { PageTree } from '@/components/shouchao/page-tree';
import { DistillPanel } from '@/components/shouchao/distill-panel';
import {
  NotebookPen,
  Plus,
  PanelLeft,
  Database,
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
  Mic,
  Square,
  Camera,
  Sprout,
} from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  notebookId?: string;
  sourceUrl?: string;
  summary?: string;
  pinned?: boolean;
  archived?: boolean;
  sharedToPersona?: boolean;
  parentId?: string;
  icon?: string;
  coverUrl?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

type Toast = { kind: 'ok' | 'err'; text: string } | null;

// AI 创作洞察元信息 (对标 Get笔记 点评/拷问/发芽)
const INSIGHT_META: Record<
  'review' | 'challenge' | 'sprout',
  { label: string; hint: string }
> = {
  review: { label: '点评', hint: '挑出你记录里的亮点，指出哪里做得好' },
  challenge: { label: '拷问', hint: '像诤友一样指出漏洞，逼问得更清楚' },
  sprout: { label: '发芽', hint: '以这条为种子，长出跨领域的新认知' },
};

interface Notebook {
  id: string;
  name: string;
  icon?: string;
  noteCount: number;
}

export default function ShouchaoPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // 知识库分组 (对标 Get笔记 知识库). null=全部 / 'unfiled'=未分组 / id=某知识库
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebookFilter, setNotebookFilter] = useState<string | null>(null);
  // 页面树侧栏 (Notion 式嵌套导航) 开关
  const [treeOpen, setTreeOpen] = useState(true);
  // 数据库 (对标 Notion databases) 列表
  const [databases, setDatabases] = useState<Array<{ id: string; name: string; icon?: string }>>([]);
  // A2 个人蒸馏"整理建议"面板开关
  const [distillOpen, setDistillOpen] = useState(false);
  const router = useRouter();

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
  // AI 创作洞察 (点评/拷问/发芽): 产出不改原文, 显示在面板, 可追加到正文
  const [insightBusy, setInsightBusy] = useState<null | 'review' | 'challenge' | 'sprout'>(null);
  const [insight, setInsight] = useState<{ action: 'review' | 'challenge' | 'sprout'; text: string } | null>(null);
  const [clipOpen, setClipOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // 跨笔记 AI 问答 (Ask) · 问你的第二大脑
  const [askOpen, setAskOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [askAnswer, setAskAnswer] = useState('');
  const [askCitations, setAskCitations] = useState<{ index: number; id: string; title: string }[]>([]);
  // 引用高亮: 点击答案内 [n] 或来源 chip 时高亮对应来源 (null=无高亮)
  const [highlightCite, setHighlightCite] = useState<number | null>(null);
  const askAbortRef = useRef<AbortController | null>(null);

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

  // ---- 列表加载 (debounced search + 知识库过滤) ----
  const loadNotes = useCallback(
    async (q: string) => {
      try {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (notebookFilter) params.set('notebook', notebookFilter);
        const r = await fetch(`/api/shouchao/notes?${params.toString()}`);
        if (r.ok) {
          const d = await r.json();
          setNotes(d.notes ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [notebookFilter],
  );

  // ---- 知识库列表加载 ----
  const loadNotebooks = useCallback(async () => {
    try {
      const r = await fetch('/api/shouchao/notebooks');
      if (r.ok) {
        const d = await r.json();
        setNotebooks(d.notebooks ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ---- 数据库 (Notion databases): 加载列表 ----
  const loadDatabases = useCallback(async () => {
    try {
      const r = await fetch('/api/shouchao/databases', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setDatabases(
        (d.databases ?? []).map((x: { id: string; name: string; icon?: string }) => ({ id: x.id, name: x.name, icon: x.icon })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadNotebooks();
    void loadDatabases();
  }, [loadNotebooks, loadDatabases]);

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
    setInsight(null);
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
          parentId: seed?.parentId,
          icon: seed?.icon,
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

  // ---- 知识库: 新建 (轻量 prompt) ----
  async function createNotebookPrompt() {
    const name = window.prompt('新建知识库名称')?.trim();
    if (!name) return;
    try {
      const r = await fetch('/api/shouchao/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error('create failed');
      await loadNotebooks();
      showToast('ok', `已创建知识库「${name}」`);
    } catch {
      showToast('err', '创建知识库失败');
    }
  }

  // ---- 数据库: 新建并跳转 ----
  async function createDatabase() {
    try {
      const r = await fetch('/api/shouchao/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: '未命名数据库' }),
      });
      if (!r.ok) throw new Error('create failed');
      const d = await r.json();
      router.push(`/shouchao/db/${d.database.id}`);
    } catch {
      showToast('err', '创建数据库失败');
    }
  }

  // ---- 知识库: 把当前笔记移入/移出 (null = 移出到未分组) ----
  async function moveActiveToNotebook(notebookId: string | null) {
    if (!activeId) return;
    try {
      const r = await fetch(`/api/shouchao/notes/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId }),
      });
      if (!r.ok) throw new Error('move failed');
      const d = await r.json();
      const updated: Note = d.note;
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      void loadNotebooks();
      showToast('ok', notebookId ? '已移入知识库' : '已移出到未分组');
    } catch {
      showToast('err', '操作失败');
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
      const defaultNotebookId =
        notebookFilter && notebookFilter !== 'unfiled' ? notebookFilter : undefined;
      const r = await fetch('/api/shouchao/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: body, tags: [], notebookId: defaultNotebookId }),
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
  }, [quick, quickBusy, showToast, notebookFilter]);

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

  // ---- AI 创作洞察 (点评/拷问/发芽) · 产出不改原文, 显示在面板 ----
  async function runInsight(action: 'review' | 'challenge' | 'sprout') {
    if (!content.trim()) {
      showToast('err', '正文为空');
      return;
    }
    setInsightBusy(action);
    setInsight(null);
    try {
      const r = await fetch('/api/shouchao/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, content }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? 'AI 失败');
      setInsight({ action, text: d.result ?? '' });
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'AI 失败');
    } finally {
      setInsightBusy(null);
    }
  }

  // 把洞察追加到正文末尾 (作为引用块), 让创作沉淀进笔记
  function appendInsightToContent() {
    if (!insight) return;
    const label = INSIGHT_META[insight.action].label;
    const block = `\n\n> **AI ${label}**\n>\n${insight.text.split('\n').map((l) => `> ${l}`).join('\n')}\n`;
    setContent((prev) => prev + block);
    markDirty();
    setInsight(null);
    showToast('ok', '已追加到正文');
  }

  // ---- 跨笔记 AI 问答 (Ask) · 问你的第二大脑 · SSE 流式 ----
  async function askNotes() {
    const q = askQuestion.trim();
    if (!q || askBusy) return;
    setAskBusy(true);
    setAskAnswer('');
    setAskCitations([]);
    setHighlightCite(null);
    askAbortRef.current?.abort();
    const ctrl = new AbortController();
    askAbortRef.current = ctrl;
    try {
      const r = await fetch('/api/shouchao/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });
      // 校验失败等非流式错误 (400/401): 走 JSON 分支
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? 'AI 问答失败');
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamErr = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          let evt: { citations?: typeof askCitations; content?: string; error?: string; done?: boolean };
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          if (Array.isArray(evt.citations)) setAskCitations(evt.citations);
          if (typeof evt.content === 'string') setAskAnswer((prev) => prev + evt.content);
          if (typeof evt.error === 'string') streamErr = evt.error;
          if (evt.done) break;
        }
      }
      if (streamErr) throw new Error(streamErr);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 被新提问/卸载取消
      showToast('err', e instanceof Error ? e.message : 'AI 问答失败');
    } finally {
      if (askAbortRef.current === ctrl) askAbortRef.current = null;
      setAskBusy(false);
    }
  }

  // 卸载/关闭页面时中止在途流
  useEffect(() => () => askAbortRef.current?.abort(), []);

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

  // 答案内 [n] 渲染为可点击引用: 点击高亮对应来源 chip (再点取消)
  function renderAnswerWithCitations(text: string) {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((seg, i) => {
      const m = seg.match(/^\[(\d+)\]$/);
      if (!m) return <span key={i}>{seg}</span>;
      const n = Number(m[1]);
      const known = askCitations.some((c) => c.index === n);
      if (!known) return <span key={i}>{seg}</span>;
      return (
        <button
          key={i}
          type="button"
          onClick={() => setHighlightCite((cur) => (cur === n ? null : n))}
          className={`mx-0.5 inline-flex items-center rounded font-mono align-baseline surface-interactive ${
            highlightCite === n
              ? 'bg-brand-500 px-1 text-white'
              : 'px-0.5 text-brand-500 hover:bg-brand-50'
          }`}
          title="高亮对应来源"
        >
          [{n}]
        </button>
      );
    });
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTreeOpen((v) => !v)}
            title={treeOpen ? '隐藏页面树' : '显示页面树'}
            className={`hidden rounded-md border border-border p-1.5 surface-interactive md:inline-flex ${treeOpen ? 'bg-brand-50 text-brand-600' : 'bg-surface-1 text-ink-tertiary hover:bg-surface-2'}`}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 返回 Tandem
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
      {/* ── 页面树侧栏 (Notion 式嵌套导航, md+ 显示) ── */}
      {treeOpen && (
        <aside className="hidden w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface-1/60 md:flex">
          <PageTree
            notes={notes}
            activeId={activeId}
            onSelect={(id) => {
              const n = notes.find((x) => x.id === id);
              if (n) selectNote(n);
            }}
            onAddChild={(parentId) => void createNote({ parentId })}
            onAddRoot={() => void createNote()}
          />
        </aside>
      )}

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
                  onClick={() => setVoiceOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                  title="语音转笔记 (录音后自动转写)"
                >
                  <Mic className="h-3.5 w-3.5" /> 语音
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                  title="拍照/图片转笔记 (识别图中文字)"
                >
                  <Camera className="h-3.5 w-3.5" /> 拍照
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

          {/* 知识库分组条 (对标 Get笔记 知识库) */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setNotebookFilter(null)}
              className={`rounded-full px-2.5 py-1 text-footnote surface-interactive ${
                notebookFilter === null ? 'bg-brand-500 text-white' : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setNotebookFilter('unfiled')}
              className={`rounded-full px-2.5 py-1 text-footnote surface-interactive ${
                notebookFilter === 'unfiled' ? 'bg-brand-500 text-white' : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
              }`}
            >
              未分组
            </button>
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                type="button"
                onClick={() => setNotebookFilter(nb.id)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-footnote surface-interactive ${
                  notebookFilter === nb.id ? 'bg-brand-500 text-white' : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
                }`}
              >
                {nb.icon && <span>{nb.icon}</span>}
                {nb.name}
                <span className={notebookFilter === nb.id ? 'text-white/70' : 'text-ink-tertiary'}>{nb.noteCount}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => void createNotebookPrompt()}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-footnote text-ink-tertiary hover:border-brand-300 hover:text-brand-600 surface-interactive"
              title="新建知识库"
            >
              <Plus className="h-3 w-3" /> 知识库
            </button>
          </div>

          {/* 数据库条 (对标 Notion databases) */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-footnote text-ink-tertiary">
              <Database className="h-3.5 w-3.5" /> 数据库
            </span>
            {databases.map((db) => (
              <Link
                key={db.id}
                href={`/shouchao/db/${db.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-footnote text-ink-secondary hover:bg-surface-3 surface-interactive"
              >
                {db.icon && <span>{db.icon}</span>}
                {db.name}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void createDatabase()}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-footnote text-ink-tertiary hover:border-brand-300 hover:text-brand-600 surface-interactive"
              title="新建数据库"
            >
              <Plus className="h-3 w-3" /> 数据库
            </button>
            <button
              type="button"
              onClick={() => setDistillOpen(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50/40 px-2.5 py-1 text-footnote font-medium text-brand-600 hover:bg-brand-50 surface-interactive"
              title="让 AI 整理你已授权的笔记（仅个人范围）"
            >
              <Sparkles className="h-3 w-3" /> 整理建议
            </button>
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
                    {askBusy ? '思考中' : '提问'}
                  </button>
                </div>

                {/* 回答 + 引用溯源 (流式: 先显来源, 再边生成边显答案) */}
                {(askAnswer || askCitations.length > 0 || askBusy) && (
                  <div className="mt-3 rounded-lg border border-border bg-surface-2/40 p-3">
                    <div className="whitespace-pre-wrap text-caption leading-relaxed text-ink-primary">
                      {askAnswer ? (
                        <>
                          {renderAnswerWithCitations(askAnswer)}
                          {askBusy && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-brand-400 align-middle" />}
                        </>
                      ) : (
                        <span className="text-ink-tertiary">正在检索你的笔记并组织回答…</span>
                      )}
                    </div>
                    {askCitations.length > 0 && (
                      <div className="mt-2.5 border-t border-border pt-2">
                        <p className="mb-1.5 text-footnote text-ink-tertiary">引用来源（点 [n] 高亮 · 点卡片打开）</p>
                        <div className="flex flex-wrap gap-1.5">
                          {askCitations.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => openCitation(c.id)}
                              onMouseEnter={() => setHighlightCite(c.index)}
                              onMouseLeave={() => setHighlightCite((cur) => (cur === c.index ? null : cur))}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-footnote surface-interactive ${
                                highlightCite === c.index
                                  ? 'border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
                                  : 'border-border bg-surface-1 text-ink-secondary hover:border-brand-300 hover:text-brand-600'
                              }`}
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
      </div>

      {/* A2 · 整理建议面板 (个人蒸馏) */}
      {distillOpen && <DistillPanel onClose={() => setDistillOpen(false)} />}

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
                {/* AI 工具条: 加工 (改写笔记) + 创作 (产出洞察不改原文) */}
                <div className="flex flex-wrap items-center gap-2">
                  <AiButton icon={Sparkles} label="AI 总结" busy={aiBusy === 'summarize'} onClick={() => runAi('summarize')} />
                  <AiButton icon={Wand2} label="润色" busy={aiBusy === 'polish'} onClick={() => runAi('polish')} />
                  <AiButton icon={Tags} label="生成标签" busy={aiBusy === 'tags'} onClick={() => runAi('tags')} />
                  <span className="h-4 w-px bg-border" />
                  <AiButton icon={Sparkles} label="点评" busy={insightBusy === 'review'} onClick={() => runInsight('review')} />
                  <AiButton icon={MessageCircleQuestion} label="拷问" busy={insightBusy === 'challenge'} onClick={() => runInsight('challenge')} />
                  <AiButton icon={Sprout} label="发芽" busy={insightBusy === 'sprout'} onClick={() => runInsight('sprout')} />
                </div>

                {/* AI 创作洞察面板 (点评/拷问/发芽 · 不改原文) */}
                {insight && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-footnote font-semibold text-brand-700">
                        <Sprout className="h-3.5 w-3.5" /> AI {INSIGHT_META[insight.action].label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={appendInsightToContent}
                          className="rounded-md px-2 py-1 text-footnote font-medium text-brand-600 hover:bg-brand-100 surface-interactive"
                        >
                          追加到正文
                        </button>
                        <button
                          type="button"
                          onClick={() => setInsight(null)}
                          className="rounded-md p-1 text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary surface-interactive"
                          aria-label="关闭"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-caption leading-relaxed text-ink-secondary">{insight.text}</p>
                  </div>
                )}

                {/* 知识库归属 */}
                <div className="flex items-center gap-2">
                  <NotebookPen className="h-3.5 w-3.5 text-ink-tertiary" />
                  <select
                    value={active?.notebookId ?? ''}
                    onChange={(e) => void moveActiveToNotebook(e.target.value || null)}
                    className="rounded-md border border-border bg-surface-1 px-2 py-1 text-footnote text-ink-secondary focus:border-brand-400 focus:outline-none"
                  >
                    <option value="">未分组</option>
                    {notebooks.map((nb) => (
                      <option key={nb.id} value={nb.id}>
                        {nb.icon ? `${nb.icon} ` : ''}{nb.name}
                      </option>
                    ))}
                  </select>
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
                        onUploadImage={async (file) => {
                          const fd = new FormData();
                          fd.append('file', file);
                          if (activeId) fd.append('noteId', activeId);
                          try {
                            const res = await fetch('/api/shouchao/attachments', {
                              method: 'POST',
                              body: fd,
                              credentials: 'include',
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok || !data.ok) {
                              showToast('err', data.error || '图片上传失败');
                              return null;
                            }
                            return { url: data.attachment.url as string, alt: data.attachment.name as string };
                          } catch {
                            showToast('err', '图片上传失败');
                            return null;
                          }
                        }}
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

      {/* 语音转笔记弹窗 */}
      {voiceOpen && (
        <VoiceDialog
          onClose={() => setVoiceOpen(false)}
          onTranscribed={async ({ text, mode }) => {
            setVoiceOpen(false);
            const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
            const title = firstLine.replace(/^#+\s*/, '').slice(0, 30) || (mode === 'meeting' ? '会议纪要' : '语音笔记');
            await createNote({ title, content: text, tags: [mode === 'meeting' ? '会议纪要' : '语音'] });
            showToast('ok', mode === 'meeting' ? '已生成会议纪要' : '语音已转成笔记');
          }}
          onError={(m) => showToast('err', m)}
        />
      )}

      {/* 拍照记弹窗 (图片 OCR 转笔记) */}
      {photoOpen && (
        <PhotoDialog
          onClose={() => setPhotoOpen(false)}
          onRecognized={async ({ text }) => {
            setPhotoOpen(false);
            const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
            const title = firstLine.replace(/^#+\s*/, '').slice(0, 30) || '拍照笔记';
            await createNote({ title, content: text, tags: ['拍照'] });
            showToast('ok', '图片已转成笔记');
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
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
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

function VoiceDialog({
  onClose,
  onTranscribed,
  onError,
}: {
  onClose: () => void;
  onTranscribed: (res: { text: string; mode: 'note' | 'meeting' }) => void;
  onError: (msg: string) => void;
}) {
  type Phase = 'idle' | 'recording' | 'recorded' | 'transcribing';
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [polish, setPolish] = useState(true);
  const [mode, setMode] = useState<'note' | 'meeting'>('note');
  const [supported, setSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setSupported(false);
    }
    return () => stopTracks();
  }, [stopTracks]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setPhase('recorded');
        stopTracks();
      };
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setPhase('recording');
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      onError('无法访问麦克风，请在浏览器中授予录音权限');
    }
  }

  function stopRecording() {
    try {
      recorderRef.current?.stop();
    } catch {
      stopTracks();
      setPhase('recorded');
    }
  }

  async function transcribe() {
    const blob = blobRef.current;
    if (!blob || blob.size === 0) {
      onError('没有录到声音，请重试');
      return;
    }
    setPhase('transcribing');
    try {
      const fd = new FormData();
      fd.append('file', blob, 'audio.webm');
      if (mode === 'meeting') {
        fd.append('meeting', 'true');
      } else {
        fd.append('polish', polish ? 'true' : 'false');
      }
      fd.append('language', 'zh');
      const r = await fetch('/api/shouchao/transcribe', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok || !d.text) throw new Error(d.error ?? '转写失败');
      onTranscribed({ text: d.text as string, mode });
    } catch (e) {
      onError(e instanceof Error ? e.message : '转写失败');
      setPhase('recorded');
    }
  }

  function reset() {
    blobRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setPhase('idle');
  }

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface-1 p-6 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <Mic className="h-5 w-5 text-brand-500" />
          <h2 className="text-headline font-bold text-ink-primary">语音转笔记</h2>
        </div>

        {!supported ? (
          <p className="text-caption text-danger">
            当前浏览器不支持录音，请改用 Chrome/Safari 等现代浏览器，或用「导入文件」上传音频。
          </p>
        ) : (
          <>
            <p className="mb-3 text-footnote text-ink-tertiary">
              对着麦克风口述，停止后自动转写成文字。可整理成口述笔记或会议纪要。
            </p>

            {/* 模式: 口述笔记 / 会议纪要 */}
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('note')}
                className={`flex-1 rounded-lg border px-3 py-2 text-caption font-medium surface-interactive ${
                  mode === 'note' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-border text-ink-secondary hover:bg-surface-2'
                }`}
              >
                口述笔记
              </button>
              <button
                type="button"
                onClick={() => setMode('meeting')}
                className={`flex-1 rounded-lg border px-3 py-2 text-caption font-medium surface-interactive ${
                  mode === 'meeting' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-border text-ink-secondary hover:bg-surface-2'
                }`}
              >
                会议纪要
              </button>
            </div>

            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-2 py-8">
              {phase === 'recording' ? (
                <>
                  <div className="flex items-center gap-2 text-title font-bold tabular-nums text-danger">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
                    {mmss}
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-1.5 rounded-full bg-danger px-5 py-2.5 text-caption font-semibold text-white hover:opacity-90 surface-interactive"
                  >
                    <Square className="h-4 w-4" /> 停止录音
                  </button>
                </>
              ) : phase === 'transcribing' ? (
                <div className="flex items-center gap-2 text-caption text-ink-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在转写…
                </div>
              ) : phase === 'recorded' ? (
                <>
                  <div className="text-caption text-ink-secondary">已录制 {mmss}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-lg border border-border px-4 py-2 text-caption text-ink-secondary hover:bg-surface-1 surface-interactive"
                    >
                      重录
                    </button>
                    <button
                      type="button"
                      onClick={() => void transcribe()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-caption font-semibold text-white hover:bg-brand-600 surface-interactive"
                    >
                      <Check className="h-4 w-4" /> 转成笔记
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-5 py-2.5 text-caption font-semibold text-white hover:bg-brand-600 surface-interactive"
                >
                  <Mic className="h-4 w-4" /> 开始录音
                </button>
              )}
            </div>

            {mode === 'note' ? (
              <label className="mt-4 flex items-center gap-2 text-caption text-ink-secondary">
                <input
                  type="checkbox"
                  checked={polish}
                  onChange={(e) => setPolish(e.target.checked)}
                  className="accent-brand-500"
                />
                AI 润色（去口头语、修错别字、分段）
              </label>
            ) : (
              <p className="mt-4 text-footnote text-ink-tertiary">
                会议纪要模式：AI 会整理成摘要 / 讨论要点 / 决策 / 待办结构。
              </p>
            )}
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-caption text-ink-secondary hover:bg-surface-2 surface-interactive"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoDialog({
  onClose,
  onRecognized,
  onError,
}: {
  onClose: () => void;
  onRecognized: (res: { text: string }) => void;
  onError: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      onError('请选择图片文件');
      return;
    }
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function go() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/shouchao/ocr', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok || !d.text) throw new Error(d.error ?? '识别失败');
      onRecognized({ text: d.text as string });
    } catch (e) {
      onError(e instanceof Error ? e.message : '识别失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface-1 p-6 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-5 w-5 text-brand-500" />
          <h2 className="text-headline font-bold text-ink-primary">拍照记</h2>
        </div>
        <p className="mb-3 text-footnote text-ink-tertiary">
          拍课本/白板/文档/名片，AI 识别图中文字转成可编辑笔记。手机端可直接调用相机。
        </p>

        {preview ? (
          <div className="overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="预览" className="max-h-64 w-full object-contain bg-surface-2" />
          </div>
        ) : (
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
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragActive ? 'border-brand-400 bg-brand-50' : 'border-border hover:bg-surface-2'
            }`}
          >
            <Camera className="h-6 w-6 text-ink-tertiary" />
            <span className="text-caption text-ink-tertiary">点击选择图片，或拖拽到此处</span>
            <span className="text-footnote text-ink-tertiary">PNG · JPG · WEBP（≤10MB）</span>
          </button>
        )}

        {/* 相册选择 (通用) */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {/* 相机拍摄 (移动端 capture) */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-caption font-medium text-ink-secondary hover:bg-surface-2 surface-interactive"
          >
            <Camera className="h-4 w-4" /> 拍照
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-caption font-medium text-ink-secondary hover:bg-surface-2 surface-interactive"
          >
            <FileUp className="h-4 w-4" /> 从相册选
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
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
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            识别转笔记
          </button>
        </div>
      </div>
    </div>
  );
}
