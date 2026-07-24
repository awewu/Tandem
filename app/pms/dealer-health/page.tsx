/**
 * PMS · 经销商健康分
 * 多维加权评分 + 等级 (A/B/C/D)。内部查看全量, 经销商仅本 org。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { HeartPulse } from 'lucide-react';

interface HealthScore {
  id: string;
  dealerOrgId: string;
  period: string;
  totalScore: number;
  dimensions: Record<string, number>;
  rank?: string;
}

const RANK_STYLE: Record<string, string> = {
  A: 'bg-success/10 text-success',
  B: 'bg-info/10 text-info',
  C: 'bg-warning/10 text-warning',
  D: 'bg-danger/10 text-danger',
};

const DIM_LABELS: Record<string, string> = {
  compliance: '合规',
  performance: '业绩',
  service: '服务',
  cooperation: '协作',
};

export default function PmsDealerHealthPage() {
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/dealer-health', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setScores(data.scores || []);
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
          <HeartPulse className="w-6 h-6 text-brand-500" />
          经销商健康分
        </h1>
        <p className="text-body text-ink-secondary mt-1">合规 · 业绩 · 服务 · 协作 多维考核</p>
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
      ) : scores.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无健康分记录</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {scores.map((sc) => (
            <Card key={sc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-headline font-semibold text-ink-primary">{sc.dealerOrgId}</h3>
                    <p className="text-caption text-ink-tertiary mt-1">{sc.period}</p>
                    <div className="flex flex-wrap gap-3 mt-3">
                      {sc.dimensions &&
                        Object.entries(sc.dimensions).map(([k, v]) => (
                          <span key={k} className="text-caption text-ink-secondary">
                            {DIM_LABELS[k] || k}: <span className="text-ink-primary font-medium">{v}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-title-lg font-bold text-brand-500">{sc.totalScore}</p>
                    {sc.rank && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-caption mt-1 ${RANK_STYLE[sc.rank] || 'bg-surface-2 text-ink-secondary'}`}>
                        {sc.rank} 级
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
