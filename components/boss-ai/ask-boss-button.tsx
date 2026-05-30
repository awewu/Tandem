'use client';

/**
 * AskBossButton · 任何页面/卡片可下落的"问老板"深链按钮
 *
 * 调用 useBossAi().askAbout(prompt, { task, autoSend }) 打开抽屉 + prefill.
 *
 * 设计 (CHARTER-UI-V1 严格遵守):
 *   - 3 variant: 'inline' (内联文字链) | 'icon' (圆形小图标) | 'pill' (胶囊小按钮)
 *   - 色: brand-50 底 + brand-700 文 + brand-300 边 (柔和品牌色, 不抢主 CTA)
 *   - 字体: 'pill'/'inline' 用 text-caption; 'icon' 无文字
 *   - hover: 浅一档
 *   - 不破坏父布局, 永远 inline-flex
 *
 * 用法:
 *   <AskBossButton prompt="这个 KR 怎么推进?" task={`KR: ${kr.title}`} />
 *   <AskBossButton variant="icon" prompt="..." />
 *   <AskBossButton variant="inline" prompt="...">想想这件事的优先级</AskBossButton>
 */

import { Sparkles } from 'lucide-react';
import { useBossAi } from './use-boss-ai';
import { cn } from '@/lib/utils';

type Variant = 'pill' | 'icon' | 'inline';

interface AskBossButtonProps {
  /** 预填的提问文本 */
  prompt: string;
  /** 父任务上下文 (注入 service 端 currentTask) */
  task?: string;
  /** true = 自动发送 (适合"一键问问"), false = 仅 prefill 让用户编辑 (默认) */
  autoSend?: boolean;
  /** 显示样式 */
  variant?: Variant;
  /** 自定义按钮文字 (variant='pill'/'inline' 默认 '问老板') */
  children?: React.ReactNode;
  /** 额外 className (谨慎用, 别破坏 charter token) */
  className?: string;
  /** aria-label (icon variant 必须给) */
  'aria-label'?: string;
}

export function AskBossButton({
  prompt,
  task,
  autoSend = false,
  variant = 'pill',
  children,
  className,
  'aria-label': ariaLabel,
}: AskBossButtonProps) {
  const { askAbout } = useBossAi();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 父若是 link 不跳走
    askAbout(prompt, { task, autoSend });
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel ?? '问老板'}
        title={ariaLabel ?? '问老板'}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-full',
          'border border-[rgb(var(--brand-200))] bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]',
          'hover:border-[rgb(var(--brand-300))] hover:bg-[rgb(var(--brand-100))] hover:text-[rgb(var(--brand-700))]',
          'surface-interactive shadow-soft-xs',
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1 text-caption text-[rgb(var(--brand-700))]',
          'hover:text-[rgb(var(--brand-800))] hover:underline',
          'surface-interactive',
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {children ?? '问老板'}
      </button>
    );
  }

  // pill (default)
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md',
        'border border-[rgb(var(--brand-300))] bg-[rgb(var(--brand-50))]',
        'px-2.5 py-1 text-caption font-medium text-[rgb(var(--brand-700))]',
        'hover:bg-[rgb(var(--brand-100))] hover:border-[rgb(var(--brand-400))]',
        'surface-interactive shadow-soft-xs',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {children ?? '问老板'}
    </button>
  );
}
