import { ReactNode } from 'react';
import Skeleton, { SkeletonText } from './Skeleton';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

export type AsyncStatus = 'loading' | 'error' | 'empty' | 'ok';

interface AsyncBoundaryProps {
  status: AsyncStatus;
  /** 自定义 loading（默认 3 行文本骨架） */
  skeleton?: ReactNode;
  /** 空态文案 */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** 错误 */
  errorMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * 五态完备边界（DESIGN.md §9）。统一处理 loading/empty/error/ok，杜绝白屏与无限 spinner。
 * 用法：<AsyncBoundary status={status} onRetry={reload}>{ok 内容}</AsyncBoundary>
 */
export default function AsyncBoundary({
  status, skeleton, emptyTitle = '暂无数据', emptyDescription, emptyAction,
  errorMessage, onRetry, children,
}: AsyncBoundaryProps) {
  if (status === 'loading') return <>{skeleton ?? <SkeletonText lines={3} />}</>;
  if (status === 'error') return <ErrorState message={errorMessage} onRetry={onRetry} />;
  if (status === 'empty') return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return <>{children}</>;
}

export { Skeleton };
