'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHermesStatus } from '@/lib/hooks';
import { HERMES_TOOLS, TOOL_CATEGORIES, type HermesTool } from '@/lib/hermes-tools';
import { getMCPServers, type MCPServer } from '@/lib/hermes-api';
import {
  Cpu,
  Search,
  Globe,
  Terminal,
  FileCode,
  Code2,
  Eye,
  Image,
  Network,
  Volume2,
  BookOpen,
  ListTodo,
  Brain,
  History,
  HelpCircle,
  GitBranch,
  CalendarClock,
  MessageCircle,
  Zap,
  Home,
  Music,
  Server,
  Loader2,
  CheckCircle2,
  XCircle,
  KeyRound,
} from 'lucide-react';

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  web: { label: 'Web', icon: Globe, color: 'bg-info' },
  system: { label: 'System', icon: Terminal, color: 'bg-slate-500' },
  code: { label: 'Code', icon: Code2, color: 'bg-emerald-500' },
  media: { label: 'Media', icon: Image, color: 'bg-pink-500' },
  agent: { label: 'Agent', icon: Network, color: 'bg-purple-500' },
  productivity: { label: 'Productivity', icon: ListTodo, color: 'bg-warning' },
  messaging: { label: 'Messaging', icon: MessageCircle, color: 'bg-cyan-500' },
  ml: { label: 'ML', icon: Zap, color: 'bg-orange-500' },
  iot: { label: 'IoT', icon: Home, color: 'bg-teal-500' },
};

const TOOL_ICONS: Record<string, React.ElementType> = {
  web_search: Search,
  browser: Globe,
  terminal: Terminal,
  file: FileCode,
  execute_code: Code2,
  vision_analyze: Eye,
  image_generate: Image,
  mixture_of_agents: Network,
  text_to_speech: Volume2,
  skills_mgmt: BookOpen,
  todo: ListTodo,
  memory: Brain,
  session_search: History,
  clarify: HelpCircle,
  delegate_task: GitBranch,
  cronjob: CalendarClock,
  send_message: MessageCircle,
  rl_training: Zap,
  homeassistant: Home,
  spotify: Music,
};

export default function MCPPage() {
  const { connected, checking, version, error } = useHermesStatus();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data: any = await getMCPServers();
        if (cancelled) return;
        if (!data.ok && data.error) setServersError(data.error);
        setServers(data.servers || []);
      } catch (e: any) {
        if (!cancelled) setServersError(e?.message || 'Network error');
      } finally {
        if (!cancelled) setServersLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HERMES_TOOLS.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.commands.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [query, activeCategory]);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-title-3 font-bold tracking-tight flex items-center gap-2">
              <Cpu className="h-6 w-6" />
              MCP Server &amp; Tools
            </h1>
            <p className="text-caption text-muted-foreground mt-1">
              {HERMES_TOOLS.length} built-in Hermes tools across {TOOL_CATEGORIES.length} categories.
            </p>
          </div>

          <Card className="min-w-[260px]">
            <CardContent className="p-4 flex items-center gap-3" title={error || version || ''}>
              {checking ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : connected ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <XCircle className="h-5 w-5 text-danger" />
              )}
              <div className="flex flex-col">
                <span className="text-footnote text-muted-foreground">Backend</span>
                <span className="text-caption font-medium">
                  {checking ? 'Checking…' : connected ? 'Online' : 'Offline'}
                </span>
                {(version || error) && (
                  <span className="text-footnote text-muted-foreground truncate max-w-[200px]">
                    {error || version}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-body flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Configured MCP Servers
              </span>
              <Badge variant="secondary">{servers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {serversLoading ? (
              <div className="flex items-center gap-2 text-caption text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading from <code>hermes mcp list</code>…
              </div>
            ) : serversError ? (
              <div className="text-caption text-destructive">{serversError}</div>
            ) : servers.length === 0 ? (
              <div className="text-caption text-muted-foreground">
                No MCP servers configured. Add one with{' '}
                <code className="px-1.5 py-0.5 rounded bg-muted text-footnote font-mono">
                  hermes mcp add &lt;name&gt; --url &lt;endpoint&gt;
                </code>
                .
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {servers.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/30"
                  >
                    <div
                      className={`h-8 w-8 rounded-md flex items-center justify-center text-white shrink-0 ${
                        s.enabled ? 'bg-success' : 'bg-slate-400'
                      }`}
                    >
                      <Network className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-caption truncate">{s.name}</span>
                        {s.status && (
                          <Badge variant={s.enabled ? 'secondary' : 'outline'} className="text-[10px]">
                            {s.status}
                          </Badge>
                        )}
                      </div>
                      {s.endpoint && (
                        <p className="text-footnote text-muted-foreground font-mono truncate mt-0.5">
                          {s.endpoint}
                        </p>
                      )}
                      {s.type && (
                        <p className="text-footnote text-muted-foreground mt-0.5">{s.type}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-headline font-semibold mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Built-in Hermes Tools
            <Badge variant="secondary" className="ml-1">{HERMES_TOOLS.length}</Badge>
          </h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools, commands, descriptions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={activeCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            All ({HERMES_TOOLS.length})
          </Button>
          {TOOL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat] || { label: cat, icon: Server, color: 'bg-ink-tertiary' };
            const Icon = meta.icon;
            const count = HERMES_TOOLS.filter((t) => t.category === cat).length;
            return (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className="gap-1"
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label} ({count})
              </Button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              No tools match your filter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function ToolCard({ tool }: { tool: HermesTool }) {
  const meta = CATEGORY_META[tool.category] || { label: tool.category, icon: Server, color: 'bg-ink-tertiary' };
  const Icon = TOOL_ICONS[tool.id] || meta.icon;
  return (
    <Card className="transition-colors hover:bg-muted/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-9 w-9 rounded-md ${meta.color} flex items-center justify-center text-white shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-body truncate">{tool.name}</CardTitle>
              <p className="text-footnote text-muted-foreground font-mono truncate">{tool.id}</p>
            </div>
          </div>
          {tool.noApiKey ? (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Free
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 gap-1">
              <KeyRound className="h-3 w-3" />
              API Key
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-caption text-muted-foreground">{tool.description}</p>
        <div className="flex flex-wrap gap-1">
          {tool.commands.map((cmd) => (
            <code
              key={cmd}
              className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono text-foreground/80"
            >
              {cmd}
            </code>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
