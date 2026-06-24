'use client';

/**
 * BossAiDrawer · 右侧抽屉 (桌面 420px / 移动端全屏)
 *
 * § 灵魂入口对话窗
 * 内容: header + 首屏引导 (空态) + 消息列表 + 输入框
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Plus, Send, AlertCircle, Loader2, MapPin, ThumbsUp, Pencil, ThumbsDown } from 'lucide-react';
import { useBossAi, type BossAiMessage, type BossAiFeedbackOutcome } from './use-boss-ai';
import { getExamplePrompts, getPathLabel } from './example-prompts';
import { useBackDismiss } from '@/lib/hooks/use-back-dismiss';

export function BossAiDrawer() {
  const { isOpen, close, messages, streaming, error, send, newSession, pendingPrompt, consumePendingPrompt, submitFeedback } = useBossAi();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!input.trim() || streaming) return;
    const text = input;
    setInput('');
    void send(text, { currentPath: pathname ?? undefined });
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
            messages.map((m, i) => <MessageBubble key={i} m={m} onFeedback={submitFeedback} />)
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
          <div className="relative flex items-end gap-2">
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
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="发送"
              className={
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ' +
                'bg-[rgb(var(--brand-500))] text-white hover:bg-[rgb(var(--brand-600))] ' +
                'disabled:opacity-40 disabled:cursor-not-allowed surface-interactive'
              }
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
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
// 消息气泡
// ──────────────────────────────────────────────────────────────────
function MessageBubble({ m, onFeedback }: { m: BossAiMessage; onFeedback: (createdAt: number, outcome: BossAiFeedbackOutcome) => Promise<boolean> }) {
  const isUser = m.role === 'user';
  // 首字节前: 显示进度提示 (正在查公司数据…) 而非空气泡
  const showStatus = m.streaming && !m.content && Boolean(m.status);
  // §CA-13 闭环: assistant 完成消息且服务端给了 decisionId → 渲染反馈按钮
  const showFeedback = !isUser && !m.streaming && Boolean(m.decisionId) && m.content.trim().length > 0;
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
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
