/**
 * PMS · 主推产品推广
 * 列出推广活动, 展示目标/实际进度。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone } from 'lucide-react';

interface Campaign {
  id: string;
  productId: string;
  name: string;
  targetSales: number;
  actualSales: number;
  progress: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function PmsCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/key-product-campaigns', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
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
          <Megaphone className="w-6 h-6 text-brand-500" />
          主推产品
        </h1>
        <p className="text-body text-ink-secondary mt-1">推广目标 · 进度追踪</p>
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
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无推广活动</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-headline font-semibold text-ink-primary">{c.name}</h3>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {c.startDate} ~ {c.endDate} · {c.status}
                    </p>
                  </div>
                  <span className="text-title-lg font-bold text-brand-500">{c.progress}%</span>
                </div>
                <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, c.progress)}%` }}
                  />
                </div>
                <p className="text-caption text-ink-tertiary mt-2">
                  实际 {c.actualSales?.toLocaleString('zh-CN')} / 目标 {c.targetSales?.toLocaleString('zh-CN')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
