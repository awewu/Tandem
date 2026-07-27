'use client';

import type { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Inbox,
  Loader2,
  XCircle,
} from 'lucide-react';

type StatusTone = 'brand' | 'success' | 'info' | 'warning' | 'danger' | 'neutral';

const STATUS_ICON = {
  brand: Circle,
  success: CheckCircle2,
  info: Clock3,
  warning: AlertCircle,
  danger: XCircle,
  neutral: Circle,
} satisfies Record<StatusTone, typeof Circle>;

export function WorkbenchSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="workbench-section-header">
      <div>
        {eyebrow ? <p className="workbench-section-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="workbench-section-header__title">{title}</h2>
        {description ? <p className="workbench-section-header__description">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export function WorkbenchFilterToolbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`workbench-filter-toolbar${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function WorkbenchTableShell({ children }: { children: ReactNode }) {
  return <div className="workbench-table-shell">{children}</div>;
}

export function StatusPill({
  tone = 'neutral',
  children,
  icon,
}: {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const Icon = STATUS_ICON[tone];
  return (
    <span className={`status-pill status-pill-${tone}`}>
      {icon ?? <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export function WorkbenchTableState({
  type,
  title,
  description,
  action,
}: {
  type: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = type === 'loading' ? Loader2 : type === 'error' ? AlertCircle : Inbox;
  return (
    <div className={`workbench-state workbench-state--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="workbench-state__inner">
        <span className="workbench-state__icon">
          <Icon aria-hidden="true" className={type === 'loading' ? 'animate-spin' : undefined} size={18} />
        </span>
        <p className="workbench-state__title">{title}</p>
        {description ? <p className="workbench-state__description">{description}</p> : null}
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}

export function WorkbenchPaginationFooter({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const hasTotalPages = typeof totalPages === 'number' && Number.isFinite(totalPages);
  const atFirst = currentPage <= 1;
  const atLast = hasTotalPages ? currentPage >= totalPages : false;
  const pageText = hasTotalPages ? `${currentPage} / ${totalPages}` : `第 ${currentPage} 页`;
  const totalText =
    typeof totalItems === 'number'
      ? `共 ${totalItems} 条${pageSize ? ` · 每页 ${pageSize} 条` : ''}`
      : '按当前筛选分页加载';

  return (
    <div className="workbench-pagination-footer">
      <span>{totalText}</span>
      <div className="workbench-pagination-footer__actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={onPrevious} disabled={!onPrevious || atFirst}>
          <ChevronLeft size={14} />
          上一页
        </button>
        <span>{pageText}</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={onNext} disabled={!onNext || atLast}>
          下一页
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
