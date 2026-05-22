/**
 * Intranet 模块统一布局
 *
 * 合并 SubSidebar + TopSubnav 到一条横向导航 (用户偏好):
 *   - 主入口: 内网首页 / CEO 直通车 / A-Z 资源 / 内部论坛
 *   - 类目: 公告 / 政策 / 大事记 / 福利
 *   - 辅助: 高管动态 / 廉洁举报
 *
 * 保留所有路由不变, 只重构导航位置.
 */

import Link from 'next/link';
import {
  Megaphone,
  FileLock,
  PartyPopper,
  Gift,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IntranetSubnav } from '@/components/intranet/intranet-subnav';

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  group: 'main' | 'category' | 'aux';
}

const ENTRIES: NavEntry[] = [
  { href: '/intranet',                          label: '内网首页',  icon: Megaphone,    group: 'main' },
  { href: '/intranet/town-hall',                label: 'CEO 直通车', icon: Megaphone,   group: 'main' },
  { href: '/intranet/a-z',                      label: 'A-Z 资源',  icon: FileLock,     group: 'main' },
  { href: '/intranet/forum',                    label: '内部论坛',  icon: Users,        group: 'main' },
  { href: '/intranet/category/announcement',    label: '公告',      icon: Megaphone,    group: 'category' },
  { href: '/intranet/category/policy',          label: '政策',      icon: FileLock,     group: 'category' },
  { href: '/intranet/category/milestone',       label: '大事记',    icon: PartyPopper,  group: 'category' },
  { href: '/intranet/category/welfare',         label: '福利',      icon: Gift,         group: 'category' },
  { href: '/intranet/leadership',               label: '高管动态',  icon: Users,        group: 'aux' },
  { href: '/intranet/ethics',                   label: '廉洁举报',  icon: ShieldCheck,  group: 'aux' },
];

export default function IntranetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <IntranetSubnav entries={ENTRIES} />
      <div className="flex-1 overflow-auto bg-surface-2/40">{children}</div>
    </div>
  );
}
