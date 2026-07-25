'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const modalSizeClass = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function FixedModal({
  title,
  children,
  footer,
  onClose,
  size = 'lg',
  className,
  bodyClassName,
  footerClassName,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: keyof typeof modalSizeClass;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 px-4 py-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'mx-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl bg-[rgb(var(--surface-1))] shadow-soft-lg',
          modalSizeClass[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-headline text-ink-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭弹窗"
            className="rounded-md p-1 text-ink-tertiary hover:bg-[rgb(var(--surface-2))]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
        {footer && (
          <div className={cn('flex shrink-0 justify-end gap-3 border-t border-border px-5 py-4', footerClassName)}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
