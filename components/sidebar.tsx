'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { HermesHealth } from '@/components/hermes-health';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';
import {
  Home,
  Sparkles,
  Target,
  MessagesSquare,
  Brain,
  Grid3x3,
  Users,
  Clock3,
  Settings,
  ShieldCheck,
  Ticket,
  Megaphone,
  LayoutGrid,
  Layers,
  PanelLeftClose,
  PanelLeft,
  ScrollText,
  Lock,
  Bot,
  Workflow,
  CheckSquare,
  FileText,
  Database,
  Building2,
  Cpu,
  Palette,
  MessageSquare,
} from 'lucide-react';

/**
 * Sidebar — 5 顶级导航 + 4 段式首页 (UI-IA §1).
 * Role-based visibility: employee / manager / steward / admin / champion.
 *
 * Role detection: V1 client-side soft check via /api/auth/me.
 * V2: server-side guard, but for navigation hide we trust the API.
 */

type Role = 'employee' | 'manager' | 'steward' | 'admin' | 'champion';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  visibleTo?: Role[];  // undefined = visible to all
}

interface NavGroup {
  id: string;
  label: string;
  emoji: string;
  items: NavItem[];
  visibleTo?: Role[];
}

const NAV: NavGroup[] = [
  // 1. Home (top, no group label)
  {
    id: 'home',
    label: '首页',
    emoji: '🏠',
    items: [
      { name: '首页', href: '/', icon: Home },
    ],
  },

  // 2. 事半 (Enterprise) - all users
  {
    id: 'shiban',
    label: '事半 · 企业',
    emoji: '📊',
    items: [
      { name: 'OKR 5 层', href: '/okr/cascade', icon: Target },
      { name: '部门 Dashboard', href: '/okr/dashboard', icon: Target, visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: 'OKR 日历', href: '/okr/calendar', icon: Target },
      { name: '360 评估', href: '/360', icon: Sparkles },
      { name: '议事室', href: '/convergence', icon: Sparkles, badge: '17min' },
      { name: 'IM 协同', href: '/im', icon: MessagesSquare },
      { name: 'Memory 知识', href: '/memories', icon: Brain },
      { name: '知识架构', href: '/knowledge', icon: Database },
      { name: '工作流', href: '/workflows', icon: Workflow },
      { name: '组织架构', href: '/organization', icon: Building2 },
      { name: '企业内网', href: '/intranet', icon: Megaphone },
      { name: '9 宫格', href: '/nine-box', icon: Grid3x3, visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: '1on1 对话', href: '/1on1', icon: MessagesSquare },
      { name: 'AI 智能信号', href: '/insights', icon: Sparkles },
      { name: '组织分析', href: '/analytics', icon: Grid3x3, visibleTo: ['manager', 'steward', 'admin', 'champion'] },
    ],
  },

  // 3. 拿捏 (Personal) - employees + everyone
  {
    id: 'naonie',
    label: '拿捏 · 个人',
    emoji: '🐉',
    items: [
      { name: '我的分身', href: '/persona', icon: Users },
      { name: '成长路径', href: '/persona/evolution', icon: Sparkles },
      { name: '5min 日报', href: '/report', icon: Clock3, badge: 'M2' },
      { name: 'AI 对话', href: '/chat', icon: MessageSquare },
      { name: 'Skills 库', href: '/skills', icon: Layers },
      { name: 'Skills 学习', href: '/skills/learning', icon: Sparkles },
    ],
  },

  // 4. 管理 - admin/steward only
  {
    id: 'admin',
    label: '管理',
    emoji: '🛠️',
    visibleTo: ['admin', 'steward', 'champion'],
    items: [
      { name: '邀请', href: '/admin/invite', icon: Ticket, visibleTo: ['admin', 'champion'] },
      { name: 'Steward 工作台', href: '/admin/steward', icon: ShieldCheck, visibleTo: ['steward', 'admin', 'champion'] },
      { name: 'Baseline', href: '/admin/baseline', icon: ScrollText, badge: 'M2', visibleTo: ['admin', 'champion'] },
      { name: 'Intranet', href: '/admin/intranet', icon: Megaphone, badge: 'M3', visibleTo: ['admin', 'champion'] },
      { name: 'Launchpad', href: '/admin/launchpad', icon: LayoutGrid, badge: 'M2', visibleTo: ['admin', 'champion'] },
      { name: 'TAF Skills', href: '/admin/tandem-skills', icon: Layers, visibleTo: ['admin'] },
      { name: 'Agents', href: '/agents', icon: Bot, visibleTo: ['admin'] },
      { name: 'MCP 工具', href: '/mcp', icon: Cpu, visibleTo: ['admin'] },
      { name: '定时任务', href: '/tasks', icon: CheckSquare, visibleTo: ['admin'] },
      { name: '系统日志', href: '/logs', icon: FileText, visibleTo: ['admin'] },
    ],
  },

  // 5. 设置 - all users
  {
    id: 'settings',
    label: '设置',
    emoji: '⚙️',
    items: [
      { name: '个人设置', href: '/settings', icon: Settings },
      { name: '§13 数据自助', href: '/settings/privacy', icon: Lock },
      { name: '设计语言', href: '/design', icon: Palette },
    ],
  },
];

