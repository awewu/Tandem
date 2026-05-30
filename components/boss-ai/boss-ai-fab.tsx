'use client';

/**
 * BossAiFab · 全局浮动按钮 ("问老板")
 *
 * § 灵魂入口 · 右下角固定 · 全应用可见 · 含 mobile
 * 快捷键: ⌘/Ctrl + J
 */

import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { useBossAi } from './use-boss-ai';

export function BossAiFab() {
  const { isOpen, toggle } = useBossAi();

  // ⌘/Ctrl + J 唤起
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? '关闭 Tandem AI · 老板的搭子' : '打开 Tandem AI · 老板的搭子'}
      aria-pressed={isOpen}
      title="问老板 (⌘J)"
      className={
        // 桌面: 右下 24px · mobile: 右下 80px (避开底部 tab bar 56px + 间距)
        'fixed right-5 bottom-5 z-[60] flex items-center gap-2 ' +
        'md:bottom-6 ' +
        // 桌面胶囊形, mobile 也保持胶囊 (但稍小)
        'h-12 rounded-full px-4 ' +
        // 颜色 · 用 brand-500 (企业红) + 在 mobile 上稍微抬高避开 tab bar (pb-[56px] on main, fab 不在 main 内, 是 fixed)
        'bg-[rgb(var(--brand-500))] text-white shadow-soft-lg ' +
        'hover:bg-[rgb(var(--brand-600))] active:scale-95 transition-transform duration-fast ' +
        // mobile tab bar 56px + 间距 24px = 80
        'bottom-[80px] md:bottom-6 ' +
        'surface-interactive'
      }
      style={{ paddingRight: '14px' }}
    >
      <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden md:inline text-headline font-semibold whitespace-nowrap">问老板</span>
      <span className="hidden md:inline text-footnote font-mono opacity-70 ml-1">⌘J</span>
    </button>
  );
}
