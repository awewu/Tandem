/**
 * PMS · 维保工单 (售后 FSM)
 * 列出维保记录, 内部可流转 (处理中 / 完成 / 取消)。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench } from 'lucide-react';

interface MaintenanceRecord {
  id: string;
  equipmentSNId: string;
  type: string;
  reportedBy: string;
  assignedTo?: string;
  description: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending: { badge: 'bg-surface-2 text-ink-secondary', label: '待派工' },
  assigned: { badge: 'bg-info/10 text-info', label: '已派工' },
  in_progress: { badge: 'bg-warning/10 text-warning', label: '处理中' },
  completed: { badge: 'bg-success/10 text-success', label: '已完成' },
  cancelled: { badge: 'bg-danger/10 text-danger', label: '已取消' },
};

const NEXT: Record<string, Array<{ to: string; label: string }>> = {
  assigned: [{ to: 'in_progress', label: '开始处理' }, { to: 'cancelled', label: '取消' }],
  in_progress: [{ to: 'completed', label: '完成' }],
  pending: [{ to: 'cancelled', label: '取消' }],
};

export default function PmsMaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
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
      const res = await fetch('/api/pms/maintenance', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setRecords(data.records || []);
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
      const res = await fetch('/api/pms/maintenance', {
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
          <Wrench className="w-6 h-6 text-brand-500" />
          维保工单
        </h1>
        <p className="text-body text-ink-secondary mt-1">报修 · 派工 · 处理 · 完成</p>
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
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无维保工单</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {records.map((r) => {
            const s = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
            const nexts = NEXT[r.status] || [];
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-caption ${s.badge}`}>{s.label}</span>
                      <span className="text-caption text-ink-tertiary">{r.type}</span>
                    </div>
                    <p className="text-body text-ink-primary">{r.description}</p>
                    <p className="text-caption text-ink-tertiary mt-1">
                      设备 {r.equipmentSNId} · {new Date(r.createdAt).toLocaleDateString('zh-CN')}
                      {r.assignedTo ? ` · 派工 ${r.assignedTo}` : ''}
                    </p>
                  </div>
                  {nexts.length > 0 && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {nexts.map((n) => (
                        <Button
                          key={n.to}
                          size="sm"
                          variant={n.to === 'cancelled' ? 'outline' : 'default'}
                          className={
                            n.to === 'cancelled'
                              ? 'rounded-2xl text-danger border-danger/30'
                              : 'rounded-2xl bg-brand-500 hover:bg-brand-600'
                          }
                          disabled={acting === r.id + n.to}
                          onClick={() => transition(r.id, n.to)}
                        >
                          {acting === r.id + n.to ? '...' : n.label}
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
