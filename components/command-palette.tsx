'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  Home,
  Sparkles,
  Target,
  Brain,
  MessagesSquare,
  Grid3x3,
  Users,
  Clock3,
  Settings,
  Lock,
  Ticket,
  ShieldCheck,
  ScrollText,
  Megaphone,
  LayoutGrid,
  Layers,
  ArrowRight,
} from 'lucide-react';

/**
 * Cmd+K command palette — Tandem only routes.
 * UI-IA §5.6 + §5.9 (Linear/Raycast-style).
 */

interface CommandItem {
  name: string;
  href: string;
  group: 'home' | '事半' | '拿捏' | '管理' | '设置';
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
}

const COMMANDS: CommandItem[] = [
  // Home
  { name: '首页', href: '/', group: 'home', icon: Home, keywords: ['home', 'dashboard', '主页'] },

  // 事半
  { name: 'OKR 5 层', href: '/okr', group: '事半', icon: Target, keywords: ['kr', 'objective', 'okr'] },
  { name: '议事室', href: '/convergence', group: '事半', icon: Sparkles, keywords: ['convergence', 'decision', '17min'] },
  { name: 'IM 协同', href: '/im', group: '事半', icon: MessagesSquare, keywords: ['im', 'chat', 'message'] },
  { name: 'Memory 知识库', href: '/memories', group: '事半', icon: Brain, keywords: ['memory', 'knowledge', 'sop'] },
  { name: '9 宫格', href: '/nine-box', group: '事半', icon: Grid3x3, keywords: ['nine box', 'kpi', 'tti'] },

  // 拿捏
  { name: '我的分身 Persona', href: '/persona', group: '拿捏', icon: Users, keywords: ['persona', 'avatar', '分身'] },
  { name: '成长路径', href: '/persona/evolution', group: '拿捏', icon: Sparkles, keywords: ['evolution', 'growth', '进化'] },
  { name: '5min 日报', href: '/report', group: '拿捏', icon: Clock3, keywords: ['report', 'daily', '日报'] },

  // 管理
  { name: '邀请码', href: '/admin/invite', group: '管理', icon: Ticket, keywords: ['invite', 'invitation'] },
  { name: 'Steward 工作台', href: '/admin/steward', group: '管理', icon: ShieldCheck, keywords: ['steward', 'governance'] },
  { name: 'Baseline 配置', href: '/admin/baseline', group: '管理', icon: ScrollText, keywords: ['baseline', '基线'] },
  { name: 'Intranet 内容', href: '/admin/intranet', group: '管理', icon: Megaphone, keywords: ['intranet', '公告', '政策'] },
  { name: 'Launchpad 跳板', href: '/admin/launchpad', group: '管理', icon: LayoutGrid, keywords: ['launchpad', '跳板', 'erp', 'crm'] },
  { name: 'TAF Skills', href: '/admin/tandem-skills', group: '管理', icon: Layers, keywords: ['skills', 'taf', 'tools'] },

  // 设置
  { name: '个人设置', href: '/settings', group: '设置', icon: Settings, keywords: ['settings', 'profile', 'mfa'] },
  { name: '§13 数据自助 (导出/匿名)', href: '/settings/privacy', group: '设置', icon: Lock, keywords: ['privacy', 'export', 'anonymize'] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Reset query when reopened
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.group.toLowerCase().includes(q)) return true;
      if (c.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<CommandItem['group'], CommandItem[]>();
    for (const r of results) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 glass-thick">
        <DialogTitle className="sr-only">命令面板</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="text-ink-tertiary" />
          <input
            type="text"
            placeholder="搜索页面 (议事 · OKR · 日报 · 设置)..."
            className="flex-1 bg-transparent text-body outline-none placeholder:text-ink-tertiary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">ESC</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto py-2">
          {grouped.length === 0 && (
            <div className="px-4 py-12 text-center text-caption text-ink-tertiary">
              未找到匹配项
            </div>
          )}
          {grouped.map(([group, items]) => (
            <div key={group} className="mb-2">
              <p className="px-4 pb-1 pt-2 text-footnote font-semibold uppercase tracking-wider text-ink-tertiary">
                {group}
              </p>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    className="flex w-full items-center gap-3 px-4 py-2 text-caption text-ink-primary hover:bg-brand-50 transition-colors duration-instant"
                    onClick={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <Icon className="h-4 w-4 text-ink-secondary" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ArrowRight className="h-3 w-3 text-ink-tertiary opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-footnote text-ink-tertiary">
          <span>导航 <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↑</kbd><kbd className="ml-0.5 rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↓</kbd></span>
          <span>选择 <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↵</kbd></span>
          <span className="ml-auto">⌘K 唤起</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
