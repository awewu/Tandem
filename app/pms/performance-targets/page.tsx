/**
 * PMS · 业绩目标运营看板
 * 多维(区域/渠道/产品线/经销商/销售/组织) × 周期(月/季/年) 目标达成追踪.
 * 支持维度/周期筛选 + 一键汇总 (从真实商机聚合成交额/单数 + 同比环比).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Target, RefreshCw, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';

interface PerformanceTarget {
  id: string;
  orgId?: string;
  dealerOrgId?: string;
  dimension: string;
  dimensionValue?: string;
  period: string;
  periodType: string;
  targetType: string;
  targetValue: number;
  targetCount?: number;
  actualValue: number;
  actualCount: number;
  achievementRate: number;
  yoyGrowth?: number;
  momGrowth?: number;
}

const ALL = '__all__';

const DIMENSION_LABELS: Record<string, string> = {
  region: '区域',
  channel: '渠道',
  product_line: '产品线',
  dealer_org: '经销商',
  sales_person: '销售',
  org: '组织',
};

const PERIOD_TYPE_LABELS: Record<string, string> = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  revenue: '成交额',
  count: '成交单数',
};

interface CreateForm {
  dimension: string;
  dimensionValue: string;
  period: string;
  periodType: string;
  targetType: string;
  targetValue: string;
  targetCount: string;
}

const EMPTY_FORM: CreateForm = {
  dimension: 'region',
  dimensionValue: '',
  period: '',
  periodType: 'monthly',
  targetType: 'revenue',
  targetValue: '',
  targetCount: '',
};

function rateColor(rate: number): string {
  if (rate >= 100) return 'bg-success';
  if (rate >= 70) return 'bg-brand-500';
  if (rate >= 40) return 'bg-warning';
  return 'bg-danger/100';
}

function GrowthBadge({ label, value }: { label: string; value?: number }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 text-caption text-ink-tertiary">
        <Minus className="w-3 h-3" />
        {label} —
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-caption font-medium ${up ? 'text-success' : 'text-danger'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {label} {up ? '+' : ''}{value}%
    </span>
  );
}

export default function PmsPerformanceTargetsPage() {
  const [targets, setTargets] = useState<PerformanceTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dimension, setDimension] = useState<string>(ALL);
  const [periodType, setPeriodType] = useState<string>(ALL);
  const [period, setPeriod] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (dimension !== ALL) qs.set('dimension', dimension);
      if (periodType !== ALL) qs.set('periodType', periodType);
      if (period.trim()) qs.set('period', period.trim());
      const res = await fetch(`/api/pms/performance-targets?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setTargets(data.targets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [dimension, periodType, period]);

  useEffect(() => {
    load();
  }, [load]);

  async function rollupAll() {
    try {
      setRolling(true);
      setError(null);
      const body: Record<string, string> = { action: 'rollup_all' };
      if (dimension !== ALL) body.dimension = dimension;
      if (periodType !== ALL) body.periodType = periodType;
      if (period.trim()) body.period = period.trim();
      const res = await fetch('/api/pms/performance-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || '汇总失败');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '汇总失败');
    } finally {
      setRolling(false);
    }
  }

  async function submitCreate() {
    if (!form.period.trim() || !form.targetValue.trim()) {
      setCreateError('请填写周期与目标值');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      const body: Record<string, string | number> = {
        action: 'create',
        dimension: form.dimension,
        period: form.period.trim(),
        periodType: form.periodType,
        targetType: form.targetType,
        targetValue: Number(form.targetValue),
      };
      if (form.dimensionValue.trim()) body.dimensionValue = form.dimensionValue.trim();
      if (form.targetCount.trim()) body.targetCount = Number(form.targetCount);
      const res = await fetch('/api/pms/performance-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || '创建失败');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Target className="w-6 h-6 text-brand-500" />
            业绩目标
          </h1>
          <p className="text-body text-ink-secondary mt-1">多维运营看板 · 目标达成 · 同比环比</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setForm(EMPTY_FORM);
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            新建目标
          </Button>
          <Button onClick={rollupAll} disabled={rolling} className="bg-brand-500 hover:bg-brand-600">
            <RefreshCw className={`w-4 h-4 mr-2 ${rolling ? 'animate-spin' : ''}`} />
            {rolling ? '汇总中...' : '汇总实际'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Select value={dimension} onValueChange={setDimension}>
          <SelectTrigger>
            <SelectValue placeholder="维度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部维度</SelectItem>
            {Object.entries(DIMENSION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodType} onValueChange={setPeriodType}>
          <SelectTrigger>
            <SelectValue placeholder="周期类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部周期</SelectItem>
            {Object.entries(PERIOD_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="周期 如 2026-03 / 2026-Q2 / 2026"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
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
                    <div className="flex items-center gap-2">
                      <span className="text-caption font-medium text-brand-500 bg-brand-500/10 rounded px-1.5 py-0.5">
                        {DIMENSION_LABELS[t.dimension] || t.dimension}
                      </span>
                      <h3 className="text-headline font-semibold text-ink-primary">
                        {t.dimensionValue || t.dealerOrgId || t.orgId || '全部'}
                      </h3>
                    </div>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {t.period} · {PERIOD_TYPE_LABELS[t.periodType] || t.periodType} · {t.targetType}
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
                <div className="flex items-center justify-between gap-4 mt-2 flex-wrap">
                  <p className="text-caption text-ink-tertiary">
                    实际 {t.actualValue?.toLocaleString('zh-CN')} / 目标 {t.targetValue?.toLocaleString('zh-CN')}
                    {(t.actualCount > 0 || (t.targetCount ?? 0) > 0) && (
                      <span className="ml-2">
                        · 成交 {t.actualCount} 单{t.targetCount ? ` / 目标 ${t.targetCount} 单` : ''}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-3">
                    <GrowthBadge label="同比" value={t.yoyGrowth} />
                    <GrowthBadge label="环比" value={t.momGrowth} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建业绩目标</DialogTitle>
            <DialogDescription>按维度与周期下达目标, 之后可一键从真实商机汇总实际达成。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">维度</label>
                <Select value={form.dimension} onValueChange={(v) => setForm((f) => ({ ...f, dimension: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIMENSION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">
                  维度值{form.dimension === 'org' ? ' (留空=全公司)' : ''}
                </label>
                <input
                  value={form.dimensionValue}
                  onChange={(e) => setForm((f) => ({ ...f, dimensionValue: e.target.value }))}
                  placeholder={form.dimension === 'product_line' ? '系列编码 如 RH-HP' : '如 华东'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">周期类型</label>
                <Select value={form.periodType} onValueChange={(v) => setForm((f) => ({ ...f, periodType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIOD_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">周期</label>
                <input
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                  placeholder={form.periodType === 'monthly' ? '2026-03' : form.periodType === 'quarterly' ? '2026-Q2' : '2026'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">目标类型</label>
                <Select value={form.targetType} onValueChange={(v) => setForm((f) => ({ ...f, targetType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TARGET_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">目标额</label>
                <input
                  type="number"
                  value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                  placeholder="1000000"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">目标单数</label>
                <input
                  type="number"
                  value={form.targetCount}
                  onChange={(e) => setForm((f) => ({ ...f, targetCount: e.target.value }))}
                  placeholder="选填"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>
            {createError && <p className="text-caption text-danger">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>取消</Button>
            <Button onClick={submitCreate} disabled={creating} className="bg-brand-500 hover:bg-brand-600">
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
