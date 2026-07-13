'use client';

/**
 * BossAiDrawer · 右侧抽屉 (桌面 420px / 移动端全屏)
 *
 * § 灵魂入口对话窗
 * 内容: header + 首屏引导 (空态) + 消息列表 + 输入框
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Plus, Send, AlertCircle, Loader2, MapPin, ThumbsUp, Pencil, ThumbsDown, ChevronDown, ChevronRight, Database, Globe, Brain, Target, Lightbulb, Check, Square, RotateCcw, ImagePlus } from 'lucide-react';
import { useBossAi, type BossAiMessage, type BossAiTraceStep, type BossAiFeedbackOutcome } from './use-boss-ai';
import { getExamplePrompts, getPathLabel } from './example-prompts';
import { useBackDismiss } from '@/lib/hooks/use-back-dismiss';

export function BossAiDrawer() {
  const { isOpen, close, messages, streaming, error, send, regenerate, editAndResend, stop, newSession, pendingPrompt, consumePendingPrompt, submitFeedback } = useBossAi();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  // §多模态 · 待发送的图片 (data:image base64). 提交后清空.
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 读文件为 data URL; 限 4 张, 单张 ≤ 5MB, 仅 image/*.
  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = 4 - pendingImages.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024).slice(0, slots);
    const urls = await Promise.all(
      picked.map((f) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(f);
      })),
    );
    const valid = urls.filter((u) => u.startsWith('data:image'));
    if (valid.length > 0) setPendingImages((prev) => [...prev, ...valid].slice(0, 4));
  }

  // §上下文感知 · 按 path 动态生成示例 prompts + 显示"已带入上下文"标签
  const examplePrompts = useMemo(() => getExamplePrompts(pathname), [pathname]);
  const pathLabel = useMemo(() => getPathLabel(pathname), [pathname]);

  // §深链消费 · 外部组件 askAbout(prompt, { task, autoSend }) 触发后, drawer 自动 prefill / 自动发送
  useEffect(() => {
    if (!isOpen || !pendingPrompt) return;
    const consumed = consumePendingPrompt();
    if (!consumed) return;
    if (consumed.autoSend) {
      void send(consumed.text, { currentPath: pathname ?? undefined, currentTask: consumed.task });
    } else {
      setInput(consumed.text);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, pendingPrompt, consumePendingPrompt, send, pathname]);

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // 安卓硬件返回键 / 浏览器返回 → 关闭 (手机无 Esc 键)
  useBackDismiss(isOpen, close);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (streaming) return;
    const text = input;
    const imgs = pendingImages;
    if (!text.trim() && imgs.length === 0) return;
    setInput('');
    setPendingImages([]);
    void send(text, { currentPath: pathname ?? undefined, images: imgs.length > 0 ? imgs : undefined });
  }

  function onKeyDownInput(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl+Enter or Enter (无 shift) 发送
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  if (!isOpen) return null;

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* 遮罩 (仅 mobile, 点击关闭) */}
      <div
        aria-hidden
        onClick={close}
        className="fixed inset-0 z-[70] bg-black/30 md:hidden"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Tandem AI · 中央智囊"
        className={
          'fixed right-0 top-0 z-[71] flex h-full w-full flex-col bg-[rgb(var(--surface-1))] shadow-soft-xl ' +
          'md:w-[420px] md:border-l ' +
          'border-[rgb(var(--border-subtle))]'
        }
      >
        {/* ── Header ───────────────────────────────────── */}
        <header
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-headline text-ink-primary">Tandem AI · 中央智囊</h2>
            <p className="text-footnote text-ink-tertiary truncate inline-flex items-center gap-1">
              {pathLabel ? (
                <>
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  已带入「{pathLabel}」上下文
                </>
              ) : (
                <>方向不明就问我 · 基于公司 Memory + 当前 OKR</>
              )}
            </p>
          </div>
          {hasMessages && (
            <button
              type="button"
              onClick={newSession}
              aria-label="新建对话"
              title="新建对话"
              className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary surface-interactive"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="rounded-md p-1.5 text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary surface-interactive"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ── 消息区 (滚动) ──────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!hasMessages ? (
            <EmptyState
              prompts={examplePrompts}
              pathLabel={pathLabel}
              onPick={(t) => { setInput(t); inputRef.current?.focus(); }}
            />
          ) : (
            messages.map((m, i) => (
              <MessageBubble
                key={i}
                m={m}
                onFeedback={submitFeedback}
                canRegenerate={!streaming && i === messages.length - 1 && m.role === 'assistant' && m.content.trim().length > 0}
                onRegenerate={() => void regenerate({ currentPath: pathname ?? undefined })}
                canEdit={!streaming && m.role === 'user'}
                onEdit={(text) => void editAndResend(m.createdAt, text, { currentPath: pathname ?? undefined })}
              />
            ))
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-caption text-danger">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium">出错了</p>
                <p className="mt-0.5 break-words">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 输入框 ───────────────────────────────────── */}
        <form
          onSubmit={onSubmit}
          className="border-t p-3"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        >
          {/* §多模态 · 待发送图片缩略图 */}
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((src, i) => (
                <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg border" style={{ borderColor: 'rgb(var(--border-subtle))' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`附图 ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="移除图片"
                    className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/55 text-white hover:bg-black/75"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
          />
          <div className="relative flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={streaming || pendingImages.length >= 4}
              aria-label="添加图片"
              title={pendingImages.length >= 4 ? '最多 4 张' : '添加图片'}
              className={
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-ink-tertiary ' +
                'hover:bg-[rgb(var(--surface-2))] hover:text-ink-primary surface-interactive ' +
                'disabled:opacity-40 disabled:cursor-not-allowed'
              }
              style={{ borderColor: 'rgb(var(--border-subtle))' }}
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDownInput}
              rows={2}
              maxLength={2000}
              disabled={streaming}
              placeholder={streaming ? '正在思考...' : '问点什么? Enter 发送, Shift+Enter 换行'}
              className={
                'flex-1 resize-none rounded-lg border bg-[rgb(var(--surface-2))] px-3 py-2 ' +
                'text-body text-ink-primary placeholder:text-ink-tertiary ' +
                'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))] focus:border-transparent ' +
                'disabled:opacity-60 disabled:cursor-not-allowed'
              }
              style={{ borderColor: 'rgb(var(--border-subtle))' }}
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="停止生成"
                title="停止生成"
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ' +
                  'bg-[rgb(var(--surface-3))] text-ink-primary hover:bg-danger/10 hover:text-danger surface-interactive'
                }
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && pendingImages.length === 0}
                aria-label="发送"
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ' +
                  'bg-[rgb(var(--brand-500))] text-white hover:bg-[rgb(var(--brand-600))] ' +
                  'disabled:opacity-40 disabled:cursor-not-allowed surface-interactive'
                }
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-ink-tertiary">
            Tandem AI · 不替你签字, 给你判断框架. 所有问答进审计.
          </p>
        </form>
      </aside>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// 空态首屏
