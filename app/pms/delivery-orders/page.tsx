/**
 * PMS · 交付工单
 * 列出交付工单, 支持状态流转 (排期→交付→完成; 可取消)。orgId 隔离。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck } from 'lucide-react';

interface DeliveryOrder {
  id: string;
  orgId: string;
  contractId: string;
  orderNumber: string;
  customerName: string;
  deliveryAddress: string;
  status: string;
  scheduledDeliveryDate?: string;
  actualDeliveryDate?: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending: { badge: 'bg-surface-2 text-ink-secondary', label: '待排期' },
  scheduled: { badge: 'bg-info/10 text-info', label: '已排期' },
  delivered: { badge: 'bg-warning/10 text-warning', label: '已交付' },
  completed: { badge: 'bg-success/10 text-success', label: '已完成' },
  cancelled: { badge: 'bg-danger/10 text-danger', label: '已取消' },
};

// 下一步可选流转
const NEXT: Record<string, Array<{ to: string; label: string }>> = {
  pending: [{ to: 'scheduled', label: '排期' }, { to: 'cancelled', label: '取消' }],
  scheduled: [{ to: 'delivered', label: '标记交付' }, { to: 'cancelled', label: '取消' }],
  delivered: [{ to: 'completed', label: '完成' }],
};

export default function PmsDeliveryOrdersPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
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
      const res = await fetch('/api/pms/delivery-orders', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function transition(orderId: string, toStatus: string) {
    try {
      setActing(orderId + toStatus);
      setError(null);
      const body: any = { action: 'transition', orderId, toStatus };
      if (toStatus === 'scheduled') {
        body.scheduledDeliveryDate = new Date().toISOString().slice(0, 10);
      }
      const res = await fetch('/api/pms/delivery-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          <Truck className="w-6 h-6 text-brand-500" />
          交付工单
        </h1>
        <p className="text-body text-ink-secondary mt-1">合同生效自动生成 · 排期到货全流程</p>
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
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无交付工单</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => {
            const s = STATUS_STYLE[o.status] || STATUS_STYLE.pending;
            const nexts = NEXT[o.status] || [];
            return (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-caption ${s.badge}`}>{s.label}</span>
                        <span className="text-caption text-ink-tertiary font-mono">{o.orderNumber}</span>
                      </div>
                      <h3 className="text-headline font-semibold text-ink-primary">{o.customerName}</h3>
                      <p className="text-body text-ink-secondary mt-1">{o.deliveryAddress}</p>
                      <p className="text-caption text-ink-tertiary mt-1">
                        {o.scheduledDeliveryDate ? `排期 ${o.scheduledDeliveryDate}` : '未排期'}
                        {o.actualDeliveryDate ? ` · 交付 ${o.actualDeliveryDate}` : ''}
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
                            disabled={acting === o.id + n.to}
                            onClick={() => transition(o.id, n.to)}
                          >
                            {acting === o.id + n.to ? '...' : n.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
