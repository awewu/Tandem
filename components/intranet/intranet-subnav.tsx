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
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Entry {
  href: string;
  label: string;
  icon: LucideIcon;
  group: 'main' | 'category' | 'aux';
}

export function IntranetSubnav({ entries }: { entries: Entry[] }) {
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
