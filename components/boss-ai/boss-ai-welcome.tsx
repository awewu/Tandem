'use client';

/**
 * BossAiWelcome · 首次使用 onboarding 卡片
 *
 * §灵魂入口推广 · 同事第一次进 Tandem 看到的"试试问老板"提示
 *
 * 触发逻辑:
 *   - 首次启动: localStorage 没 `tandem.bossAi.welcomed` 则展示
 *   - 用户已经打开过 BossAI 一次也算"用过", 自动 dismiss
 *   - 用户点 '稍后' / × 也 dismiss
 *
 * UI 设计 (CHARTER-UI-V1 严格遵守):
 *   - rounded-2xl + shadow-soft-lg (§1.4 §1.3)
 *   - bg / border / text 全 CSS var (§1.5)
 *   - text-headline / text-body / text-caption (§1.2)
 *   - 圆角胶囊 CTA, brand-500 主 + 透明次 (§1.4)
 *   - 位置: 浮动按钮上方, 不遮挡内容
 *   - 进出动效用 globals.css 的 fade-in-up
 */

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useBossAi } from './use-boss-ai';

const LS_KEY = 'tandem.bossAi.welcomed';

export function BossAiWelcome() {
  const { isOpen, messages, askAbout } = useBossAi();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 决定是否展示
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    try {
      const already = window.localStorage.getItem(LS_KEY);
      if (already) return;
      // 用户已经有对话历史 = 用过, 不再 onboard
      if (messages.length > 0) {
        window.localStorage.setItem(LS_KEY, '1');
        return;
      }
      // 延迟 2.5s 出现, 不打断同事第一秒的注意力
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    } catch {
      // localStorage 异常 (隐私模式), 不弹
    }
  }, [messages.length]);

  // BossAI 打开后自动 dismiss
  useEffect(() => {
    if (isOpen && visible) dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(LS_KEY, '1');
    } catch { /* ignore */ }
  }

  function tryIt() {
    askAbout('我刚加入 Tandem, 我应该先做什么?', { autoSend: false });
    dismiss();
  }

  if (!mounted || !visible) return null;

  return (
    <aside
      role="dialog"
      aria-label="Tandem AI 欢迎"
      className={
        // 位置: FAB (bottom-5/80 + h-12) 上方 + 间距 16px
        'fixed right-5 z-[59] w-[320px] max-w-[calc(100vw-2.5rem)] ' +
        // mobile: tab bar 56 + FAB 12 + gap = ~150 ; desktop: bottom-6 + FAB 12 + gap = 80
        'bottom-[150px] md:bottom-[88px] ' +
        // 卡片样式 (charter §1.3 §1.4 §1.5)
        'rounded-2xl border bg-[rgb(var(--surface-1))] shadow-soft-lg ' +
        // 进入动画 (globals.css)
        'animate-fade-in-up'
      }
      style={{ borderColor: 'rgb(var(--border-subtle))' }}
    >
      {/* 头 */}
      <header className="flex items-start gap-3 p-4 pb-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-headline text-ink-primary">试试 Tandem AI</h3>
          <p className="text-footnote text-ink-tertiary">中央智囊 · 永远在线</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭引导"
          className="rounded-md p-1 text-ink-tertiary hover:bg-[rgb(var(--surface-3))] hover:text-ink-primary surface-interactive"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* 内容 */}
      <div className="px-4 pb-3">
        <p className="text-body text-ink-secondary leading-relaxed">
          方向不明就问我。任何页面右下角点 <span className="text-ink-primary font-medium">「问 Tandem」</span>
          {' '}或按 <kbd className="rounded border border-[rgb(var(--border-subtle))] bg-[rgb(var(--surface-2))] px-1.5 py-0.5 font-mono text-footnote">⌘J</kbd>。
        </p>
      </div>

      {/* CTA */}
      <div className="flex items-center gap-2 border-t px-3 py-2.5"
           style={{ borderColor: 'rgb(var(--border-subtle))' }}>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md px-3 py-1.5 text-caption text-ink-secondary hover:bg-[rgb(var(--surface-3))] hover:text-ink-primary surface-interactive"
        >
          稍后
        </button>
        <button
          type="button"
          onClick={tryIt}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[rgb(var(--brand-500))] px-3 py-1.5 text-caption font-semibold text-white hover:bg-[rgb(var(--brand-600))] surface-interactive"
        >
          <Sparkles className="h-3.5 w-3.5" />
          试试 Tandem AI
        </button>
      </div>
    </aside>
  );
}
