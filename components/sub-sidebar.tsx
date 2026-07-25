'use client';

/**
 * SubSidebar — 240px white panel showing items of the currently active module.
 *
 * - Header: module fullLabel + collapse button
 * - Body:  scrollable list of NavItems (role-filtered)
 * - Hidden entirely when active module has no items (e.g. /home)
 * - Collapse state persisted in localStorage
 *
 * Pairs with AppRail to form a Teams-style two-level navigation.
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { HermesHealth } from '@/components/hermes-health';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import {
  NAV_MODULES,
  isVisible,
  activeModuleId,
  resolveNavRoles,
  type Role,
} from './nav-modules';
import { ImSidebar } from '@/components/im/im-sidebar';

const STORAGE_KEY = 'tandem.sub-sidebar.open';
const IM_WIDTH_KEY = 'tandem.im-sidebar.width';
const IM_SIDEBAR_COLLAPSED_WIDTH = 48;
const IM_SIDEBAR_MAX_WIDTH = 520;
const IM_SIDEBAR_DEFAULT_WIDTH = 360;
const IM_SIDEBAR_COLLAPSE_THRESHOLD = 72;

function navItemMatches(itemHref: string, fullPath: string, pathname: string | null): boolean {
  if (itemHref === '/') return fullPath === '/';
  if (itemHref.includes('?')) return fullPath === itemHref;
  return pathname === itemHref || Boolean(pathname?.startsWith(itemHref + '/'));
}

export default function SubSidebar() {
  // useSearchParams() 必须在 Suspense 边界内, 否则静态预渲染 (next build) 会因 CSR bailout 失败.
  return (
    <Suspense fallback={null}>
      <SubSidebarInner />
    </Suspense>
  );
}

function SubSidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, error } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const imDragWidthRef = useRef(IM_SIDEBAR_DEFAULT_WIDTH);

  const [open, setOpen] = useState(true);
  const [imWidth, setImWidth] = useState(IM_SIDEBAR_DEFAULT_WIDTH);
  const [resizingIm, setResizingIm] = useState(false);
  // Hydrate collapse pref from localStorage (client-only)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === '0') setOpen(false);
    } catch {
      /* no-op */
    }
    try {
      const storedWidth = Number(window.localStorage.getItem(IM_WIDTH_KEY));
      if (Number.isFinite(storedWidth)) {
        setImWidth(Math.min(IM_SIDEBAR_MAX_WIDTH, Math.max(IM_SIDEBAR_COLLAPSED_WIDTH, storedWidth)));
      }
    } catch {
      /* no-op */
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    } catch {
      /* no-op */
    }
  }, [open]);

  useEffect(() => {
    if (!resizingIm) return;

    const onPointerMove = (event: PointerEvent) => {
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const rawWidth = event.clientX - left;
      imDragWidthRef.current = rawWidth;
      const nextWidth = Math.min(IM_SIDEBAR_MAX_WIDTH, Math.max(IM_SIDEBAR_COLLAPSED_WIDTH, rawWidth));
      setImWidth(nextWidth);
      setOpen(nextWidth > IM_SIDEBAR_COLLAPSE_THRESHOLD);
      try {
        window.localStorage.setItem(IM_WIDTH_KEY, String(nextWidth));
      } catch {
        /* no-op */
      }
    };
    const onPointerUp = () => {
      const shouldCollapse = imDragWidthRef.current <= IM_SIDEBAR_COLLAPSE_THRESHOLD;
      setOpen(!shouldCollapse);
      if (shouldCollapse) setImWidth(IM_SIDEBAR_COLLAPSED_WIDTH);
      setResizingIm(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [resizingIm]);

  const userRoles: Role[] = useMemo(() => resolveNavRoles(user?.roles, {
    fetched, unauthenticated: error === 'unauthenticated' || !user,
    email: user?.email, permissions: user?.permissions,
  }), [fetched, user, error]);

  // Hide the entire two-level shell on auth routes (login, register).
  // Layout still renders <SubSidebar/>, but it returns null here.
  const isAuthRoute =
    pathname === '/login' || pathname === '/register' || pathname?.startsWith('/login/') || pathname?.startsWith('/register/');
  if (isAuthRoute) return null;

  const activeId = activeModuleId(pathname);
  const activeModule = NAV_MODULES.find((m) => m.id === activeId);

  // Home (or any module without items) → render only a thin collapse handle.
  // Empty after role filter is also a no-op render.
  const items = (activeModule?.items ?? []).filter((i) => isVisible(i.visibleTo, userRoles));

  const isImModule = activeId === 'im';

  if (!isImModule && (!activeModule || items.length === 0)) {
    return null;
  }

  const label = isImModule ? 'IM · 消息' : (activeModule?.fullLabel ?? '');
  const q = searchParams?.toString();
  const fullPath = pathname + (q ? '?' + q : '');
  const activeItemHref = items
    .filter((item) => navItemMatches(item.href, fullPath, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const toggleOpen = () => {
    setOpen((currentOpen) => {
      if (isImModule && !currentOpen && imWidth <= IM_SIDEBAR_COLLAPSE_THRESHOLD) {
        setImWidth(IM_SIDEBAR_DEFAULT_WIDTH);
        try {
          window.localStorage.setItem(IM_WIDTH_KEY, String(IM_SIDEBAR_DEFAULT_WIDTH));
        } catch {
          /* no-op */
        }
      }
      return !currentOpen;
    });
  };

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        // Semantic tokens — flips correctly in dark mode.
        'relative flex h-full shrink-0 flex-col border-r border-border bg-[rgb(var(--surface-1))]',
        'transition-[width] duration-base ease-standard',
        !isImModule && (open ? 'w-60' : 'w-12'),
        resizingIm && 'transition-none',
      )}
      style={isImModule ? { width: open || resizingIm ? imWidth : IM_SIDEBAR_COLLAPSED_WIDTH } : undefined}
      aria-label={label}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {open ? (
          <div className="min-w-0 flex-1">
            <h2 className="text-callout font-semibold text-ink-primary truncate leading-tight">
              {label}
            </h2>
            {!isImModule && activeModule?.tagline && (
              <p className="text-[10.5px] text-ink-secondary/80 truncate leading-tight mt-0.5">
                {activeModule.tagline}
              </p>
            )}
          </div>
        ) : (
          <span className="sr-only">{label}</span>
        )}
        <button
          type="button"
          onClick={toggleOpen}
          className="rounded-md p-1 text-ink-secondary hover:bg-surface-3 hover:text-ink-primary surface-interactive"
          aria-label={open ? '收起子导航' : '展开子导航'}
          title={open ? '收起 (⌘B)' : '展开 (⌘B)'}
        >
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* IM 模块: 动态会话列表 */}
      {isImModule ? (
        <Suspense fallback={null}>
          <ImSidebar collapsed={!open} />
        </Suspense>
      ) : (
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {items.map((item, idx) => {
            const Icon = item.icon;
            const isActive = item.href === activeItemHref;

            // CTA 按钮只在选中时才显示红色背景，否则和普通项一样
            const showAsCta = item.accent === 'cta' && isActive;

            const ctaClass = cn(
              'group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-caption font-semibold surface-interactive',
              'transition-colors duration-fast ease-standard',
              'bg-[rgb(var(--brand-500))] text-white shadow-soft-sm hover:bg-[rgb(var(--brand-600))] hover:shadow-soft',
            );
            const navClass = cn(
              'group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-caption surface-interactive',
              'transition-colors duration-fast ease-standard',
              isActive
                ? 'bg-brand-50 text-brand-700 font-semibold'
                : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary',
            );

            const prevGroup = idx > 0 ? items[idx - 1].group : undefined;
            const showGroupHeader = open && item.group && item.group !== prevGroup;

            return (
              <li key={item.href}>
                {showGroupHeader && (
                  <p
                    className={cn(
                      'px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary',
                      idx === 0 && 'pt-1', // first group: no extra top padding
                    )}
                  >
                    {item.group}
                  </p>
                )}
                <Link
                  href={item.href}
                  title={!open ? item.name : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={showAsCta ? ctaClass : navClass}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      showAsCta ? 'text-white' : isActive && 'text-brand-600',
                    )}
                  />
                  {open && (
                    <>
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 font-mono text-[9px]',
                            item.badge === '17min'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-surface-3 text-ink-secondary',
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}  {/* end isImModule else */}

      {/* Footer: health */}
      {!isImModule && open && (
        <div className="border-t border-border p-2">
          <HermesHealth compact />
        </div>
      )}
      {isImModule && (
        <button
          type="button"
          aria-label="拖动调整会话栏宽度"
          title="拖动调整会话栏宽度"
          onPointerDown={(event) => {
            event.preventDefault();
            imDragWidthRef.current = sidebarRef.current?.getBoundingClientRect().width ?? imWidth;
            setResizingIm(true);
          }}
          className={cn(
            'absolute bottom-0 right-[-4px] top-0 z-20 hidden w-2 cursor-col-resize md:block',
            'after:absolute after:bottom-0 after:left-1/2 after:top-0 after:w-px after:-translate-x-1/2 after:bg-transparent',
            'hover:after:bg-[rgb(var(--brand-500))]',
            resizingIm && 'after:bg-[rgb(var(--brand-500))]',
          )}
        />
      )}
    </aside>
  );
}
