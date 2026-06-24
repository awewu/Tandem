/**
 * PageSkeleton · 路由级骨架占位 (供各路由的 loading.tsx 复用)
 *
 * Next.js loading.tsx 在路由段加载期间作为 Suspense fallback 即时渲染,
 * 消除移动端冷启动 / 切页的白屏 pop-in. 走品牌 shimmer (.skeleton).
 *
 * 变体:
 *   - dashboard : 标题 + 2 列统计卡 + 大卡 (OKR/KPI/分析/日报)
 *   - cards     : 标题 + 卡片网格
 *   - list      : 标题 + 行列表 (IM/邮箱/台账)
 *
 * 纯展示 (无客户端 hook), 可作 Server Component 直接用于 loading.tsx.
 */

import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';

type Variant = 'dashboard' | 'cards' | 'list';

function Header() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-5 w-40" />
        <Skeleton variant="text" className="h-3 w-56 max-w-[60vw]" />
      </div>
      <Skeleton variant="none" className="h-9 w-24 rounded-md" />
    </div>
  );
}

export function PageSkeleton({ variant = 'dashboard' }: { variant?: Variant }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6 space-y-4">
      <Header />

      {variant === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-20" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton variant="card" className="h-64 lg:col-span-2" />
            <Skeleton variant="card" className="h-64" />
          </div>
        </>
      )}

      {variant === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-40" />
          ))}
        </div>
      )}

      {variant === 'list' && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border p-3">
              <SkeletonGroup avatar lines={2} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
