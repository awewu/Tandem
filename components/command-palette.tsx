'use client';

/**
 * Command Palette ⌘K — Linear/Raycast style cross-module jumper.
 *
 * Sources:
 *   1. NAV_MODULES (single source of truth — automatically picks up new modules)
 *   2. ACTIONS    (verbs: 发起议事, 写日报, 新建文档, etc.)
 *   3. AI Search  (input non-empty → suggest "AI 搜索: <q>" → /search?q=...)
 *
 * Features:
 *   - ⌘K / Ctrl+K toggles open
 *   - ↑ ↓ navigate, Enter to execute, Esc to close
 *   - Recent items (localStorage, top 5)
 *   - Role-filtered (mirrors AppRail visibility)
 *   - Fuzzy match across name + keywords + group
 *
 * Replaces the old hardcoded list (was ~20 items, duplicate with Sidebar).
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Search,
  Sparkles,
  ArrowRight,
  Plus,
  Clock3,
  FileText,
  MessagesSquare,
  Target,
  Brain,
  History,
} from 'lucide-react';
import {
  NAV_MODULES,
  ALL_ROLES,
  isVisible,
  type Role,
} from '@/components/nav-modules';
import { useCurrentUser, useAuthStore } from '@/lib/hooks/use-current-user';

interface CommandItem {
  id: string;
  name: string;
  href: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  /** Optional badge (e.g., shortcut hint) */
  hint?: string;
}

const RECENT_KEY = 'tandem.cmdk.recent';
const RECENT_MAX = 5;

// Static verb-style actions that complement nav items.
const ACTIONS: CommandItem[] = [
  { id: 'a:convergence:new',  name: '发起议事',       href: '/convergence?new=1',  group: '动作', icon: Sparkles,       keywords: ['new', 'create', 'convergence', '议事', '决策'] },
  { id: 'a:okr:new',          name: '创建 OKR',       href: '/okr?new=1',           group: '动作', icon: Target,         keywords: ['new', 'okr', 'objective', 'kr', '目标'] },
  { id: 'a:report:write',     name: '写 5min 日报',    href: '/report',              group: '动作', icon: Clock3,         keywords: ['report', 'daily', '日报'] },
  { id: 'a:document:new',     name: '新建文档',       href: '/documents?new=1',     group: '动作', icon: FileText,       keywords: ['new', 'doc', 'document', '文档'] },
  { id: 'a:im:start',         name: '发起 IM 私聊',    href: '/im?dm=new',           group: '动作', icon: MessagesSquare, keywords: ['im', 'dm', 'chat', '私聊'] },
  { id: 'a:memory:capture',   name: '捕获 Memory',     href: '/memories?capture=1',  group: '动作', icon: Brain,          keywords: ['memory', 'capture', 'sop', '知识'] },
];

