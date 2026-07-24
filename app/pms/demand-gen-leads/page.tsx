/**
 * PMS · 线索开发 (Demand Gen, 内部)
 * 列出线索, 支持培育/放弃流转。转化商机需在商机模块操作。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface Lead {
  id: string;
  source: string;
  customerName: string;
  contactPhone?: string;
  region?: string;
  status: string;
  assignedTo?: string;
  convertedOpportunityId?: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  new: { badge: 'bg-surface-2 text-ink-secondary', label: '新线索' },
  assigned: { badge: 'bg-info/10 text-info', label: '已分配' },
  nurturing: { badge: 'bg-warning/10 text-warning', label: '培育中' },
  converted: { badge: 'bg-success/10 text-success', label: '已转化' },
  dropped: { badge: 'bg-danger/10 text-danger', label: '已放弃' },
};

const NEXT: Record<string, Array<{ to: string; label: string }>> = {
  assigned: [{ to: 'nurturing', label: '转培育' }, { to: 'dropped', label: '放弃' }],
  nurturing: [{ to: 'dropped', label: '放弃' }],
  new: [{ to: 'dropped', label: '放弃' }],
};

export default function PmsDemandGenPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/demand-gen-leads', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function transition(id: string, toStatus: string) {
    try {
      setActing(id + toStatus);
      setError(null);
      const res = await fetch('/api/pms/demand-gen-leads', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transition', id, toStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '操作失败');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-500" />
          线索开发
        </h1>
        <p className="text-body text-ink-secondary mt-1">早期线索 · 分配培育 · 转化商机</p>
      </div>

      {error && (
        <Card className="mb-4 border-danger/30">
          <CardContent className="p-4 text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无线索</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {leads.map((l) => {
            const s = STATUS_STYLE[l.status] || STATUS_STYLE.new;
            const nexts = NEXT[l.status] || [];
            return (
              <Card key={l.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-caption ${s.badge}`}>{s.label}</span>
                      <span className="text-caption text-ink-tertiary">{l.source}</span>
                    </div>
                    <h3 className="text-headline font-semibold text-ink-primary">{l.customerName}</h3>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {l.region ? `${l.region} · ` : ''}
                      {l.contactPhone || '无电话'}
                      {l.assignedTo ? ` · 负责 ${l.assignedTo}` : ''}
                    </p>
                  </div>
                  {nexts.length > 0 && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {nexts.map((n) => (
                        <Button
                          key={n.to}
                          size="sm"
                          variant={n.to === 'dropped' ? 'outline' : 'default'}
                          className={
                            n.to === 'dropped'
                              ? 'rounded-2xl text-danger border-danger/30'
                              : 'rounded-2xl bg-brand-500 hover:bg-brand-600'
                          }
                          disabled={acting === l.id + n.to}
                          onClick={() => transition(l.id, n.to)}
                        >
                          {acting === l.id + n.to ? '...' : n.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
