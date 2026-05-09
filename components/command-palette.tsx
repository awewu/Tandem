'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useChatStore, useAgentStore, useTaskStore } from '@/lib/store';
import { Search, MessageSquare, Bot, CalendarClock, Settings, Home, Puzzle, Database, Activity, Workflow } from 'lucide-react';

const PAGES = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Tasks', href: '/tasks', icon: CalendarClock },
  { name: 'Skills', href: '/skills', icon: Puzzle },
  { name: 'Knowledge', href: '/knowledge', icon: Database },
  { name: 'Logs', href: '/logs', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const conversations = useChatStore((s) => s.conversations);
  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const results = [
    ...PAGES.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).map((p) => ({ type: 'page' as const, ...p })),
    ...conversations.filter((c) => c.title.toLowerCase().includes(query.toLowerCase())).map((c) => ({
      type: 'chat' as const,
      name: c.title,
      href: `/chat`,
      icon: MessageSquare,
      id: c.id,
    })),
    ...agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())).map((a) => ({
      type: 'agent' as const,
      name: a.name,
      href: '/agents',
      icon: Bot,
      id: a.id,
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <div className="flex items-center border-b px-4 py-3">
          <Search size={18} className="text-muted-foreground mr-3" />
          <Input
            placeholder="Search pages, chats, agents... (Ctrl+P)"
            className="border-0 focus-visible:ring-0 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-96 overflow-y-auto py-2">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results found</div>
          )}
          {results.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={`${item.type}-${item.name}-${i}`}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm hover:bg-accent text-left"
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <Icon size={16} className="text-muted-foreground" />
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span>Navigate: <kbd className="rounded bg-muted px-1">&#8593;</kbd> <kbd className="rounded bg-muted px-1">&#8595;</kbd></span>
          <span>Select: <kbd className="rounded bg-muted px-1">Enter</kbd></span>
          <span>Close: <kbd className="rounded bg-muted px-1">Esc</kbd></span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
