/**
 * PMS · 分析看板
 * 商机漏斗 / 赢单率 / 管道金额 / 状态·区域分布 (只读聚合, orgId 隔离)。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Wallet, Trophy } from 'lucide-react';

interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byStage: Record<string, number>;
  byRegion: Record<string, number>;
  totalPipeline: number;
  wonAmount: number;
  won: number;
  lost: number;
  winRate: number;
  funnel: Array<{ stage: string; count: number }>;
}

const STAGE_LABELS: Record<string, string> = {
  initial_contact: '初步接触',
  following: '跟进中',
  quoted: '已报价',
  contracted: '已签约',
  delivered: '已交付',
  closed: '已结案',
};

function money(n: number): string {
  return '¥' + (n ?? 0).toLocaleString('zh-CN');
}

export default function PmsAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/analytics', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const json = await res.json();
      setData(json.analytics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card className="border-danger/30">
          <CardContent className="p-6">
            <p className="text-danger mb-4">{error}</p>
            <Button onClick={load}>重试</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));
  const regions = Object.entries(data.byRegion).sort((a, b) => b[1] - a[1]);

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-500" />
          分析看板
        </h1>
        <p className="text-body text-ink-secondary mt-1">商机漏斗 · 赢单率 · 管道金额</p>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} label="商机总数" value={String(data.total)} />
        <KpiCard icon={<Trophy className="w-5 h-5" />} label="赢单率" value={`${data.winRate}%`} sub={`赢 ${data.won} / 输 ${data.lost}`} />
        <KpiCard icon={<Wallet className="w-5 h-5" />} label="管道金额" value={money(data.totalPipeline)} />
        <KpiCard icon={<Wallet className="w-5 h-5" />} label="赢单金额" value={money(data.wonAmount)} />
      </div>

      {/* 漏斗 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-headline">商机漏斗</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.funnel.map((f) => (
            <div key={f.stage}>
              <div className="flex justify-between text-caption text-ink-secondary mb-1">
                <span>{STAGE_LABELS[f.stage] || f.stage}</span>
                <span>{f.count}</span>
              </div>
              <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 状态分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-headline">状态分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.byStatus).length === 0 ? (
              <p className="text-ink-tertiary text-caption">暂无数据</p>
            ) : (
              Object.entries(data.byStatus).map(([k, v]) => (
                <div key={k} className="flex justify-between text-body">
                  <span className="text-ink-secondary">{k}</span>
                  <span className="text-ink-primary font-medium">{v}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 区域分布 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-headline">区域分布 Top</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {regions.length === 0 ? (
              <p className="text-ink-tertiary text-caption">暂无数据</p>
            ) : (
              regions.slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex justify-between text-body">
                  <span className="text-ink-secondary">{k}</span>
                  <span className="text-ink-primary font-medium">{v}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: JSX.Element; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-ink-tertiary mb-2">
          {icon}
          <span className="text-caption">{label}</span>
        </div>
        <p className="text-title-lg font-bold text-ink-primary">{value}</p>
        {sub && <p className="text-caption text-ink-tertiary mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
