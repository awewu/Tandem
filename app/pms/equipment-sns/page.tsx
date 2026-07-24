/**
 * PMS · 设备 SN 台账 (全生命周期溯源)
 * 列出设备 SN, 展示状态与保修有效性。内部查看全量。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Cpu, ShieldCheck, ShieldX } from 'lucide-react';

interface EquipmentSN {
  id: string;
  snCode: string;
  productId: string;
  productModel: string;
  batchNumber?: string;
  status: string;
  deliveryOrderId?: string;
  installedAt?: string;
  warrantyExpiresAt?: string;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  in_stock: { badge: 'bg-surface-2 text-ink-secondary', label: '在库' },
  shipped: { badge: 'bg-info/10 text-info', label: '已发货' },
  installed: { badge: 'bg-success/10 text-success', label: '已安装' },
  active: { badge: 'bg-success/10 text-success', label: '运行中' },
  retired: { badge: 'bg-danger/10 text-danger', label: '已退役' },
};

function warrantyValid(exp?: string): boolean {
  if (!exp) return false;
  return new Date(exp).getTime() >= Date.now();
}

export default function PmsEquipmentSnsPage() {
  const [sns, setSns] = useState<EquipmentSN[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/equipment-sns', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setSns(data.sns || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <Cpu className="w-6 h-6 text-brand-500" />
          设备台账
        </h1>
        <p className="text-body text-ink-secondary mt-1">SN 全生命周期溯源 · 保修状态</p>
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
      ) : sns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无设备记录</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sns.map((sn) => {
            const s = STATUS_STYLE[sn.status] || { badge: 'bg-surface-2 text-ink-secondary', label: sn.status };
            const valid = warrantyValid(sn.warrantyExpiresAt);
            return (
              <Card key={sn.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-caption ${s.badge}`}>{s.label}</span>
                      <span className="text-caption text-ink-tertiary font-mono">{sn.snCode}</span>
                    </div>
                    <h3 className="text-headline font-semibold text-ink-primary">{sn.productModel}</h3>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {sn.batchNumber ? `批次 ${sn.batchNumber} · ` : ''}
                      {sn.installedAt ? `安装 ${sn.installedAt}` : '未安装'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {sn.warrantyExpiresAt ? (
                      <span
                        className={`inline-flex items-center gap-1 text-caption ${valid ? 'text-success' : 'text-danger'}`}
                      >
                        {valid ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                        {valid ? '保修中' : '已过保'}
                      </span>
                    ) : (
                      <span className="text-caption text-ink-tertiary">无保修信息</span>
                    )}
                    {sn.warrantyExpiresAt && (
                      <p className="text-caption text-ink-tertiary mt-1">至 {sn.warrantyExpiresAt}</p>
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