// ──────────────────────────────────────────────────────────────────
function EmptyState({
  prompts,
  pathLabel,
  onPick,
}: {
  prompts: { icon: string; text: string }[];
  pathLabel: string | null;
  onPick: (text: string) => void;
}) {
  return (
    <div className="py-2">
      <div className="rounded-2xl bg-gradient-to-br from-[rgb(var(--brand-50))] to-[rgb(var(--surface-2))] p-4 shadow-soft-xs">
        <p className="text-body text-ink-primary leading-relaxed">
          我是 <strong>Tandem AI · 中央智囊</strong>。
        </p>
        <p className="mt-2 text-caption text-ink-secondary leading-relaxed">
          基于公司当前 OKR、SOP、红线与历史决议。<br />
          你和你的搭子方向不明就问我 — 我给方向、优先级、判断框架。
        </p>
      </div>

      <p className="mt-4 mb-2 text-footnote text-ink-tertiary uppercase tracking-wider">
        {pathLabel ? `「${pathLabel}」上试试这样问` : '试试这样问'}
      </p>
      <div className="space-y-2">
        {prompts.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => onPick(p.text)}
            className={
              'flex w-full items-center gap-3 rounded-md border bg-[rgb(var(--surface-1))] px-3 py-2.5 text-left ' +
              'hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--surface-2))] transition-colors surface-interactive'
            }
            style={{ borderColor: 'rgb(var(--border-subtle))' }}
          >
            <span className="text-headline shrink-0" aria-hidden>{p.icon}</span>
            <span className="text-caption text-ink-primary">{p.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// §思考轨迹 · Gemini 式可见思考 (查知识库 / 联网 / 多步推理 / 核对 OKR …)
// ──────────────────────────────────────────────────────────────────
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

const PHASE_ICON: Record<string, React.ReactNode> = {
  knowledge: <Database className="h-3.5 w-3.5" />,
  search: <Globe className="h-3.5 w-3.5" />,
  reasoning: <Brain className="h-3.5 w-3.5" />,
  perception: <Target className="h-3.5 w-3.5" />,
  selfhint: <Lightbulb className="h-3.5 w-3.5" />,
};

function ThinkingTrace({ steps, streaming }: { steps: BossAiTraceStep[]; streaming: boolean }) {
  // 流式中默认展开 (看着它一步步做); 完成后默认折叠成一行摘要.
  const [expanded, setExpanded] = useState(streaming);
  // 流式结束的那一刻自动收起
  useEffect(() => { if (!streaming) setExpanded(false); }, [streaming]);

  return (
    <div className="mb-1.5 w-[85%] overflow-hidden rounded-2xl border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-1))]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left surface-interactive hover:bg-[rgb(var(--surface-2))]"
      >
        {streaming
          ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[rgb(var(--brand-500))]" aria-hidden />
          : <Sparkles className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--brand-500))]" aria-hidden />}
        <span className="flex-1 text-footnote font-medium text-ink-secondary">
          {streaming ? '正在思考…' : `思考过程 · ${steps.length} 步`}
        </span>
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" aria-hidden />}
      </button>
      {expanded && (
        <ol className="space-y-1.5 border-t border-[rgb(var(--border-subtle))] px-2.5 py-2">
          {steps.map((s) => (
            <li key={s.phase} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-[rgb(var(--brand-500))]">
                {PHASE_ICON[s.phase] ?? <Check className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-footnote font-medium text-ink-primary">{s.label}</p>
                {s.detail && <p className="text-[10px] leading-snug text-ink-tertiary">{s.detail}</p>}
                {s.tools && s.tools.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.tools.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full bg-[rgb(var(--brand-50))] px-1.5 py-0.5 text-[10px] font-medium text-[rgb(var(--brand-600))]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {s.sources && s.sources.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.sources.map((src, i) => (
                      <a
                        key={`${src.url}-${i}`}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${src.title}\n${src.url}`}
                        className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full bg-[rgb(var(--surface-2))] px-1.5 py-0.5 text-[10px] text-ink-secondary ring-1 ring-[rgb(var(--border-subtle))] hover:text-[rgb(var(--brand-600))] surface-interactive"
                      >
                        <Globe className="h-2.5 w-2.5 shrink-0" aria-hidden />
                        <span className="truncate">{src.title || hostOf(src.url)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 消息气泡
// ──────────────────────────────────────────────────────────────────
function MessageBubble({ m, onFeedback, canRegenerate = false, onRegenerate, canEdit = false, onEdit }: { m: BossAiMessage; onFeedback: (createdAt: number, outcome: BossAiFeedbackOutcome) => Promise<boolean>; canRegenerate?: boolean; onRegenerate?: () => void; canEdit?: boolean; onEdit?: (text: string) => void }) {
  const isUser = m.role === 'user';
  // 首字节前: 显示进度提示 (正在查公司数据…) 而非空气泡
  const showStatus = m.streaming && !m.content && Boolean(m.status);
  // §CA-13 闭环: assistant 完成消息且服务端给了 decisionId → 渲染反馈按钮
  const showFeedback = !isUser && !m.streaming && Boolean(m.decisionId) && m.content.trim().length > 0;
  const steps = !isUser ? m.steps ?? [] : [];
  const images = isUser ? m.images ?? [] : [];
  // §编辑重发 · inline 编辑态
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  if (editing) {
    return (
      <div className="flex w-full flex-col items-end">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          className="w-[85%] resize-none rounded-2xl border bg-[rgb(var(--surface-2))] px-3 py-2 text-body text-ink-primary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
          style={{ borderColor: 'rgb(var(--border-subtle))' }}
        />
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => { setEditing(false); setDraft(m.content); }}
            className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-ink-tertiary ring-1 ring-[rgb(var(--border-subtle))] hover:bg-[rgb(var(--surface-2))] surface-interactive"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!draft.trim()}
            onClick={() => { setEditing(false); onEdit?.(draft); }}
            className="rounded-full bg-[rgb(var(--brand-500))] px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40 surface-interactive"
          >
            发送
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {steps.length > 0 && <ThinkingTrace steps={steps} streaming={m.streaming === true} />}
      {images.length > 0 && (
        <div className="mb-1.5 flex max-w-[85%] flex-wrap justify-end gap-1.5">
          {images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`附图 ${i + 1}`} className="h-20 w-20 rounded-lg border object-cover" style={{ borderColor: 'rgb(var(--border-subtle))' }} />
          ))}
        </div>
      )}
      <div
        className={
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-wrap break-words ' +
          (isUser
            ? 'bg-[rgb(var(--brand-500))] text-white'
            : 'bg-[rgb(var(--surface-2))] text-ink-primary')
        }
      >
        {showStatus ? (
          <span className="inline-flex items-center gap-2 text-ink-tertiary">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            {m.status}
          </span>
        ) : (
          <>
            {m.content}
            {m.streaming && (
              <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current opacity-60" />
            )}
          </>
        )}
      </div>
      {showFeedback && (
        <FeedbackRow
          outcome={m.feedbackOutcome ?? 'pending'}
          submitting={m.feedbackSubmitting === true}
          onPick={(o) => { void onFeedback(m.createdAt, o); }}
        />
      )}
      {canRegenerate && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-ink-tertiary ring-1 ring-[rgb(var(--border-subtle))] hover:bg-[rgb(var(--surface-2))] hover:text-ink-primary surface-interactive"
          title="换个角度重答"
        >
          <RotateCcw className="h-3 w-3" />
          重新生成
        </button>
      )}
      {canEdit && onEdit && (
        <button
          type="button"
          onClick={() => { setDraft(m.content); setEditing(true); }}
          className="mt-1 inline-flex items-center gap-1 px-1 text-[10px] font-medium text-ink-tertiary opacity-0 transition-opacity hover:text-ink-primary group-hover:opacity-100 surface-interactive"
          title="编辑并重新提问"
        >
          <Pencil className="h-3 w-3" />
          编辑
        </button>
      )}
    </div>
  );
}

// §CA-13 反馈按钮组 (BossAI 浮窗版, 与 IM 版独立 — IM 用 messageId 反查, BossAI 用 SSE 回传的 decisionId)
function FeedbackRow({
  outcome,
  submitting,
  onPick,
}: {
  outcome: BossAiFeedbackOutcome;
  submitting: boolean;
  onPick: (o: Exclude<BossAiFeedbackOutcome, 'pending'>) => void;
}) {
  const settled = outcome !== 'pending';
  const items: Array<{ o: Exclude<BossAiFeedbackOutcome, 'pending'>; icon: React.ReactNode; label: string; color: 'emerald' | 'amber' | 'rose' }> = [
    { o: 'adopted', icon: <ThumbsUp className="h-3 w-3" />, label: '采纳', color: 'emerald' },
    { o: 'modified', icon: <Pencil className="h-3 w-3" />, label: '修改', color: 'amber' },
    { o: 'overruled', icon: <ThumbsDown className="h-3 w-3" />, label: '推翻', color: 'rose' },
  ];
  return (
    <div
      className="mt-1.5 flex items-center gap-1.5 pl-1"
      title={settled ? '已反馈 · 进入月度反思 (CA-13)' : '给反馈帮我月度自评'}
    >
      {items.map(({ o, icon, label, color }) => {
        const active = outcome === o;
        const muted = settled && !active;
        const colorClass = active
          ? color === 'emerald'
            ? 'bg-emerald-100 text-emerald-800 ring-emerald-400/80'
            : color === 'amber'
              ? 'bg-warning/10 text-warning ring-warning/50/80'
              : 'bg-rose-100 text-rose-800 ring-rose-400/80'
          : color === 'emerald'
            ? 'text-emerald-700 ring-emerald-300/60 hover:bg-emerald-50'
            : color === 'amber'
              ? 'text-warning ring-warning/30/60 hover:bg-warning/5'
              : 'text-rose-700 ring-rose-300/60 hover:bg-rose-50';
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            disabled={submitting || muted}
            className={
              'inline-flex items-center gap-1 rounded-full bg-[rgb(var(--surface-1))] px-2 py-0.5 text-[10px] font-medium ring-1 transition surface-interactive ' +
              `disabled:cursor-not-allowed ${muted ? 'opacity-30' : ''} ${colorClass}`
            }
            aria-pressed={active}
          >
            {submitting && active ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
