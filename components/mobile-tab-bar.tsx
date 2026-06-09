'use client';

/**
 * MobileTabBar — 5 tab 底部导航, 中间 "日报" 凸起 FAB (Instagram/WeChat 风格).
 *
 * 设计哲学: 移动端打开 Tandem 每天干一件事 = 写 5min 日报 → 推流 OKR.
 * 所以日报放正中间, FAB 凸起, 颜色用品牌红, 强调每日仪式感.
 *
 * 视觉规范: Apple HIG mobile tab bar (Linear/Cron 借鉴).
 *   - 高 56px (不含 safe-area), 纯白底, 1px hairline 顶 border, 24px icon, 10pt label
 *   - 普通 tab: 激活=ink-primary 近黑, 非激活=slate-400
 *   - 中间 FAB: 52×52 圆, brand-500 实心, 白 icon, 比 bar 顶上凸 18px
 *   - 不用渐变 / 多色 / pulse 动画 (审美克制)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Home, MessagesSquare, Target, BotMessageSquare, Sparkles, NotebookPen, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { hasExternalRole, hasInternalRole } from '@/lib/auth/roles';

interface Tab {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  matches: (path: string) => boolean;
}

/** 纯外部用户 (经销商/申请注册人) 的底部导航: 只露授权模块, 不露内部 OKR/IM/日报 */
const EXTERNAL_TABS: Tab[] = [
  {
    id: 'hub',
    label: '首页',
    href: '/hub',
    icon: Home,
    matches: (p) => p === '/hub' || p === '/' || p === '/home',
  },
  {
    id: 'shouchao',
    label: '手抄',
    href: '/shouchao',
    icon: NotebookPen,
    matches: (p) => p.startsWith('/shouchao'),
  },
  {
    id: 'me',
    label: '我的',
    href: '/settings',
    icon: UserRound,
    matches: (p) => p.startsWith('/settings'),
  },
];

const LEFT_TABS: Tab[] = [
  {
    id: 'home',
    label: '首页',
    href: '/',
    icon: Home,
    matches: (p) => p === '/' || p === '/home',
  },
  {
    id: 'okr',
    label: 'OKR',
    href: '/okr',
    icon: Target,
    matches: (p) => p.startsWith('/okr') || p.startsWith('/kpi') || p.startsWith('/tti'),
  },
];

const RIGHT_TABS: Tab[] = [
  {
    id: 'im',
    label: 'IM',
    href: '/im',
    icon: MessagesSquare,
    matches: (p) => p.startsWith('/im'),
  },
  {
    id: 'dazi',
    label: '搭子',
    href: '/tandem',
    icon: BotMessageSquare,
    matches: (p) => p.startsWith('/tandem') || p.startsWith('/chat') || p.startsWith('/agents') || p.startsWith('/persona'),
  },
];

/** 中间凸起 FAB: 5min 日报 — OKR 进展的唯一输入源 */
const CENTER_TAB: Tab = {
  id: 'report',
  label: '日报',
  href: '/report',
  icon: Sparkles,
  matches: (p) => p.startsWith('/report'),
};

function TabItem({ tab, pathname }: { tab: Tab; pathname: string }) {
  const Icon = tab.icon;
  const active = tab.matches(pathname);
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-1',
        'text-[10px] font-medium transition-colors',
        active
          ? 'text-ink-primary dark:text-white'
          : 'text-slate-400 dark:text-white/40',
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
      <span className="leading-none">{tab.label}</span>
    </Link>
  );
}

export function MobileTabBar() {
  const pathname = usePathname() ?? '/';
  const { user } = useCurrentUser();
  const roles = user?.roles ?? [];
  const pureExternal = hasExternalRole(roles) && !hasInternalRole(roles);

  const centerActive = CENTER_TAB.matches(pathname);
  const CenterIcon = CENTER_TAB.icon;

  // 纯外部用户: 极简 3-tab (首页/手抄/我的), 无内部日报 FAB
  if (pureExternal) {
    return (
      <nav
        aria-label="底部导航"
        className={cn(
          'md:hidden',
          'fixed inset-x-0 bottom-0 z-40',
          'flex items-stretch',
          'border-t border-slate-200/80 bg-white',
          'pb-[env(safe-area-inset-bottom,0px)]',
          'h-[56px]',
          'dark:bg-[rgb(var(--rheem-charcoal))] dark:border-white/10',
        )}
      >
        {EXTERNAL_TABS.map((t) => (
          <TabItem key={t.id} tab={t} pathname={pathname} />
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="底部导航"
      className={cn(
        'md:hidden',
        'fixed inset-x-0 bottom-0 z-40',
        'flex items-stretch',
        'border-t border-slate-200/80 bg-white',
        'pb-[env(safe-area-inset-bottom,0px)]',
        'h-[56px]',
        'dark:bg-[rgb(var(--rheem-charcoal))] dark:border-white/10',
      )}
    >
      {/* 左侧 2 tab */}
      {LEFT_TABS.map((t) => (
        <TabItem key={t.id} tab={t} pathname={pathname} />
      ))}

      {/* 中间凸起 FAB · 日报 */}
      <div className="relative flex w-[64px] shrink-0 items-end justify-center">
        <Link
          href={CENTER_TAB.href}
          aria-current={centerActive ? 'page' : undefined}
          aria-label="5min 日报 · 更新 OKR 进展"
          className={cn(
            'absolute -top-[18px]',
            'flex h-[52px] w-[52px] items-center justify-center rounded-full',
            'shadow-[0_4px_14px_rgba(200,32,44,0.32),0_1px_2px_rgba(0,0,0,0.08)]',
            'transition-transform active:scale-95',
            centerActive
              ? 'bg-[rgb(var(--brand-600))] text-white ring-2 ring-[rgb(var(--brand-500))]/30'
              : 'bg-[rgb(var(--brand-500))] text-white',
          )}
        >
          <CenterIcon className="h-6 w-6" strokeWidth={2.2} />
        </Link>
        {/* FAB 下方 label, 与左右 tab 对齐 */}
        <span
          className={cn(
            'pb-1 text-[10px] font-medium leading-none',
            centerActive ? 'text-ink-primary' : 'text-slate-400',
          )}
        >
          日报
        </span>
      </div>

      {/* 右侧 2 tab */}
      {RIGHT_TABS.map((t) => (
        <TabItem key={t.id} tab={t} pathname={pathname} />
      ))}
    </nav>
  );
}
