'use client';

/**
 * HubTabs — 内容区顶部的"页内横向 tab"(导航第三级).
 *
 * 重模块(如拿捏)二级栏只放 4 个 Hub 入口, 每个 Hub 的子页定义在
 * nav-modules 的 item.tabs 上, 由本组件按当前路径渲染为横向 tab.
 *
 * 当前路径不属于任何带 tabs 的 Hub → 渲染 null (其它模块/页面不受影响).
 * 选 Hub 规则: 精确 href 匹配优先, 其次前缀匹配 (解决 /persona vs /persona/profile 归属).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import { NAV_MODULES, activeModuleId, ALL_ROLES, isVisible, type Role } from './nav-modules';

export default function HubTabs() {
  const pathname = usePathname() ?? '';
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

  const mod = NAV_MODULES.find((m) => m.id === activeModuleId(pathname));
  const hubs = (mod?.items ?? []).filter((it) => Array.isArray(it.tabs) && it.tabs.length > 0);
  // 选中当前 Hub: 先按 tab href 精确匹配, 再按前缀
  const exact = hubs.find((h) => h.tabs!.some((t) => t.href === pathname));
  const prefixed = hubs.find((h) =>
    h.tabs!.some((t) => pathname.startsWith(t.href + '/') || pathname.startsWith(t.href + '?')),
  );
  const hub = exact ?? prefixed;
  // 按角色过滤 tab (与 SubSidebar 一致, 不越权显示)
  const visibleTabs = (hub?.tabs ?? []).filter((t) => isVisible(t.visibleTo, userRoles));
  if (!hub || visibleTabs.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-[rgb(var(--surface-1))]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--surface-1))]/80">
      <nav className="flex gap-0 overflow-x-auto" role="tablist" aria-label={`${hub.name} 子页`}>
        {visibleTabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              role="tab"
              aria-selected={active ? 'true' : 'false'}
              className={cn(
                'whitespace-nowrap border-b-2 px-3 py-2.5 text-caption font-medium -mb-px transition-colors surface-interactive',
                active
                  ? 'border-[rgb(var(--brand-500))] text-[rgb(var(--brand-700))]'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary',
              )}
            >
              {t.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
