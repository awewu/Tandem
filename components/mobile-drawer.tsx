'use client';

/**
 * MobileDrawer — 汉堡菜单展开的全模块导航抽屉.
 *
 * 从左侧滑入, 含遮罩. 展示当前用户可见的全部 NavModule + 各模块下的 NavItem.
 * 点任一链接关闭抽屉.
 */

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_MODULES, ALL_ROLES, isVisible, type Role } from './nav-modules';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';

export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, error } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);

  const userRoles: Role[] = useMemo(() => {
    if (!fetched) return ['employee'];
    if (error === 'unauthenticated' || !user) return ALL_ROLES;
    const roles = (user.roles ?? []).filter(
      (x): x is Role => typeof x === 'string' && (ALL_ROLES as string[]).includes(x),
    );
    if (user.email === 'admin@tandem.local' && roles.length === 0) return ALL_ROLES;
    return roles.length > 0 ? roles : ['employee'];
  }, [fetched, user, error]);

  // 锁页面滚动
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const modules = useMemo(
    () => NAV_MODULES.filter((m) => isVisible(m.visibleTo, userRoles)),
    [userRoles],
  );

  return (
    <>
      {/* 遮罩 */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* 抽屉 */}
      <aside
        aria-label="全部导航"
        aria-hidden={!open}
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-50',
          'w-[82%] max-w-[320px]',
          'bg-white dark:bg-[rgb(var(--rheem-charcoal))]',
          'shadow-2xl',
          'flex flex-col',
          'transition-transform duration-200 ease-out',
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
