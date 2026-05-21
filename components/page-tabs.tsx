'use client';

/**
 * PageTabs — horizontal tab strip for page-level sub-sections.
 *
 * Two flavors:
 *   - Link tabs (different routes): pass `href` per tab, active determined by pathname match
 *   - State tabs (same route, different query/state): pass `active` + `onChange`
 *
 * Visual: pill-style segmented control under page header. Active = Rheem red border-bottom.
 * Pairs with AppRail+SubSidebar two-level navigation as the third level.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface PageTabItem {
  id: string;
  label: string;
  /** Optional badge count or text */
  badge?: string | number;
  /** Link mode — provide href */
  href?: string;
  /** Icon (lucide etc.) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Disabled (visible but unclickable) */
  disabled?: boolean;
}

interface PageTabsProps {
  tabs: PageTabItem[];
  /** Controlled mode: id of currently active tab; ignored if tabs use href */
  active?: string;
  /** Controlled mode change callback */
  onChange?: (id: string) => void;
  className?: string;
  /** Optional right-side actions (buttons, filters) */
  actions?: React.ReactNode;
}

export default function PageTabs({ tabs, active, onChange, className, actions }: PageTabsProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border bg-[rgb(var(--surface-1))]',
        className,
      )}
    >
      <nav
        role="tablist"
        className="flex items-stretch gap-0 overflow-x-auto -mb-px"
        aria-label="Page tabs"
      >
        {tabs.map((t) => {
          // Active detection: href-mode uses pathname startsWith, controlled uses active id.
          const isActive = t.href
            ? pathname === t.href || pathname?.startsWith(t.href + '/') || pathname?.startsWith(t.href + '?')
            : active === t.id;
          const Icon = t.icon;

          const inner = (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-caption font-medium border-b-2 transition-colors',
                isActive
                  ? 'border-[rgb(var(--brand-500))] text-[rgb(var(--brand-700))]'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-border',
                t.disabled && 'opacity-40 pointer-events-none',
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
              {t.badge != null && t.badge !== '' && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    isActive
                      ? 'bg-[rgb(var(--brand-500))] text-white'
                      : 'bg-surface-3 text-ink-secondary',
                  )}
                >
                  {t.badge}
                </span>
              )}
            </span>
          );

          if (t.href) {
            return isActive ? (
              <Link
                key={t.id}
                href={t.href}
                role="tab"
                aria-selected="true"
                tabIndex={0}
                className="surface-interactive"
              >
                {inner}
              </Link>
            ) : (
              <Link
                key={t.id}
                href={t.href}
                role="tab"
                aria-selected="false"
                tabIndex={-1}
                className="surface-interactive"
              >
                {inner}
              </Link>
            );
          }

          return isActive ? (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected="true"
              disabled={t.disabled}
              tabIndex={0}
              onClick={() => onChange?.(t.id)}
              className="surface-interactive"
            >
              {inner}
            </button>
          ) : (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected="false"
              disabled={t.disabled}
              tabIndex={-1}
              onClick={() => onChange?.(t.id)}
              className="surface-interactive"
            >
              {inner}
            </button>
          );
        })}
      </nav>
      {actions && <div className="flex items-center gap-2 px-3">{actions}</div>}
    </div>
  );
}
