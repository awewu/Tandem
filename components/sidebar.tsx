'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  GitBranch,
  BookOpen,
  ListChecks,
  Database,
  FileText,
  Cpu,
  Swords,
  Target,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Brain,
  Sparkles,
  Users,
  Grid3x3,
  ShieldCheck,
  Ticket,
  ScrollText,
  Layers,
  Wrench,
  Shield,
  MessagesSquare,
} from 'lucide-react';
import { useState } from 'react';
import { HermesHealth } from '@/components/hermes-health';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { name: '主页', href: '/', icon: LayoutDashboard },
      { name: '通讯', href: '/im', icon: MessagesSquare, badge: 'NEW' },
    ],
  },
  {
    label: 'Tandem 核心',
    items: [
      { name: '议事室', href: '/convergence', icon: Sparkles, badge: '17min' },
      { name: '决议卡', href: '/decision-card', icon: ScrollText },
      { name: 'Persona 进化', href: '/persona/evolution', icon: Users },
      { name: '9 宫格', href: '/nine-box', icon: Grid3x3 },
      { name: 'OKR + TTI', href: '/okr', icon: Target },
      { name: 'Memory 治理', href: '/memories', icon: Brain },
    ],
  },
  {
    label: '管理',
    items: [
      { name: '邀请码', href: '/admin/invite', icon: Ticket },
      { name: 'Steward 工作台', href: '/admin/steward', icon: Shield },
      { name: 'Skills 注册', href: '/admin/tandem-skills', icon: Layers },
      { name: '组织架构', href: '/organization', icon: Swords },
    ],
  },
  {
    label: 'AI 工具',
    items: [
      { name: 'Chat', href: '/chat', icon: MessageSquare },
      { name: 'Agents', href: '/agents', icon: Bot },
      { name: 'Workflows', href: '/workflows', icon: GitBranch },
      { name: 'Tasks', href: '/tasks', icon: ListChecks },
      { name: 'Skills', href: '/skills', icon: Wrench },
      { name: 'Knowledge', href: '/knowledge', icon: Database },
    ],
  },
  {
    label: '系统',
    items: [
      { name: 'Logs', href: '/logs', icon: FileText },
      { name: 'MCP', href: '/mcp', icon: Cpu },
      { name: '设置', href: '/settings', icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = () => setSidebarOpen((v) => !v);

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-background transition-all duration-200',
        sidebarOpen ? 'w-60' : 'w-16'
      )}
    >
      <div className="flex items-center justify-between h-14 px-3 border-b">
        {sidebarOpen && (
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg tracking-tight">Tandem · 牛马搭子</span>
            <span className="text-[10px] text-muted-foreground">17 分钟达成共识</span>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-1 rounded-md hover:bg-muted" title={sidebarOpen ? '收起侧栏' : '展开侧栏'}>
          {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-3 overflow-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {sidebarOpen && group.label && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title={!sidebarOpen ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      {sidebarOpen && (
        <div className="p-2 border-t">
          <HermesHealth compact />
        </div>
      )}
    </aside>
  );
}
