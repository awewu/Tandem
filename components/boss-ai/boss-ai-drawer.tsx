'use client';

/**
 * BossAiDrawer · 右侧抽屉 (桌面 420px / 移动端全屏)
 *
 * § 灵魂入口对话窗
 * 内容: header + 首屏引导 (空态) + 消息列表 + 输入框
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Plus, Send, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { useBossAi, type BossAiMessage } from './use-boss-ai';
import { getExamplePrompts, getPathLabel } from './example-prompts';

export function BossAiDrawer() {
  const { isOpen, close, messages, streaming, error, send, newSession } = useBossAi();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // §上下文感知 · 按 path 动态生成示例 prompts + 显示"已带入上下文"标签
  const examplePrompts = useMemo(() => getExamplePrompts(pathname), [pathname]);
  const pathLabel = useMemo(() => getPathLabel(pathname), [pathname]);

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

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
        aria-label="Tandem AI · 老板的搭子"
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
            <h2 className="text-headline text-ink-primary">Tandem AI · 老板的搭子</h2>
            <p className="text-footnote text-ink-tertiary truncate inline-flex items-center gap-1">
              {pathLabel ? (
                <>
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  已带入「{pathLabel}」上下文
                </>
              ) : (
                <>方向不明就问我 · 基于老板 Persona + 当前 OKR</>
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
            messages.map((m, i) => <MessageBubble key={i} m={m} />)
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
            老板分身 · 不替你签字, 给你判断框架. 所有问答进审计.
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
          我是 <strong>Tandem AI · 老板的分身</strong>。
        </p>
        <p className="mt-2 text-caption text-ink-secondary leading-relaxed">
          基于老板的决策套路、当前公司 OKR、公司 SOP 与红线。<br />
          你方向不明就问我 — 我给你方向、优先级、判断框架。
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
function MessageBubble({ m }: { m: BossAiMessage }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-wrap break-words ' +
          (isUser
            ? 'bg-[rgb(var(--brand-500))] text-white'
            : 'bg-[rgb(var(--surface-2))] text-ink-primary')
        }
      >
        {m.content}
        {m.streaming && (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current opacity-60" />
        )}
      </div>
    </div>
  );
}
