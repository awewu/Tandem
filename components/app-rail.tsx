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
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import {
  NAV_MODULES,
  isVisible,
  isGlobalNavEntry,
  activeModuleId,
  resolveNavRoles,
  type Role,
} from './nav-modules';
import { BrandLogo } from './brand-logo';
import { UserMenu } from './user-menu';
import { toast } from '@/hooks/use-toast';
import { useImUnreadCount } from '@/components/im/use-im-unread-count';

export default function AppRail() {
  const pathname = usePathname();
  const { user, error } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mailUnread, setMailUnread] = useState(0);
  const imUnread = useImUnreadCount(user?.id);

  const userRoles: Role[] = useMemo(
    () =>
      resolveNavRoles(user?.roles, {
        fetched,
        unauthenticated: error === 'unauthenticated' || !user,
        email: user?.email,
        permissions: user?.permissions,
      }),
    [fetched, user, error],
  );

  // Hide rail on auth routes (full-screen login/register).
  const isAuthRoute =
    pathname === '/login' || pathname === '/register' || pathname?.startsWith('/login/') || pathname?.startsWith('/register/');

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const refreshBadge = async () => {
      try {
        const res = await fetch('/api/notifications/badge', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!cancelled && typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount);
      } catch {
        /* fail-soft */
      }
    };
    const onUnread = (event: Event) => {
      const detail = (event as CustomEvent<{ unreadCount?: number }>).detail;
      if (typeof detail?.unreadCount === 'number') setUnreadCount(detail.unreadCount);
    };
    window.addEventListener('tandem:notifications:unread', onUnread);
    void refreshBadge();
    const timer = setInterval(refreshBadge, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('tandem:notifications:unread', onUnread);
    };
  }, [user?.id]);

  // 个人邮箱未读数轮询 (IMAP STATUS) — 角标 + 新邮件提示
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let prev = -1; // -1 表示尚未取到基线, 避免首次弹提示
    const refreshMail = async () => {
      try {
        const res = await fetch('/api/mail/unread', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled || typeof data.unseen !== 'number') return;
        const next = data.unseen;
        // 未读数增加 → 新邮件提示
        if (prev >= 0 && next > prev) {
          const delta = next - prev;
          toast({ title: '收到新邮件', description: `你有 ${delta} 封新邮件，共 ${next} 封未读。` });
          window.dispatchEvent(new CustomEvent('tandem:mail:new', { detail: { count: delta, unseen: next } }));
        }
        prev = next;
        setMailUnread(next);
      } catch {
        /* fail-soft */
      }
    };
    // 邮箱内操作 (标记已读/收发) 后可主动刷新角标
    const onMailUnread = (event: Event) => {
      const detail = (event as CustomEvent<{ unseen?: number }>).detail;
      if (typeof detail?.unseen === 'number') {
        prev = detail.unseen;
        setMailUnread(detail.unseen);
      } else {
        void refreshMail();
      }
    };
    window.addEventListener('tandem:mail:unread', onMailUnread);
    void refreshMail();
    const timer = setInterval(refreshMail, 120_000); // 2 分钟轮询, IMAP STATUS 开销小
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('tandem:mail:unread', onMailUnread);
    };
  }, [user?.id]);

  if (isAuthRoute) return null;

  const visibleModules = NAV_MODULES.filter((m) => isGlobalNavEntry(m) && isVisible(m.visibleTo, userRoles));
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
                {m.id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1 rounded-full bg-[rgb(var(--brand-500))] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {m.id === 'mail' && mailUnread > 0 && (
                  <span className="absolute right-1.5 top-1 rounded-full bg-[rgb(var(--brand-500))] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                    {mailUnread > 99 ? '99+' : mailUnread}
                  </span>
                )}
                {m.id === 'im' && imUnread > 0 && (
                  <span className="absolute right-1.5 top-1 rounded-full bg-[rgb(var(--brand-500))] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                    {imUnread > 99 ? '99+' : imUnread}
                  </span>
                )}
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
