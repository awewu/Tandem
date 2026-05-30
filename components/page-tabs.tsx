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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // 计算选中 tab 的位置 + 宽度 (相对于 nav 容器)
  const measure = () => {
    const navEl = navRef.current;
    if (!navEl) return;
    let activeEl: HTMLElement | null = null;
    for (const t of tabs) {
      const el = tabRefs.current.get(t.id);
      if (!el) continue;
      const isActive = t.href
        ? pathname === t.href || pathname?.startsWith(t.href + '/') || pathname?.startsWith(t.href + '?')
        : active === t.id;
      if (isActive) { activeEl = el; break; }
    }
    if (!activeEl) { setIndicator(null); return; }
    const navRect = navEl.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    setIndicator({
      left: tabRect.left - navRect.left + navEl.scrollLeft,
      width: tabRect.width,
    });
  };

  // 初次挂载 (避免 SSR/CSR 不一致, 跳过首帧动画)
  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => setHasMounted(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, active, tabs.length]);

  // 监听容器尺寸 (字体加载完 / 父级布局变化 / actions 变长)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    if (navRef.current) ro.observe(navRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border bg-[rgb(var(--surface-1))]',
        className,
      )}
    >
      <nav
        ref={navRef}
        role="tablist"
        className="relative flex items-stretch gap-0 overflow-x-auto"
        aria-label="Page tabs"
      >
        {/* Apple Music 风弹性 underline — 走 transform/width 动画、ease-emphasis (iOS spring) */}
        {indicator && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-[rgb(var(--brand-500))]"
            style={{
              left: 0,
              width: indicator.width,
              transform: `translateX(${indicator.left}px)`,
              transition: hasMounted
                ? 'transform var(--duration-base) var(--ease-emphasis), width var(--duration-base) var(--ease-emphasis)'
                : 'none',
            }}
          />
        )}
        {tabs.map((t) => {
          // Active detection: href-mode uses pathname startsWith, controlled uses active id.
          const isActive = t.href
            ? pathname === t.href || pathname?.startsWith(t.href + '/') || pathname?.startsWith(t.href + '?')
            : active === t.id;
          const Icon = t.icon;

          const inner = (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-caption font-medium',
                isActive
                  ? 'text-[rgb(var(--brand-700))]'
                  : 'text-ink-secondary hover:text-ink-primary',
                'transition-[color]',
                t.disabled && 'opacity-40 pointer-events-none',
              )}
              style={{ transitionDuration: 'var(--duration-fast)', transitionTimingFunction: 'var(--ease-standard)' }}
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

          const setRef = (el: HTMLElement | null) => {
            if (el) tabRefs.current.set(t.id, el);
            else tabRefs.current.delete(t.id);
          };

          if (t.href) {
            return (
              <Link
                key={t.id}
                ref={setRef as React.Ref<HTMLAnchorElement>}
                href={t.href}
                role="tab"
                aria-selected={isActive ? 'true' : 'false'}
                tabIndex={isActive ? 0 : -1}
                data-tab-id={t.id}
                className="surface-interactive"
              >
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={t.id}
              ref={setRef as React.Ref<HTMLButtonElement>}
              type="button"
              role="tab"
              aria-selected={isActive ? 'true' : 'false'}
              disabled={t.disabled}
              tabIndex={isActive ? 0 : -1}
              data-tab-id={t.id}
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
