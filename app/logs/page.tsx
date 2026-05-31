'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  Trash2,
  Pause,
  Play,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowDownToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLogs, type LogLine } from '@/lib/hermes-api';

const LEVEL_COLORS: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DEBUG: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  WARNING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ERROR: 'bg-danger/10 text-danger dark:bg-danger dark:text-danger',
  CRITICAL: 'bg-danger/20 text-danger dark:bg-danger dark:text-danger',
  UNKNOWN: 'bg-muted text-muted-foreground',
};

const POLL_MS = 4000;

export default function LogsPage() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [componentFilter, setComponentFilter] = useState('all');
  const [logName, setLogName] = useState<'agent' | 'errors' | 'gateway'>('agent');
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await getLogs({
        log: logName,
        lines: 300,
        level: levelFilter,
        component: componentFilter,
      });
      if (!data.ok) {
        setError(data.error || 'Unknown error');
      } else {
        setError(null);
        setLogs((data.logs || []) as LogLine[]);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [logName, levelFilter, componentFilter]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(fetchLogs, POLL_MS);
    return () => clearInterval(id);
  }, [paused, fetchLogs]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [logs, autoScroll]);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      l.message.toLowerCase().includes(q) ||
      l.component.toLowerCase().includes(q) ||
      l.level.toLowerCase().includes(q)
    );
  });

  // Discover unique components from current logs to populate filter
  const components = Array.from(
    new Set(logs.map((l) => l.component).filter(Boolean))
  ).sort();

  return (
    <div className="space-y-4 h-full flex flex-col md:px-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-title-2 font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7" />
            Activity Logs
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            Live tail of <code className="font-mono">~/AppData/Local/hermes/logs/{logName}.log</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoScroll ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoScroll((v) => !v)}
            title="Auto-scroll to newest"
          >
            <ArrowDownToLine size={14} className="mr-1" />
            Auto-scroll
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={14} className={cn('mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={14} className="mr-1" /> : <Pause size={14} className="mr-1" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            <Trash2 size={14} className="mr-1" /> Clear view
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={logName} onValueChange={(v) => setLogName(v as any)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">agent.log</SelectItem>
            <SelectItem value="errors">errors.log</SelectItem>
            <SelectItem value="gateway">gateway.log</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Filter text…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64"
        />
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="DEBUG">Debug+</SelectItem>
            <SelectItem value="INFO">Info+</SelectItem>
            <SelectItem value="WARNING">Warning+</SelectItem>
            <SelectItem value="ERROR">Error+</SelectItem>
          </SelectContent>
        </Select>
        <Select value={componentFilter} onValueChange={setComponentFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Component" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Components</SelectItem>
            <SelectItem value="agent">agent</SelectItem>
            <SelectItem value="tools">tools</SelectItem>
            <SelectItem value="cli">cli</SelectItem>
            <SelectItem value="cron">cron</SelectItem>
            <SelectItem value="gateway">gateway</SelectItem>
            {components
              .filter((c) => !['agent', 'tools', 'cli', 'cron', 'gateway'].includes(c))
              .slice(0, 30)
              .map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-start gap-2 text-caption text-destructive">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Failed to load logs</div>
              <div className="font-mono text-footnote mt-1 break-all">{error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-caption font-medium text-muted-foreground flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {filtered.length} entries shown ({logs.length} loaded)
            {!paused && <span className="text-footnote">· refreshing every {POLL_MS / 1000}s</span>}
            {paused && <span className="text-footnote text-yellow-600">· paused</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-[calc(100vh-22rem)] px-4">
            <div className="space-y-0.5 font-mono text-footnote py-2">
              {filtered.length === 0 && !loading && (
                <div className="text-center text-muted-foreground py-12">
                  {logs.length === 0
                    ? 'No log entries. Backend may be idle, or hermes log file is empty.'
                    : 'No entries match current filter.'}
                </div>
              )}
              {filtered.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 rounded px-2 py-0.5 hover:bg-muted/50"
                >
                  {log.timestamp && (
                    <span className="shrink-0 text-[10px] text-muted-foreground w-32">
                      {log.timestamp}
                    </span>
                  )}
                  <Badge
                    className={cn(
                      'shrink-0 text-[9px] px-1.5 py-0 h-4 font-mono',
                      LEVEL_COLORS[log.level]
                    )}
                  >
                    {log.level}
                  </Badge>
                  {log.component && (
                    <span className="shrink-0 text-[10px] text-muted-foreground w-44 truncate">
                      {log.component}
                    </span>
                  )}
                  <span className="break-all whitespace-pre-wrap">{log.message}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
