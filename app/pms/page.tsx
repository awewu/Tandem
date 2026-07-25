/**
 * PMS · 商机管理主页
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter } from 'lucide-react';

interface Opportunity {
  id: string;
  customerName: string;
  projectName: string;
  stage: string;
  status: string;
  estimatedAmount: number;
  dealerOrgId: string;
  createdAt: string;
  contactName?: string;
  contactTitle?: string;
  leadSource?: string;
  region?: string;
  customerIndustry?: string;
  competitors?: string[];
}

export default function PMSPage() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  const stageOptions = Array.from(new Set(opportunities.map((o) => o.stage).filter(Boolean)));
  const q = query.trim().toLowerCase();
  const filteredOpps = opportunities.filter((o) => {
    if (stageFilter !== 'all' && o.stage !== stageFilter) return false;
    if (!q) return true;
    return [o.customerName, o.projectName, o.contactName, o.region, o.leadSource]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  useEffect(() => {
    loadOpportunities();
  }, []);

  async function loadOpportunities() {
    try {
      setLoading(true);
      const res = await fetch('/api/pms/opportunities', {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (!res.ok) throw new Error('Failed to load opportunities');
      
      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
          <p className="text-ink-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-danger">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-ink-secondary">{error}</p>
            <Button onClick={loadOpportunities} className="mt-4">
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary">商机管理</h1>
          <p className="text-body text-ink-secondary mt-1">
            项目报备全生命周期管理
          </p>
        </div>
        <Button
          onClick={() => router.push('/pms/opportunities/new')}
          className="bg-brand-500 hover:bg-brand-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          新建商机
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索客户 / 项目 / 联系人 / 区域 / 线索来源..."
                className="w-full pl-10 pr-4 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-1 text-ink-primary"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-tertiary pointer-events-none" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="pl-9 pr-8 py-2 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface-1 text-ink-primary"
              >
                <option value="all">全部阶段</option>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {opportunities.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-ink-secondary">暂无商机</p>
              <Button
                onClick={() => router.push('/pms/opportunities/new')}
                className="mt-4 bg-brand-500 hover:bg-brand-600"
              >
                创建第一个商机
              </Button>
            </CardContent>
          </Card>
        ) : filteredOpps.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-ink-secondary">没有符合条件的商机</p>
            </CardContent>
          </Card>
        ) : (
          filteredOpps.map((opp) => (
            <Card
              key={opp.id}
              className="cursor-pointer hover:shadow-soft-sm transition-shadow"
              onClick={() => router.push(`/pms/opportunities/${opp.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-headline font-semibold text-ink-primary">
                      {opp.customerName}
                    </h3>
                    <p className="text-body text-ink-secondary mt-1">
                      {opp.projectName}
                    </p>
                    {(opp.contactName || opp.region || opp.leadSource) && (
                      <p className="text-caption text-ink-tertiary mt-1">
                        {[
                          opp.contactName && `联系人 ${opp.contactName}${opp.contactTitle ? `(${opp.contactTitle})` : ''}`,
                          opp.region,
                          opp.leadSource && `来源: ${opp.leadSource}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-2 mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-surface-2 text-ink-secondary">
                        {opp.stage}
                      </span>
                      {opp.customerIndustry && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-surface-2 text-ink-secondary">
                          {opp.customerIndustry}
                        </span>
                      )}
                      {opp.competitors && opp.competitors.length > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-warning/10 text-warning">
                          竞品 {opp.competitors.length}
                        </span>
                      )}
                      <span className="text-caption text-ink-tertiary">
                        {new Date(opp.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-headline font-bold text-brand-500">
                      ¥{opp.estimatedAmount?.toLocaleString()}
                    </p>
                    <p className="text-caption text-ink-tertiary mt-1">
                      预估金额
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
