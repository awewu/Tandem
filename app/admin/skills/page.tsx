'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SkillRecord, SkillStatus } from '@/lib/taf/skills/governance';

const STATUS_META: Record<SkillStatus, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  draft: { label: '草稿', icon: Clock, cls: 'bg-slate-100 text-slate-700' },
  submitted: { label: '待审批', icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  staging: { label: '灰度', icon: ShieldAlert, cls: 'bg-blue-100 text-blue-700' },
  approved: { label: '已通过', icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '已驳回', icon: XCircle, cls: 'bg-rose-100 text-rose-700' },
  suspended: { label: '已下线', icon: ShieldX, cls: 'bg-red-100 text-red-700' },
};

export default function SkillsGovernancePage() {
  const [records, setRecords] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/skills/governance');
      if (r.ok) {
        const d = await r.json();
        setRecords(d.records ?? []);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function act(recordId: string, action: 'submit' | 'review' | 'suspend', extra?: Record<string, unknown>) {
    setBusy(recordId);
    try {
      await fetch('/api/skills/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, recordId, ...(extra ?? {}) }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" /> Skills 治理中心
        </h1>
        <p className="text-sm text-slate-500 mt-1">企业级 Skill 注册 · 提交 · 审批 · 灰度 · 下线 全生命周期</p>
      </header>

      {loading ? (
        <div className="text-center py-12 text-slate-400"><Loader2 className="inline h-5 w-5 animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          还没有注册的 Skill. 开发者用 <code className="px-1 bg-slate-100 rounded">registerSkillDraft()</code> 创建后, 会出现在这里.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const meta = STATUS_META[r.status];
            const Icon = meta.icon;
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold">{r.skillId}</span>
                      <span className="text-xs text-slate-400">v{r.version}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{r.zone}</Badge>
                    </div>
                    <div className="text-sm text-slate-700">{r.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      作者: {r.authorUserId} · 调用 {r.invocationCount} 次 (err {r.errorCount}) · 更新于 {new Date(r.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {r.status === 'draft' && (
                      <Button size="sm" disabled={busy === r.id} onClick={() => act(r.id, 'submit')}>
                        {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '提审'}
                      </Button>
                    )}
                    {r.status === 'submitted' && (
                      <>
                        <Button size="sm" variant="default" disabled={busy === r.id} onClick={() => act(r.id, 'review', { decision: 'approve' })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> 通过
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => act(r.id, 'review', { decision: 'reject', comment: prompt('驳回原因?') ?? undefined })}>
                          <XCircle className="h-3 w-3 mr-1" /> 驳回
                        </Button>
                      </>
                    )}
                    {(r.status === 'approved' || r.status === 'staging') && (
                      <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => {
                        const reason = prompt('下线原因?');
                        if (reason) void act(r.id, 'suspend', { reason });
                      }}>
                        <ShieldX className="h-3 w-3 mr-1" /> 下线
                      </Button>
                    )}
                  </div>
                </div>
                {r.reviewHistory.length > 0 && (
                  <details className="mt-2 text-xs text-slate-500">
                    <summary className="cursor-pointer">审批历史 ({r.reviewHistory.length})</summary>
                    <ul className="mt-1 space-y-1 ml-4">
                      {r.reviewHistory.map((rv) => (
                        <li key={rv.id}>
                          <span className="font-medium">{rv.reviewerId}</span> · {rv.decision}
                          {rv.comment && <span className="text-slate-400"> · {rv.comment}</span>}
                          <span className="text-slate-300 ml-2">{new Date(rv.at).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
