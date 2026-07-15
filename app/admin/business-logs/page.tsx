'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Eye, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BusinessLogEntry } from '@/lib/business-log/types';

interface BusinessLogResponse {
  entries: BusinessLogEntry[];
  hasMore: boolean;
  error?: string;
}

const PAGE_SIZE = 50;

function displayTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value));
}

function outcomeClass(outcome: BusinessLogEntry['outcome']): string {
  if (outcome === 'success') return 'border-success/30 bg-success/10 text-success';
  if (outcome === 'error') return 'border-danger/30 bg-danger/10 text-danger';
  return 'border-warning/30 bg-warning/10 text-warning';
}

const OUTCOME_LABEL: Record<BusinessLogEntry['outcome'], string> = {
  success: '成功', failure: '失败', denied: '拒绝', error: '错误',
};

export default function BusinessLogsPage() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<BusinessLogResponse | null>(null);
  const [selected, setSelected] = useState<BusinessLogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (query.trim()) params.set('q', query.trim());
    if (source !== 'all') params.set('source', source);
    if (outcome !== 'all') params.set('outcome', outcome);
    return params;
  }, [offset, outcome, query, source]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/business-logs?${searchParams}`, { credentials: 'include' });
      const body = await response.json() as BusinessLogResponse;
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => { void load(); }, [load]);

  function updateFilter(setter: (value: string) => void, value: string): void {
    setOffset(0);
    setter(value);
  }

  async function downloadAiContext(): Promise<void> {
    const params = new URLSearchParams(searchParams);
    params.set('format', 'ai');
    params.set('limit', '200');
    params.set('offset', '0');
    const response = await fetch(`/api/business-logs?${params}`, { credentials: 'include' });
    if (!response.ok) {
      setError(`AI JSON export failed: HTTP ${response.status}`);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `business-logs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const entries = data?.entries ?? [];
  const moduleCount = new Set(entries.map((entry) => entry.category)).size;
  const issueCount = entries.filter((entry) => entry.outcome !== 'success').length;

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] overflow-x-hidden px-4 py-5 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-title-1 text-ink-primary">业务日志</h1>
          <div className="mt-1 flex gap-4 text-footnote text-ink-tertiary">
            <span>当前 {entries.length} 条</span><span>业务模块 {moduleCount}</span><span>失败 {issueCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void downloadAiContext()}>
            <Bot className="mr-2 h-4 w-4" />AI JSON
          </Button>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} title="刷新业务日志">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="sr-only">刷新业务日志</span>
          </Button>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2 border-b border-border py-3">
        <div className="relative min-w-[220px] flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)}
            placeholder="模块、业务动作、操作者或业务对象" aria-label="搜索业务日志" className="pl-9" />
        </div>
        <Select value={source} onValueChange={(value) => updateFilter(setSource, value)}>
          <SelectTrigger className="w-[130px]" aria-label="业务日志来源"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="audit">领域审计</SelectItem>
            <SelectItem value="repository">数据操作</SelectItem>
            <SelectItem value="domain">领域事件</SelectItem>
          </SelectContent>
        </Select>
        <Select value={outcome} onValueChange={(value) => updateFilter(setOutcome, value)}>
          <SelectTrigger className="w-[124px]" aria-label="业务结果"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部结果</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failure">失败</SelectItem>
            <SelectItem value="denied">拒绝</SelectItem>
            <SelectItem value="error">错误</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {error && <div className="border-b border-danger/30 bg-danger/5 px-3 py-2 text-caption text-danger">{error}</div>}

      <section className="min-h-[420px] w-full max-w-full overflow-hidden border-b border-border" aria-busy={loading}>
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full table-fixed text-left text-caption">
            <thead className="sticky top-0 z-10 bg-background text-footnote text-ink-tertiary">
              <tr className="border-b border-border">
                <th className="w-[78px] whitespace-nowrap px-3 py-2 font-medium md:w-[132px]">时间</th>
                <th className="hidden w-[148px] px-3 py-2 font-medium sm:table-cell">操作者</th>
                <th className="w-[72px] whitespace-nowrap px-2 py-2 font-medium md:w-[116px] md:px-3">模块</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">业务动作</th>
                <th className="hidden w-[160px] px-3 py-2 font-medium xl:table-cell">业务对象</th>
                <th className="hidden w-[84px] px-3 py-2 font-medium lg:table-cell">结果</th>
                <th className="w-[44px] px-1 py-2 md:w-[52px] md:px-2"><span className="sr-only">详情</span></th>
              </tr>
            </thead>
            <tbody>
              {!loading && entries.length === 0 && <tr><td colSpan={7} className="h-48 text-center text-ink-tertiary">暂无匹配业务日志</td></tr>}
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/70 hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-footnote text-ink-secondary">{displayTime(entry.createdAt)}</td>
                  <td className="hidden truncate px-3 py-2 text-footnote sm:table-cell" title={entry.actorId}>{entry.actorId}</td>
                  <td className="truncate px-2 py-2 font-mono text-footnote md:px-3" title={entry.category}>{entry.category}</td>
                  <td className="px-3 py-2">
                    <div className="truncate font-medium text-ink-primary" title={entry.operation}>{entry.operation}</div>
                    <div className="mt-0.5 truncate text-footnote text-ink-tertiary" title={entry.summary}>
                      <span className="sm:hidden">{entry.actorId} · </span>{entry.summary}
                    </div>
                  </td>
                  <td className="hidden truncate px-3 py-2 font-mono text-footnote text-ink-secondary xl:table-cell" title={entry.targetId ?? undefined}>
                    {entry.targetType ? `${entry.targetType}${entry.targetId ? ` · ${entry.targetId}` : ''}` : '-'}
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    <Badge variant="outline" className={`rounded px-1.5 py-0 ${outcomeClass(entry.outcome)}`}>{OUTCOME_LABEL[entry.outcome]}</Badge>
                  </td>
                  <td className="px-1 py-1.5 text-right md:px-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(entry)} title="查看业务上下文">
                      <Eye className="h-4 w-4" /><span className="sr-only">查看详情</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="flex items-center justify-between py-3 text-footnote text-ink-tertiary">
        <span>{entries.length ? `${offset + 1}-${offset + entries.length}` : '0'}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} title="上一页">
            <ChevronLeft className="h-4 w-4" /><span className="sr-only">上一页</span>
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={!data?.hasMore || loading} onClick={() => setOffset(offset + PAGE_SIZE)} title="下一页">
            <ChevronRight className="h-4 w-4" /><span className="sr-only">下一页</span>
          </Button>
        </div>
      </footer>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="pr-8 text-headline">{selected?.operation}</DialogTitle>
            <DialogDescription>{selected?.createdAt} · {selected?.actorId} · {selected?.source}</DialogDescription>
          </DialogHeader>
          <pre className="m-0 max-h-[calc(85vh-96px)] overflow-auto whitespace-pre-wrap break-all bg-muted/30 p-5 font-mono text-footnote leading-5">
            {selected ? JSON.stringify(selected, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </main>
  );
}
