/**
 * PMS · 告警中心
 * 展示分级推送告警 (价格审批/订货确认/维保派单/交付派工/合同排产 等), 支持处理(ack).
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface PmsAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityType: string;
  entityId: string;
  message: string;
  acted: boolean;
  createdAt: string;
}

const SEVERITY_STYLE: Record<string, { badge: string; icon: JSX.Element; label: string }> = {
  critical: { badge: 'bg-danger/10 text-danger', icon: <AlertTriangle className="w-4 h-4" />, label: '紧急' },
  high: { badge: 'bg-warning/10 text-warning', icon: <AlertTriangle className="w-4 h-4" />, label: '高' },
  medium: { badge: 'bg-warning/10 text-warning', icon: <Bell className="w-4 h-4" />, label: '中' },
  low: { badge: 'bg-surface-2 text-ink-secondary', icon: <Info className="w-4 h-4" />, label: '低' },
};

export default function PmsAlertsPage() {
  const [alerts, setAlerts] = useState<PmsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActed, setShowActed] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showActed]);

  async function loadAlerts() {
    try {
      setLoading(true);
      setError(null);
      const url = showActed ? '/api/pms/alerts' : '/api/pms/alerts?acted=false';
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function ackAlert(id: string) {
    try {
      setActing(id);
      const res = await fetch('/api/pms/alerts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ack', id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '处理失败');
      await loadAlerts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-500" />
            告警中心
          </h1>
          <p className="text-body text-ink-secondary mt-1">分级推送 · 待办与已处理事项</p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => setShowActed((v) => !v)}
        >
          {showActed ? '仅看待处理' : '查看全部'}
        </Button>
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
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">
            {showActed ? '暂无告警' : '没有待处理告警 🎉'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {alerts.map((a) => {
            const s = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.low;
            return (
              <Card key={a.id} className={a.acted ? 'opacity-60' : ''}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption ${s.badge}`}>
                        {s.icon}
                        {s.label}
                      </span>
                      <span className="text-caption text-ink-tertiary">{a.type}</span>
                    </div>
                    <p className="text-body text-ink-primary">{a.message}</p>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {a.entityType} · {new Date(a.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {a.acted ? (
                    <span className="inline-flex items-center gap-1 text-caption text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      已处理
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-2xl bg-brand-500 hover:bg-brand-600"
                      disabled={acting === a.id}
                      onClick={() => ackAlert(a.id)}
                    >
                      {acting === a.id ? '处理中...' : '标记处理'}
                    </Button>
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
