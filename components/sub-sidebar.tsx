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
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { HermesHealth } from '@/components/hermes-health';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import {
  NAV_MODULES,
  ALL_ROLES,
  isVisible,
  activeModuleId,
  type Role,
} from './nav-modules';
import { ImSidebar } from '@/components/im/im-sidebar';

const STORAGE_KEY = 'tandem.sub-sidebar.open';

export default function SubSidebar() {
  const pathname = usePathname();
  const { user, error } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);

  const [open, setOpen] = useState(true);
  // Hydrate collapse pref from localStorage (client-only)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === '0') setOpen(false);
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

  const userRoles: Role[] = useMemo(() => {
    if (!fetched) return ['employee'];
    if (error === 'unauthenticated' || !user) return ALL_ROLES;
    const roles = (user.roles ?? []).filter((x): x is Role =>
      typeof x === 'string' && (ALL_ROLES as string[]).includes(x),
    );
    if (user.email === 'admin@tandem.local' && roles.length === 0) return ALL_ROLES;
    return roles.length > 0 ? roles : ['employee'];
  }, [fetched, user, error]);

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

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-[rgb(var(--surface-1))]',
        'transition-[width] duration-base ease-standard',
        open ? 'w-60' : 'w-12',
      )}
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
          onClick={() => setOpen((v) => !v)}
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
        <>
          {/* 其他模块: 静态 nav items */}
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-0.5">
              {items.map((item, idx) => {
                const Icon = item.icon;
                const isCta = item.accent === 'cta';
                const active =
                  !isCta &&
                  (item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname?.startsWith(item.href + '/'));

                const ctaClass = cn(
                  'group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-caption font-semibold surface-interactive',
                  'transition-colors duration-fast ease-standard',
                  'bg-[rgb(var(--brand-500))] text-white shadow-soft-sm hover:bg-[rgb(var(--brand-600))] hover:shadow-soft',
                );
                const navClass = cn(
                  'group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-caption surface-interactive',
                  'transition-colors duration-fast ease-standard',
                  active
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
                          idx === 0 && 'pt-1',
                        )}
                      >
                        {item.group}
                      </p>
                    )}
                    <Link
                      href={item.href}
                      title={!open ? item.name : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={isCta ? ctaClass : navClass}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isCta ? 'text-white' : active && 'text-brand-600',
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

          {open && (
            <div className="border-t border-border p-2">
              <HermesHealth compact />
            </div>
          )}
        </>
      )}
    </aside>
  );
}
