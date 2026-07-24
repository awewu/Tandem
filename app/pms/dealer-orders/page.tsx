/**
 * PMS · 经销商在线订货
 * 列出订货单, 内部可流转 (确认→发货→完成; 可取消)。dealerOrgId 隔离。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface DealerOrder {
  id: string;
  dealerOrgId: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  pending: { badge: 'bg-surface-2 text-ink-secondary', label: '待确认' },
  confirmed: { badge: 'bg-info/10 text-info', label: '已确认' },
  shipped: { badge: 'bg-warning/10 text-warning', label: '已发货' },
  completed: { badge: 'bg-success/10 text-success', label: '已完成' },
  cancelled: { badge: 'bg-danger/10 text-danger', label: '已取消' },
};

const NEXT: Record<string, Array<{ to: string; label: string }>> = {
  pending: [{ to: 'confirmed', label: '确认' }, { to: 'cancelled', label: '取消' }],
  confirmed: [{ to: 'shipped', label: '发货' }, { to: 'cancelled', label: '取消' }],
  shipped: [{ to: 'completed', label: '完成' }],
};

export default function PmsDealerOrdersPage() {
  const [orders, setOrders] = useState<DealerOrder[]>([]);
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
      const res = await fetch('/api/pms/dealer-orders', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setOrders(data.orders || []);
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
      const res = await fetch('/api/pms/dealer-orders', {
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
          <ShoppingCart className="w-6 h-6 text-brand-500" />
          在线订货
        </h1>
        <p className="text-body text-ink-secondary mt-1">经销商下单 · 确认发货全流程</p>
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
          <CardContent className="p-12 text-center text-ink-secondary">暂无订货单</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => {
            const s = STATUS_STYLE[o.status] || STATUS_STYLE.pending;
            const nexts = NEXT[o.status] || [];
            return (
              <Card key={o.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-caption ${s.badge}`}>{s.label}</span>
                      <span className="text-caption text-ink-tertiary font-mono">{o.orderNumber}</span>
                    </div>
                    <h3 className="text-headline font-semibold text-ink-primary">{o.dealerOrgId}</h3>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {(o.items?.length ?? 0)} 项 · {new Date(o.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-headline font-bold text-brand-500 mb-2">
                      ¥{o.totalAmount?.toLocaleString('zh-CN')}
                    </p>
                    {nexts.length > 0 && (
                      <div className="flex gap-2 justify-end">
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
