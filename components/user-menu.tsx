'use client';

/**
 * UserMenu — AppRail footer popover with user info + logout.
 *
 * Click-outside dismiss. Anchored to the bottom-left avatar in the AppRail.
 * Items:
 *   - Email + roles header (read-only)
 *   - 设置 → /settings
 *   - 主题: light / dark / system (writes .dark class + localStorage)
 *   - 外观 → /settings/appearance
 *   - 退出登录 → POST /api/auth/logout → redirect to /login
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, LogOut, Moon, Sun, Monitor, Palette } from 'lucide-react';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'tandem.theme';

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const effective =
    t === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : t;
  root.classList.toggle('dark', effective === 'dark');
}

export function UserMenu() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const reset = useAuthStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hydrate theme from localStorage on mount.
  useEffect(() => {
    try {
      const v = (window.localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system';
      setTheme(v);
      applyTheme(v);
    } catch {
      /* no-op */
    }
  }, []);

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function pickTheme(t: Theme) {
    setTheme(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* no-op */
    }
    applyTheme(t);
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore network — cookie may still be cleared by middleware */
    }
    reset();
    setOpen(false);
    router.push('/login');
  }

  const initials = (user?.name ?? user?.email ?? 'D').slice(0, 1).toUpperCase();
  const displayName = user?.name ?? user?.email ?? 'Guest';
  const roleLabel = user?.roles?.length ? user.roles.join(' · ') : '未登录';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={user?.email ?? '账户'}
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold uppercase text-white hover:bg-white/20 transition-colors"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute bottom-1 left-12 z-50 w-64 rounded-lg border border-border bg-[rgb(var(--surface-1))] p-2 shadow-soft-lg',
            'animate-in fade-in slide-in-from-left-2 duration-fast',
          )}
        >
          {/* Header: identity */}
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-caption font-semibold text-ink-primary truncate">
              {displayName}
            </p>
            {user?.email && user.email !== displayName && (
              <p className="mt-0.5 text-footnote text-ink-tertiary truncate">{user.email}</p>
            )}
            <p className="mt-0.5 text-footnote text-ink-tertiary truncate">{roleLabel}</p>
          </div>

          {/* Theme picker */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-footnote text-ink-tertiary mb-1.5">主题</p>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'light', label: '亮', icon: Sun },
                  { id: 'system', label: '随系统', icon: Monitor },
                  { id: 'dark', label: '暗', icon: Moon },
                ] as Array<{ id: Theme; label: string; icon: typeof Sun }>
              ).map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => pickTheme(opt.id)}
                    aria-pressed={active ? 'true' : 'false'}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-md py-1.5 text-footnote transition-colors',
                      active
                        ? 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))] font-semibold'
                        : 'text-ink-secondary hover:bg-surface-2',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <div className="py-1">
            <MenuItem href="/settings" icon={Settings} onClick={() => setOpen(false)}>
              设置
            </MenuItem>
            <MenuItem
              href="/settings/appearance"
              icon={Palette}
              onClick={() => setOpen(false)}
            >
              外观与品牌
            </MenuItem>
            <button
              type="button"
              onClick={logout}
              disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 text-caption text-[rgb(var(--brand-700))] hover:bg-[rgb(var(--brand-50))] rounded-md disabled:opacity-60 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              {busy ? '退出中...' : '退出登录'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: typeof Settings;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-caption text-ink-primary hover:bg-surface-2 rounded-md transition-colors"
    >
      <Icon className="h-3.5 w-3.5 text-ink-tertiary" />
      {children}
    </Link>
  );
}
