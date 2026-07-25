'use client';

/**
 * PMS · 信息管理岗工作台 — exception-driven, 一屏清零
 * 待仲裁申诉 / 未解决查重 / 生命周期预警 / 数据质量体检 / 合同积压
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, GitCompareArrows, Clock, DatabaseZap, FileWarning, RefreshCw, Check, X } from 'lucide-react';

interface Appeal { id: string; duplicateCheckId: string; appealerId: string; reason: string; status: string; createdAt: string }
interface Dup { id: string; status: string; similarityScore: number; dimensions: string[]; duplicateOpportunityId?: string; createdAt: string }
interface Life { id: string; customerName: string; projectName: string; stage: string; days: number; level: 'yellow' | 'red' }
interface Dq { id: string; customerName: string; projectName: string; issues: string[] }
interface DealDesk {
  generatedAt: string;
  appeals: { total: number; items: Appeal[] };
  duplicates: { total: number; items: Dup[] };
  lifecycle: { yellow: number; red: number; items: Life[] };
  dataQuality: { missingContact: number; orphan: number; items: Dq[] };
  contracts: { pending: number; amount: number };
}

const money = (n: number) => '¥' + (n ?? 0).toLocaleString('zh-CN');

export default function DealDeskPage() {
  const [data, setData] = useState<DealDesk | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'forbidden'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/pms/deal-desk', { credentials: 'include', cache: 'no-store' });
      if (res.status === 403) { setStatus('forbidden'); return; }
      if (!res.ok) { setStatus('error'); return; }
      const json = await res.json();
      setData(json.dealDesk);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const arbitrate = async (appealId: string, decision: 'approved' | 'rejected') => {
    setBusy(appealId);
    try {
      const res = await fetch('/api/pms/deal-desk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'arbitrate', appealId, decision }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  if (status === 'loading') return <div className="p-6 text-ink-tertiary">加载中…</div>;
  if (status === 'forbidden') return <div className="p-6 text-ink-secondary">信息管理岗工作台仅限内部管理角色访问。</div>;
  if (status === 'error' || !data) return <div className="p-6 text-danger">加载失败，请重试。</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-brand-500" /> 信息管理岗工作台
          </h1>
          <p className="text-caption text-ink-tertiary mt-1">统筹报备质量 · 撞单裁决 · 生命周期 · 数据治理 — 逐条清零</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />刷新</Button>
      </div>

      {/* 概览计数 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={<ClipboardList className="w-4 h-4" />} label="待仲裁申诉" value={data.appeals.total} accent={data.appeals.total > 0 ? 'warning' : undefined} />
        <Stat icon={<GitCompareArrows className="w-4 h-4" />} label="未解决查重" value={data.duplicates.total} accent={data.duplicates.total > 0 ? 'warning' : undefined} />
        <Stat icon={<Clock className="w-4 h-4" />} label="生命周期预警" value={data.lifecycle.yellow + data.lifecycle.red} accent={data.lifecycle.red > 0 ? 'danger' : data.lifecycle.yellow > 0 ? 'warning' : undefined} />
        <Stat icon={<DatabaseZap className="w-4 h-4" />} label="数据质量问题" value={data.dataQuality.missingContact + data.dataQuality.orphan} accent={(data.dataQuality.missingContact + data.dataQuality.orphan) > 0 ? 'warning' : undefined} />
        <Stat icon={<FileWarning className="w-4 h-4" />} label="合同积压" value={data.contracts.pending} sub={money(data.contracts.amount)} accent={data.contracts.pending > 0 ? 'warning' : undefined} />
      </div>

      {/* 待仲裁申诉 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">待仲裁撞单申诉 ({data.appeals.total})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.appeals.items.length === 0 ? <Empty text="无待仲裁申诉" /> : data.appeals.items.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2">
              <div className="min-w-0">
                <p className="text-body text-ink-primary truncate">{a.reason}</p>
                <p className="text-caption text-ink-tertiary">申诉人 {a.appealerId} · {a.status} · {new Date(a.createdAt).toLocaleDateString('zh-CN')}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" disabled={busy === a.id} onClick={() => arbitrate(a.id, 'approved')}><Check className="w-4 h-4 mr-1" />成立</Button>
                <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => arbitrate(a.id, 'rejected')}><X className="w-4 h-4 mr-1" />维持</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 未解决查重 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">未解决查重冲突 ({data.duplicates.total})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.duplicates.items.length === 0 ? <Empty text="无未解决查重" /> : data.duplicates.items.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2">
              <div className="min-w-0">
                <p className="text-body text-ink-primary">相似度 {Math.round(d.similarityScore * 100)}% · <span className={d.status === 'duplicate' ? 'text-danger' : 'text-warning'}>{d.status === 'duplicate' ? '撞单' : '疑似'}</span></p>
                <p className="text-caption text-ink-tertiary truncate">命中维度: {d.dimensions.join(' / ') || '—'}</p>
              </div>
              <span className="text-caption text-ink-tertiary shrink-0">{new Date(d.createdAt).toLocaleDateString('zh-CN')}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 生命周期预警 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">商机生命周期预警 (黄 {data.lifecycle.yellow} · 红 {data.lifecycle.red})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.lifecycle.items.length === 0 ? <Empty text="无超期商机" /> : data.lifecycle.items.map((l) => (
            <a key={l.id} href={`/pms/opportunities/${l.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors">
              <div className="min-w-0">
                <p className="text-body text-ink-primary truncate">{l.customerName} · {l.projectName}</p>
                <p className="text-caption text-ink-tertiary">{l.stage}</p>
              </div>
              <span className={`text-caption shrink-0 ${l.level === 'red' ? 'text-danger' : 'text-warning'}`}>{l.days} 天无跟进</span>
            </a>
          ))}
        </CardContent>
      </Card>

      {/* 数据质量体检 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">数据质量体检 (缺联系方式 {data.dataQuality.missingContact} · 孤儿商机 {data.dataQuality.orphan})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.dataQuality.items.length === 0 ? <Empty text="数据质量良好" /> : data.dataQuality.items.map((q) => (
            <a key={q.id} href={`/pms/opportunities/${q.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors">
              <div className="min-w-0">
                <p className="text-body text-ink-primary truncate">{q.customerName} · {q.projectName}</p>
              </div>
              <span className="text-caption text-warning shrink-0">{q.issues.join(' · ')}</span>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, sub, accent }: { icon: JSX.Element; label: string; value: number; sub?: string; accent?: 'danger' | 'warning' }) {
  const cls = accent === 'danger' ? 'text-danger' : accent === 'warning' ? 'text-warning' : 'text-ink-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-ink-tertiary mb-2">{icon}<span className="text-caption">{label}</span></div>
        <p className={`text-title-lg font-bold ${cls}`}>{value}</p>
        {sub && <p className="text-caption text-ink-tertiary mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-caption text-ink-tertiary py-2">{text}</p>;
}
