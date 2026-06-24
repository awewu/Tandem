'use client';

/**
 * MobileTopBar — 仅 < md 显示的顶栏.
 *
 * 左: 汉堡 (打开全模块抽屉)  · 中: 当前模块标题 + Logo  · 右: 通知 + 用户头像
 *
 * 紧凑 44px 高度 (Apple HIG mobile nav 标准).
 */

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';
import { MobileDrawer } from './mobile-drawer';
import { NAV_MODULES, activeModuleId } from './nav-modules';
import { haptic } from '@/lib/haptics';

/**
 * MobileTopBar — < md 顶栏, Apple HIG 简洁风.
 *
 * 布局: [汉堡] [当前模块标题居中] [用户头像]
 *
 * 视觉规范:
 *   - 44px 高, 纯白底, 1px hairline 底 border
 *   - 标题: 17pt semibold, ink-primary (Apple iOS Large Title 收紧版)
 *   - 不放 logo (重复, 浪费空间). 不放 bell (通知走 drawer 内).
 *   - 不用渐变 / blur (避免性能毛刺), 不用 brand 强色
 */
export function MobileTopBar() {
  const pathname = usePathname() ?? '/';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const title = useMemo(() => {
    if (pathname === '/' || pathname === '/home') return '工作台';
    if (pathname.startsWith('/report')) return '今日日报';
    const id = activeModuleId(pathname);
    const m = NAV_MODULES.find((x) => x.id === id);
    return m?.fullLabel ?? 'Tandem';
  }, [pathname]);

  return (
    <>
      <header
        className={cn(
          'md:hidden',
          'sticky top-0 z-30',
          'flex h-11 items-center px-3',
          'border-b border-slate-200/80 bg-white',
          'pt-[env(safe-area-inset-top,0px)]',
          'dark:bg-[rgb(var(--rheem-charcoal))] dark:border-white/10',
        )}
      >
        <button
          type="button"
          onClick={() => { haptic('light'); setDrawerOpen(true); }}
          aria-label="打开导航"
          className="flex h-11 w-11 items-center justify-center -ml-2 rounded-md text-ink-secondary hover:bg-slate-100 dark:text-white/75 dark:hover:bg-white/10"
        >
          <Menu className="h-[22px] w-[22px]" strokeWidth={2} />
        </button>

        <span className="flex-1 text-center text-[15px] font-semibold text-ink-primary truncate px-2">
          {title}
        </span>

        <UserMenu />
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
