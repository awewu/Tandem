'use client';

/**
 * Intranet 统一横向导航 (替代旧 SubSidebar + 老 TopSubnav).
 *
 * 三段分组:
 *   1. 主入口 (内网首页 / CEO 直通车 / A-Z 资源 / 内部论坛)
 *   2. 类目 (公告 / 政策 / 大事记 / 福利)
 *   3. 辅助 (高管动态 / 廉洁举报)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Megaphone,
  FileLock,
  PartyPopper,
  Gift,
  Users,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Entry {
  href: string;
  label: string;
  icon: LucideIcon;
  group: 'main' | 'category' | 'aux';
}

// Icons stay client-side to avoid RSC server→client function serialization (build crash on /intranet/a-z).
const ENTRIES: Entry[] = [
  { href: '/intranet',                          label: '内网首页',   icon: Megaphone,    group: 'main' },
  { href: '/intranet/town-hall',                label: 'CEO 直通车', icon: Megaphone,    group: 'main' },
  { href: '/intranet/a-z',                      label: 'A-Z 资源',   icon: FileLock,     group: 'main' },
  { href: '/intranet/forum',                    label: '内部论坛',   icon: Users,        group: 'main' },
  { href: '/intranet/category/announcement',    label: '公告',       icon: Megaphone,    group: 'category' },
  { href: '/intranet/category/policy',          label: '政策',       icon: FileLock,     group: 'category' },
  { href: '/intranet/category/milestone',       label: '大事记',     icon: PartyPopper,  group: 'category' },
  { href: '/intranet/category/welfare',         label: '福利',       icon: Gift,         group: 'category' },
  { href: '/intranet/leadership',               label: '高管动态',   icon: Users,        group: 'aux' },
  { href: '/intranet/ethics',                   label: '廉洁举报',   icon: ShieldCheck,  group: 'aux' },
];

export function IntranetSubnav() {
  const entries = ENTRIES;
  const pathname = usePathname() ?? '';

  const groups = (['main', 'category', 'aux'] as const).map((g) =>
    entries.filter((e) => e.group === g),
  );

  const isActive = (href: string) => {
    if (href === '/intranet') return pathname === '/intranet';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className="border-b border-border bg-surface-1 sticky top-0 z-10">
      <div className="page-container flex h-11 items-center gap-1 overflow-x-auto">
        {groups.map((items, gi) => (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && <span className="mx-2 h-4 w-px bg-border flex-shrink-0" />}
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-caption font-medium transition-colors duration-fast whitespace-nowrap',
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-2',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
