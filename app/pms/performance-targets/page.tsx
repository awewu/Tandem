/**
 * PMS · 业绩目标
 * 列出区域/经销商目标, 展示达成率。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface PerformanceTarget {
  id: string;
  orgId?: string;
  dealerOrgId?: string;
  period: string;
  targetType: string;
  targetValue: number;
  actualValue: number;
  achievementRate: number;
}

function rateColor(rate: number): string {
  if (rate >= 100) return 'bg-success';
  if (rate >= 70) return 'bg-brand-500';
  if (rate >= 40) return 'bg-warning';
  return 'bg-danger/100';
}

export default function PmsPerformanceTargetsPage() {
  const [targets, setTargets] = useState<PerformanceTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/performance-targets', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setTargets(data.targets || []);
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
          <Target className="w-6 h-6 text-brand-500" />
          业绩目标
        </h1>
        <p className="text-body text-ink-secondary mt-1">目标下达 · 达成追踪</p>
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
      ) : targets.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无业绩目标</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {targets.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-headline font-semibold text-ink-primary">
                      {t.dealerOrgId || t.orgId || '—'}
                    </h3>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {t.period} · {t.targetType}
                    </p>
                  </div>
                  <span className="text-title-lg font-bold text-brand-500">{t.achievementRate}%</span>
                </div>
                <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${rateColor(t.achievementRate)}`}
                    style={{ width: `${Math.min(100, t.achievementRate)}%` }}
                  />
                </div>
                <p className="text-caption text-ink-tertiary mt-2">
                  实际 {t.actualValue?.toLocaleString('zh-CN')} / 目标 {t.targetValue?.toLocaleString('zh-CN')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