// ── /api/agent/intent 响应缓存 (module-level, 跨 CommandPalette 打开/关闭保留) ──
// 同一 query 10 分钟内重复触发直接读缓存，避免快速打字浪费 LLM token。
interface IntentCacheEntry {
  matches: Array<{ intent: string; route: string; label: string; confidence: number; skill?: string }>;
  ts: number;
}
const INTENT_CACHE = new Map<string, IntentCacheEntry>();
const INTENT_CACHE_MAX = 25;
const INTENT_CACHE_TTL_MS = 10 * 60 * 1000;
function intentCacheSet(key: string, matches: IntentCacheEntry['matches']): void {
  if (INTENT_CACHE.size >= INTENT_CACHE_MAX) {
    // LRU: 删最早一个
    const firstKey = INTENT_CACHE.keys().next().value;
    if (firstKey !== undefined) INTENT_CACHE.delete(firstKey);
  }
  INTENT_CACHE.set(key, { matches, ts: Date.now() });
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [agentMatches, setAgentMatches] = useState<
    Array<{ intent: string; route: string; label: string; confidence: number; skill?: string }>
  >([]);
  const listRef = useRef<HTMLDivElement>(null);

  const { user, error: authError } = useCurrentUser();
  const fetched = useAuthStore((s) => s.fetched);

  // Same role logic as AppRail/SubSidebar.
  const userRoles: Role[] = useMemo(() => {
    if (!fetched) return ['employee'];
    if (authError === 'unauthenticated' || !user) return ALL_ROLES;
    const roles = (user.roles ?? []).filter((x): x is Role =>
      typeof x === 'string' && (ALL_ROLES as string[]).includes(x),
    );
    if (user.email === 'admin@tandem.local' && roles.length === 0) return ALL_ROLES;
    return roles.length > 0 ? roles : ['employee'];
  }, [fetched, user, authError]);

  // Derive nav commands from NAV_MODULES (single source of truth).
  const navCommands: CommandItem[] = useMemo(() => {
    const out: CommandItem[] = [];
    for (const m of NAV_MODULES) {
      if (!isVisible(m.visibleTo, userRoles)) continue;
      // Module itself (jump to its primary item or path).
      const primary = m.items.find((i) => isVisible(i.visibleTo, userRoles));
      const moduleHref = m.id === 'home' ? '/' : primary?.href ?? m.pathPrefixes[0];
      out.push({
        id: `m:${m.id}`,
        name: m.fullLabel,
        href: moduleHref,
        group: '模块',
        icon: m.icon,
        keywords: [m.id, m.label],
      });
      // Each item.
      for (const it of m.items) {
        if (!isVisible(it.visibleTo, userRoles)) continue;
        out.push({
          id: `i:${it.href}`,
          name: it.name,
          href: it.href,
          group: m.fullLabel,
          icon: it.icon,
        });
      }
    }
    return out;
  }, [userRoles]);

  // Open/close keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      // Hydrate recents
      try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        setRecent(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        setRecent([]);
      }
    }
  }, [open]);

  // Build candidate list (recent first when empty query, else fuzzy match).
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allCommands = [...navCommands, ...ACTIONS];

    // AI search synthetic item (only when query non-empty)
    const aiItem: CommandItem | null = q
      ? {
          id: 'ai:search',
          name: `AI 搜索: "${query.trim()}"`,
          href: `/search?q=${encodeURIComponent(query.trim())}`,
          group: 'AI',
          icon: Sparkles,
          hint: '在文档 / 决议 / Memory 中检索',
        }
      : null;

    if (!q) {
      // Empty query: show recents first, then top modules + actions
      const recentItems = recent
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((x): x is CommandItem => x != null)
        .map((c) => ({ ...c, group: '最近使用' }));
      const seenIds = new Set(recentItems.map((r) => r.id));
      const rest = allCommands.filter((c) => !seenIds.has(c.id));
      return [...recentItems, ...rest];
    }

    const matched = allCommands.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.group.toLowerCase().includes(q)) return true;
      if (c.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });

    // U1 · Agent intent matches go at top under "智能建议" group
    const agentItems: CommandItem[] = agentMatches.map((m, i) => ({
      id: `ai:intent:${i}:${m.intent}`,
      name: m.label,
      href: m.route,
      group: '智能建议',
      icon: Sparkles,
      hint: m.skill ? `Skill · ${m.skill}` : `${Math.round(m.confidence * 100)}%`,
    }));

    const final = [...agentItems, ...matched];
    return aiItem ? [...final, aiItem] : final;
  }, [query, navCommands, recent, agentMatches]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const c of candidates) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [candidates]);

  // Reset active index when candidates change
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // U1 · Agent intent fetch (debounce 500ms + LRU cache，避免快速打字浪费 token)
  useEffect(() => {
    if (!open) return;
    const q = query.trim().toLowerCase();
    if (q.length < 4) {
      setAgentMatches([]);
      return;
    }

    // 命中缓存直接返回
    const cached = INTENT_CACHE.get(q);
    if (cached && Date.now() - cached.ts < INTENT_CACHE_TTL_MS) {
      setAgentMatches(cached.matches);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const r = await fetch('/api/agent/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        if (!r.ok) return;
        const j = await r.json();
        const matches = j.matches ?? [];
        setAgentMatches(matches);
        intentCacheSet(q, matches);
      } catch {
        /* noop */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, candidates.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const c = candidates[activeIdx];
        if (c) executeCommand(c);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidates, activeIdx]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const executeCommand = useCallback(
    (c: CommandItem) => {
      // Persist to recents (but skip AI synthetic ones)
      if (!c.id.startsWith('ai:')) {
        try {
          const raw = window.localStorage.getItem(RECENT_KEY);
          const prev = raw ? (JSON.parse(raw) as string[]) : [];
          const next = [c.id, ...prev.filter((id) => id !== c.id)].slice(0, RECENT_MAX);
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          /* no-op */
        }
      }
      setOpen(false);
      router.push(c.href);
    },
    [router],
  );

  // Build a flat global index for active highlighting
  let runningIdx = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 glass-thick">
        <DialogTitle className="sr-only">命令面板</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="text-ink-tertiary" />
          <input
            type="text"
            placeholder="搜索页面 · 动作 · AI 检索 ..."
            className="flex-1 bg-transparent text-body outline-none placeholder:text-ink-tertiary"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-tertiary">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-12 text-center text-caption text-ink-tertiary">
              未找到匹配项
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-2">
                <p className="px-4 pb-1 pt-2 text-footnote font-semibold uppercase tracking-wider text-ink-tertiary flex items-center gap-1">
                  {group === '最近使用' && <History className="h-3 w-3" />}
                  {group === 'AI' && <Sparkles className="h-3 w-3 text-[rgb(var(--brand-500))]" />}
                  {group === '动作' && <Plus className="h-3 w-3" />}
                  {group}
                </p>
                {items.map((item) => {
                  runningIdx += 1;
                  const idx = runningIdx;
                  const Icon = item.icon;
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-cmd-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => executeCommand(item)}
                      className={
                        'flex w-full items-center gap-3 px-4 py-2 text-caption text-ink-primary transition-colors duration-instant ' +
                        (isActive
                          ? 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]'
                          : 'hover:bg-surface-2')
                      }
                    >
                      <Icon
                        className={
                          'h-4 w-4 ' +
                          (isActive
                            ? 'text-[rgb(var(--brand-600))]'
                            : 'text-ink-secondary')
                        }
                      />
                      <span className="flex-1 text-left truncate">{item.name}</span>
                      {item.hint && (
                        <span className="text-footnote text-ink-tertiary">{item.hint}</span>
                      )}
                      {isActive && (
                        <ArrowRight className="h-3.5 w-3.5 text-[rgb(var(--brand-600))]" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-footnote text-ink-tertiary">
          <span>
            导航{' '}
            <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↑</kbd>
            <kbd className="ml-0.5 rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↓</kbd>
          </span>
          <span>
            选择{' '}
            <kbd className="rounded border border-border bg-surface-2 px-1 font-mono text-[10px]">↵</kbd>
          </span>
          <span className="ml-auto">⌘K 唤起 · 自动同步 Rail 导航</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
