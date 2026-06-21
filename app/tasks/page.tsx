'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListChecks, Plus, Trash2, Play, Pause, PlayCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCronJobs, runCronAction, createCronJob } from '@/lib/hermes-api';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  status: string;
  [key: string]: string;
}

export default function TasksPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', schedule: '0 9 * * *', prompt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d: any = await getCronJobs();
      if (d?.error) throw new Error(d.error);
      setJobs(d?.jobs || []);
      setRawOutput(d?.raw || '');
    } catch (e: any) {
      setError(e?.message || 'Load failed');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (job: CronJob, action: 'run' | 'pause' | 'resume' | 'delete') => {
    setBusy(job.id + ':' + action);
    setError(null);
    try {
      const apiAction = action === 'delete' ? 'remove' : action;
      const d: any = await runCronAction(job.id, apiAction);
      if (d && d.success === false) throw new Error(d?.error || 'Action failed');
      await load();
    } catch (e: any) {
      setError(e?.message || `${action} failed`);
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schedule.trim()) return;
    setBusy('create');
    setError(null);
    try {
      const d: any = await createCronJob(form);
      if (d && d.success === false) throw new Error(d?.error || 'Create failed');
      setShowNew(false);
      setForm({ name: '', schedule: '0 9 * * *', prompt: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Create failed');
    } finally {
      setBusy(null);
    }
  };

  const statusBadge = (s: string) => {
    const v = s.toLowerCase();
    if (v.includes('pause')) return <Badge variant="secondary">paused</Badge>;
    if (v.includes('error') || v.includes('fail')) return <Badge className="bg-danger">{s}</Badge>;
    if (v.includes('run')) return <Badge className="bg-info">{s}</Badge>;
    return <Badge className="bg-success">{s || 'active'}</Badge>;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="h-6 w-6" /> Tasks <span className="text-footnote text-muted-foreground font-normal">(Hermes cron)</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-caption">
            Scheduled jobs managed by <code className="text-footnote">hermes cron</code>. Changes are live — they persist in the Hermes daemon, not localStorage.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-3 w-3', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowNew((v) => !v)}>
            <Plus className="mr-1 h-3 w-3" /> New Task
          </Button>
        </div>
      </div>

      {showNew && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">Name (optional)</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily Digest" />
                </div>
                <div>
                  <label className="text-footnote font-medium text-muted-foreground">Schedule</label>
                  <Input
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    placeholder="0 9 * * *   (cron)   or   30m / 'every 2h'"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-footnote font-medium text-muted-foreground">Prompt</label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border px-3 py-2 text-caption mt-1 bg-background"
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  placeholder="What should the agent do when this fires?"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={busy === 'create'}>
                  {busy === 'create' ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-caption text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="text-caption text-muted-foreground py-12 text-center">Loading from Hermes…</div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-caption text-muted-foreground">
            <ListChecks className="h-10 w-10 opacity-20 mx-auto mb-2" />
            <p>No scheduled jobs yet.</p>
            <p className="text-footnote mt-1">Click <strong>New Task</strong> to create one, or run <code>hermes cron create</code> in a terminal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const isPaused = job.status.includes('pause');
            return (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-caption">{job.name || job.id}</span>
                        {statusBadge(job.status)}
                        <code className="text-footnote text-muted-foreground">{job.schedule}</code>
                      </div>
                      <div className="text-footnote text-muted-foreground mt-1 font-mono">id: {job.id}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => act(job, 'run')} disabled={!!busy} title="Run now">
                        <Play className="h-3 w-3" />
                      </Button>
                      {isPaused ? (
                        <Button size="sm" variant="outline" onClick={() => act(job, 'resume')} disabled={!!busy} title="Resume">
                          <PlayCircle className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => act(job, 'pause')} disabled={!!busy} title="Pause">
                          <Pause className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => act(job, 'delete')} disabled={!!busy} title="Delete">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {rawOutput && (
        <details className="text-footnote text-muted-foreground">
          <summary className="cursor-pointer">Raw hermes output</summary>
          <pre className="mt-2 p-2 rounded bg-muted overflow-auto whitespace-pre text-[11px]">{rawOutput}</pre>
        </details>
      )}
    </div>
  );
}
