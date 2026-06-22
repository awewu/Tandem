'use client';

/**
 * AppRail — 64px charcoal vertical bar (Teams App Rail style).
 *
 * - Always-visible spine of the app
 * - 9 module icons + short labels
 * - Active state: 3px red bar on left + white icon + white label
 * - Hover: lighter charcoal bg
 * - Role-based: whole module hidden if user lacks role
 * - Bottom: theme toggle / user avatar slot (V2)
 *
 * Per "Rheem + Teams" design language (docs: UI-IA §6 Phase 2).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import {
  NAV_MODULES,
  isVisible,
  activeModuleId,
  resolveNavRoles,
  type Role,
} from './nav-modules';
import { BrandLogo } from './brand-logo';
import { UserMenu } from './user-menu';

export default function AppRail() {
  const pathname = usePathname();
  const { user, error } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);

  const userRoles: Role[] = useMemo(
    () =>
      resolveNavRoles(user?.roles, {
        fetched,
        unauthenticated: error === 'unauthenticated' || !user,
        email: user?.email,
      }),
    [fetched, user, error],
  );

  // Hide rail on auth routes (full-screen login/register).
  const isAuthRoute =
    pathname === '/login' || pathname === '/register' || pathname?.startsWith('/login/') || pathname?.startsWith('/register/');
  if (isAuthRoute) return null;

  const visibleModules = NAV_MODULES.filter((m) => isVisible(m.visibleTo, userRoles));
  const activeId = activeModuleId(pathname);

  return (
    <nav
      aria-label="主导航"
      className="flex h-full w-16 shrink-0 flex-col items-stretch bg-[rgb(var(--rheem-charcoal))] text-white/85"
    >
      {/* Brand glyph (clickable to home) */}
      <Link
        href="/"
        title="Tandem · 牛马搭子"
        className="flex h-14 items-center justify-center border-b border-white/5 text-white surface-interactive"
      >
        <BrandLogo variant="mark" theme="dark" size={36} alt="Tandem · 牛马搭子" />
      </Link>

      {/* Module icon stack */}
      <ul className="scrollbar-none flex-1 space-y-0.5 overflow-y-auto py-2">
        {visibleModules.map((m) => {
          const Icon = m.icon;
          const active = m.id === activeId;
          // For 'home' module, use href '/'; otherwise pick first prefix.
          const href =
            m.id === 'home'
              ? '/'
              : (m.items.find((i) => isVisible(i.visibleTo, userRoles))?.href ?? m.pathPrefixes[0]);
          return (
            <li key={m.id} className="px-1">
              <Link
                href={href}
                title={m.tagline ? `${m.fullLabel}\n${m.tagline}` : m.fullLabel}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5',
                  'surface-interactive transition-colors duration-fast ease-standard',
                  active
                    ? 'bg-[rgb(var(--rheem-charcoal-2))] text-white'
                    : 'text-white/65 hover:bg-[rgb(var(--rheem-charcoal-2))] hover:text-white',
                )}
              >
                {/* Active indicator bar (left edge, Rheem red) */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-1 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[rgb(var(--brand-500))]"
                  />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="text-[10px] font-medium leading-tight tracking-wide">
                  {m.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer: user menu (avatar → popover with logout / theme / settings) */}
      <div className="flex h-14 items-center justify-center border-t border-white/5">
        <UserMenu />
      </div>
    </nav>
  );
}
