/**
 * Skeleton — Brand-tinted shimmer 占位骨架 (Vercel/Linear class)
 *
 * 替代 Tailwind 默认 `animate-pulse` (透明度变化, 廉价感).
 * 走 globals.css 的 `.skeleton` (从左到右扫光 + 微 brand 色温 50%).
 *
 * 三档语义变体:
 *   - text   : 文本行 (12px 高, sm 圆角) — 用于 Title / 描述行
 *   - circle : 圆形 (头像/icon) — 配合 className 自定义尺寸
 *   - card   : 大卡片 (96px 高, lg 圆角) — 默认面板占位
 *   - none   : 纯 shimmer 容器, 由调用方完全自定义尺寸/形状
 *
 * 用法:
 *   <Skeleton variant="text" className="w-24" />
 *   <Skeleton variant="circle" className="h-10 w-10" />
 *   <Skeleton variant="card" className="h-40" />
 */

import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'circle' | 'card' | 'none';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

export function Skeleton({ className, variant = 'none', ...props }: SkeletonProps) {
  const variantClass =
    variant === 'text'
      ? 'skeleton-text'
      : variant === 'circle'
      ? 'skeleton-circle'
      : variant === 'card'
      ? 'skeleton-card'
      : '';
  return (
    <div
      className={cn('skeleton', variantClass, className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * SkeletonGroup — 常见复合骨架组合, 一行调用渲染头像 + 标题 + 副标
 *
 * 用法:
 *   <SkeletonGroup avatar lines={2} />
 *   <SkeletonGroup lines={3} className="max-w-md" />
 */
interface SkeletonGroupProps {
  /** 是否显示左侧圆形头像 (默认 false) */
  avatar?: boolean;
  /** 文本行数 (默认 2) */
  lines?: number;
  className?: string;
}

export function SkeletonGroup({ avatar = false, lines = 2, className }: SkeletonGroupProps) {
  return (
    <div className={cn('flex items-start gap-3', className)} aria-hidden="true">
      {avatar && <Skeleton variant="circle" className="h-10 w-10 shrink-0" />}
      <div className="flex-1 space-y-2 min-w-0">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            className={cn(
              'h-3',
              i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full',
            )}
          />
        ))}
      </div>
    </div>
  );
}
