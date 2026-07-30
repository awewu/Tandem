'use client';

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
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
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const hasTotalPages = typeof totalPages === 'number' && Number.isFinite(totalPages);
  const normalizedTotalPages = hasTotalPages ? Math.max(Math.floor(totalPages), 1) : undefined;
  const safeCurrentPage = Math.max(Math.floor(currentPage) || 1, 1);
  const atFirst = currentPage <= 1;
  const atLast = normalizedTotalPages ? safeCurrentPage >= normalizedTotalPages : false;
  const pageText = normalizedTotalPages ? `${safeCurrentPage} / ${normalizedTotalPages}` : `第 ${safeCurrentPage} 页`;
  const totalText =
    typeof totalItems === 'number'
      ? `共 ${totalItems} 条`
      : '按当前筛选分页加载';
  const [jumpValue, setJumpValue] = useState(String(safeCurrentPage));
  const pageItems = useMemo(() => {
    if (!normalizedTotalPages) return [];
    const pages = new Set<number>([1, normalizedTotalPages, safeCurrentPage]);
    for (let page = safeCurrentPage - 1; page <= safeCurrentPage + 1; page += 1) {
      if (page >= 1 && page <= normalizedTotalPages) pages.add(page);
    }
    return Array.from(pages)
      .sort((left, right) => left - right)
      .reduce<Array<number | 'ellipsis'>>((items, page) => {
        const previous = items[items.length - 1];
        if (typeof previous === 'number' && page - previous > 1) items.push('ellipsis');
        items.push(page);
        return items;
      }, []);
  }, [normalizedTotalPages, safeCurrentPage]);

  useEffect(() => {
    setJumpValue(String(safeCurrentPage));
  }, [safeCurrentPage]);

  const goToPage = (nextPage: number) => {
    if (!onPageChange || !Number.isFinite(nextPage)) return;
    const boundedPage = normalizedTotalPages
      ? Math.min(Math.max(Math.floor(nextPage), 1), normalizedTotalPages)
      : Math.max(Math.floor(nextPage), 1);
    if (boundedPage !== safeCurrentPage) onPageChange(boundedPage);
  };

  const submitJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goToPage(Number(jumpValue));
  };

  return (
    <div className="workbench-pagination-footer">
      <div className="workbench-pagination-footer__meta">
        <span>{totalText}</span>
        {pageSize && pageSizeOptions?.length && onPageSizeChange ? (
          <select
            className="input workbench-pagination-footer__page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) || pageSize)}
            aria-label="每页数量"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}条/页
              </option>
            ))}
          </select>
        ) : pageSize ? (
          <span>{pageSize}条/页</span>
        ) : null}
      </div>
      <div className="workbench-pagination-footer__actions" aria-label="分页">
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only workbench-pagination-footer__nav"
          onClick={onPrevious}
          disabled={!onPrevious || atFirst}
          aria-label="上一页"
        >
          <ChevronLeft size={14} />
        </button>
        {pageItems.length ? (
          <div className="workbench-pagination-footer__pages" aria-label="页码">
            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="workbench-pagination-footer__ellipsis">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`btn btn-sm workbench-pagination-footer__page ${item === safeCurrentPage ? 'btn-brand' : 'btn-outline'}`}
                  onClick={() => goToPage(item)}
                  disabled={!onPageChange || item === safeCurrentPage}
                  aria-current={item === safeCurrentPage ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            )}
          </div>
        ) : (
          <span>{pageText}</span>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm icon-only workbench-pagination-footer__nav"
          onClick={onNext}
          disabled={!onNext || atLast}
          aria-label="下一页"
        >
          <ChevronRight size={14} />
        </button>
        <form className="workbench-pagination-footer__jump" onSubmit={submitJump}>
          <label>
            前往
            <input
              className="input"
              type="number"
              min={1}
              max={normalizedTotalPages}
              value={jumpValue}
              onChange={(event) => setJumpValue(event.target.value)}
              disabled={!onPageChange}
              aria-label="跳转页码"
            />
            页
          </label>
        </form>
      </div>
    </div>
  );
}