function isVisible(scopeRoles: Role[] | undefined, userRoles: Role[]): boolean {
  if (!scopeRoles || scopeRoles.length === 0) return true;
  return scopeRoles.some((r) => userRoles.includes(r));
}

const ALL_ROLES: Role[] = ['admin', 'champion', 'steward', 'manager', 'employee'];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  // A1 (2026-05-10): 共享 /api/auth/me 通过 useCurrentUser, 避免重复请求.
  const { user, error } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);

  const userRoles: Role[] = useMemo(() => {
    // 还没拉回前, 暂用默认避免侧栏闪烁.
    if (!fetched) return ['employee'];
    // 401 / 未登录 → demo 模式给全角色 (页面自身仍有 server-side guard).
    if (error === 'unauthenticated' || !user) return ALL_ROLES;
    const roles = (user.roles ?? []).filter((x): x is Role =>
      typeof x === 'string' && (ALL_ROLES as string[]).includes(x)
    );
    // dev bootstrap: admin@tandem.local 没有显式角色时给全角色.
    if (user.email === 'admin@tandem.local' && roles.length === 0) return ALL_ROLES;
    return roles.length > 0 ? roles : ['employee'];
  }, [fetched, user, error]);

  const visibleGroups = NAV.filter((g) => isVisible(g.visibleTo, userRoles));

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-surface-2/60 backdrop-blur-glass transition-all duration-base ease-standard',
        open ? 'w-60' : 'w-16'
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center justify-between border-b px-3">
        {open ? (
          <Link href="/" className="flex flex-col leading-tight surface-interactive">
            <span className="text-headline tracking-tight text-ink-primary">
              Tandem<span className="text-brand-500"> · </span>牛马搭子
            </span>
            <span className="text-footnote text-ink-tertiary">17 分钟达成共识</span>
          </Link>
        ) : (
          <Link href="/" className="font-bold text-brand-500 text-lg surface-interactive">
            T
          </Link>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1 hover:bg-surface-3 surface-interactive"
          title={open ? '收起侧栏' : '展开侧栏'}
          aria-label={open ? '收起侧栏' : '展开侧栏'}
        >
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 space-y-4 overflow-auto p-2">
        {visibleGroups.map((group) => {
          const groupItems = group.items.filter((i) => isVisible(i.visibleTo, userRoles));
          if (groupItems.length === 0) return null;
          return (
            <div key={group.id} className="space-y-0.5">
              {open && group.id !== 'home' && (
                <p className="px-3 pb-1 pt-2 text-footnote font-semibold uppercase tracking-wider text-ink-tertiary/80">
                  <span className="mr-1">{group.emoji}</span>
                  {group.label}
                </p>
              )}
              {groupItems.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-1.5 text-caption surface-interactive transition-colors duration-fast ease-standard',
                      active
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
                    )}
                    title={!open ? item.name : undefined}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', active && 'text-brand-600')} />
                    {open && (
                      <>
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 font-mono text-[9px]',
                              item.badge === '17min'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-surface-3 text-ink-secondary'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer: health */}
      {open && (
        <div className="border-t p-2">
          <HermesHealth compact />
        </div>
      )}
    </aside>
  );
}
