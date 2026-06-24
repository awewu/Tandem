'use client';

/**
 * MobileDrawer — 汉堡菜单展开的全模块导航抽屉.
 *
 * 从左侧滑入, 含遮罩. 展示当前用户可见的全部 NavModule + 各模块下的 NavItem.
 * 点任一链接关闭抽屉.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X, Sparkles, ShieldCheck, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_MODULES, isVisible, resolveNavRoles, type Role } from './nav-modules';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import { useBackDismiss } from '@/lib/hooks/use-back-dismiss';

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
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

  // 锁页面滚动
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // 安卓硬件返回键 / 浏览器返回 → 关抽屉 (而非退出 App)
  useBackDismiss(open, onClose);

  // 左滑手势关闭 (原生抽屉直觉)
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (dx < -60) onClose(); // 向左滑 > 60px 关闭
  }

  const modules = useMemo(
    () => NAV_MODULES.filter((m) => isVisible(m.visibleTo, userRoles)),
    [userRoles],
  );

  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    router.replace('/login');
  }

  const userInitial = (user?.name?.[0] || user?.email?.[0] || 'T').toUpperCase();

  return (
    <>
      {/* 遮罩 */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* 抽屉 */}
      <aside
        aria-label="全部导航"
        aria-hidden={!open}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50',
          'w-[82%] max-w-[320px]',
          'bg-white dark:bg-[rgb(var(--rheem-charcoal))]',
          'shadow-2xl',
          'flex flex-col',
          'transition-transform ease-out',
          'pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-white/10">
          <span className="text-[15px] font-semibold text-ink-primary">全部导航</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* §P6 用户区: 头像 + Persona 训练入口 + 设置 + 退出 */}
        {user && (
          <div className="shrink-0 border-b border-slate-200/80 px-3 py-3 dark:border-white/10">
            <Link
              href="/persona"
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--brand-500))] text-[15px] font-semibold text-white">
                {userInitial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-ink-primary truncate">
                  {user.name || user.email}
                </span>
                <span className="block text-[11.5px] text-ink-tertiary truncate">
                  {user.email}
                </span>
              </span>
            </Link>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Link
                href="/persona/training"
                onClick={onClose}
                className="flex flex-col items-center gap-1 rounded-md py-2 text-[11px] text-ink-secondary hover:bg-slate-100 dark:hover:bg-white/5"
                title="训练我的 AI 分身"
              >
                <Sparkles className="h-4 w-4" />
                训练分身
              </Link>
              <Link
                href="/persona/me/proxy-actions"
                onClick={onClose}
                className="flex flex-col items-center gap-1 rounded-md py-2 text-[11px] text-ink-secondary hover:bg-slate-100 dark:hover:bg-white/5"
                title="我的分身代办"
              >
                <ShieldCheck className="h-4 w-4" />
                分身代办
              </Link>
              <Link
                href="/settings"
                onClick={onClose}
                className="flex flex-col items-center gap-1 rounded-md py-2 text-[11px] text-ink-secondary hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <Settings className="h-4 w-4" />
                设置
              </Link>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-md py-2 text-[12px] text-danger hover:bg-danger/5 disabled:opacity-60 dark:hover:bg-danger/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? '退出中…' : '退出登录'}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {modules.map((m) => {
            const Icon = m.icon;
            const items = m.items.filter((i) => isVisible(i.visibleTo, userRoles));
            return (
              <section key={m.id} className="mb-4">
                <div className="flex items-center gap-2 px-2 pb-1.5">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {m.fullLabel}
                  </span>
                </div>
                {items.length === 0 ? (
                  <Link
                    href={m.pathPrefixes[0]}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-[13.5px] text-ink-primary',
                      'hover:bg-slate-100 dark:hover:bg-white/5',
                      pathname?.startsWith(m.pathPrefixes[0]) && 'bg-slate-100 dark:bg-white/5 font-medium',
                    )}
                  >
                    打开
                  </Link>
                ) : (
                  <ul>
                    {items.map((it) => {
                      const ItIcon = it.icon;
                      const active = pathname === it.href || pathname?.startsWith(it.href + '/');
                      return (
                        <li key={`${m.id}-${it.href}-${it.name}`}>
                          <Link
                            href={it.href}
                            onClick={onClose}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-3 py-2 text-[13.5px]',
                              'hover:bg-slate-100 dark:hover:bg-white/5',
                              active
                                ? 'bg-slate-100 dark:bg-white/5 font-medium text-ink-primary'
                                : 'text-ink-secondary',
                            )}
                          >
                            <ItIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{it.name}</span>
                            {it.badge && (
                              <span className="ml-auto rounded-full bg-[rgb(var(--brand-500))]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--brand-500))]">
                                {it.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
}
