'use client';

import { useEffect, useMemo, useState } from 'react';
import { NineBoxMatrix, type PersonInBox } from '@/components/nine-box/NineBoxMatrix';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, AlertTriangle } from 'lucide-react';

interface Cycle {
  id: string;
  name: string;
}

interface ApiPerson extends PersonInBox {
  krCount: number;
  ttiCount: number;
  cell: string;
}

const DEMO_PEOPLE: ApiPerson[] = [
  { userId: 'u1', name: '张明 (demo)', kpiScore: 0.95, ttiScore: 0.75, krCount: 0, ttiCount: 0, cell: 'star' },
  { userId: 'u2', name: '李娜 (demo)', kpiScore: 0.92, ttiScore: 0.4, krCount: 0, ttiCount: 0, cell: 'high_performer' },
  { userId: 'u3', name: '王伟 (demo)', kpiScore: 0.88, ttiScore: 0.65, krCount: 0, ttiCount: 0, cell: 'high_performer' },
  { userId: 'u4', name: '刘洋 (demo)', kpiScore: 0.78, ttiScore: 0.78, krCount: 0, ttiCount: 0, cell: 'rising_talent' },
  { userId: 'u5', name: '陈涛 (demo)', kpiScore: 0.75, ttiScore: 0.55, krCount: 0, ttiCount: 0, cell: 'core' },
  { userId: 'u6', name: '杨慧 (demo)', kpiScore: 0.72, ttiScore: 0.35, krCount: 0, ttiCount: 0, cell: 'plateau' },
  { userId: 'u7', name: '赵磊 (demo)', kpiScore: 0.6, ttiScore: 0.7, krCount: 0, ttiCount: 0, cell: 'mismatch' },
  { userId: 'u8', name: '孙莉 (demo)', kpiScore: 0.58, ttiScore: 0.5, krCount: 0, ttiCount: 0, cell: 'low_engagement' },
  { userId: 'u9', name: '周强 (demo)', kpiScore: 0.45, ttiScore: 0.3, krCount: 0, ttiCount: 0, cell: 'must_intervene' },
  { userId: 'u10', name: '吴梅 (demo)', kpiScore: 0.85, ttiScore: 0.85, krCount: 0, ttiCount: 0, cell: 'star' },
];

export default function NineBoxPage() {
  const [people, setPeople] = useState<ApiPerson[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(cycle: string) {
    setLoading(true);
    setError(null);
    try {
      const url = cycle === 'all' ? '/api/nine-box' : `/api/nine-box?cycleId=${cycle}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCycles(data.cycles ?? []);
      const real: ApiPerson[] = data.people ?? [];
      if (real.length === 0) {
        setPeople(DEMO_PEOPLE);
        setUsingDemo(true);
      } else {
        setPeople(real);
        setUsingDemo(false);
      }
      setLastUpdated(new Date());
    } catch (e) {
      setError((e as Error).message);
      setPeople(DEMO_PEOPLE);
      setUsingDemo(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(cycleId);
  }, [cycleId]);

  // auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => void load(cycleId), 60_000);
    return () => clearInterval(id);
  }, [cycleId]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of people) counts[p.cell] = (counts[p.cell] ?? 0) + 1;
    const interveneNeeded =
      (counts.must_intervene ?? 0) + (counts.risk_burnout ?? 0);
    const stars = (counts.star ?? 0) + (counts.high_performer ?? 0);
    const total = people.length;
    const avgKpi = total === 0 ? 0 : people.reduce((s, p) => s + p.kpiScore, 0) / total;
    const avgTti = total === 0 ? 0 : people.reduce((s, p) => s + p.ttiScore, 0) / total;
    return { counts, interveneNeeded, stars, total, avgKpi, avgTti };
  }, [people]);

  return (
    <main className="container mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-3 font-bold">人才 9 宫格</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            实时基于真实 KR (KPI 完成度) + TTI (成长度) 双轨评估 ·{' '}
            {lastUpdated ? `更新于 ${lastUpdated.toLocaleTimeString()}` : '加载中'}
            {' · 自动每 60s 刷新'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CycleSelect
            cycles={cycles}
            value={cycleId}
            onChange={setCycleId}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load(cycleId)}
            disabled={loading}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardContent className="flex items-center gap-2 py-3 text-caption text-rose-700">
            <AlertTriangle className="h-4 w-4" /> 加载失败: {error} (已 fallback 到 demo 数据)
          </CardContent>
        </Card>
      )}

      {usingDemo && !error && (
        <Card className="border-warning/20 bg-warning/5/40">
          <CardContent className="flex items-center gap-2 py-3 text-caption text-warning">
            <Database className="h-4 w-4" />
            当前 cycle 没有实时 KR/TTI 数据, 显示 demo 占位. 在 OKR 看板创建 KR + TTI 后将自动归位.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="总人数" value={summary.total} />
        <Stat label="明星 + 高产" value={summary.stars} accent="emerald" />
        <Stat label="需要干预" value={summary.interveneNeeded} accent="rose" />
        <Stat
          label="平均 KPI / TTI"
          value={`${(summary.avgKpi * 100).toFixed(0)}% / ${(summary.avgTti * 100).toFixed(0)}%`}
        />
      </div>

      <NineBoxMatrix people={people} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body">数据来源</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-footnote text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">纵轴 · KPI 绩效结果</span> = 该 owner bonus KPI 的加权完成率 (与 BSC 底线 / 奖金挂钩, 100% 才达标), clamp 到 [0,1]
          </div>
          <div>
            <span className="font-medium text-foreground">横轴 · TTI 潜力</span> = 该 owner OKR KR 平均完成率 与 360 评分均值 的均分 (前瞻提升, 60-70% 即健康, 与薪资分离)
          </div>
          <div>
            <span className="font-medium text-foreground">分类阈值</span> · KPI: ≥0.9 高 / ≥0.7 中 / 其余低 ·{' '}
            TTI: ≥0.7 高 / ≥0.4 中 / 其余低
          </div>
          <div>
            <Badge variant="outline" className="text-[10px]">
              GET /api/nine-box?cycleId={cycleId === 'all' ? '(omit for all)' : cycleId}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function CycleSelect({
  cycles,
  value,
  onChange,
}: {
  cycles: Cycle[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-footnote text-muted-foreground">
      Cycle:
      <select
        aria-label="选择考核周期"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded border bg-background px-2 text-caption"
      >
        <option value="all">全部</option>
        {cycles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'emerald' | 'rose';
}) {
  const cls =
    accent === 'rose'
      ? 'text-rose-600'
      : accent === 'emerald'
      ? 'text-emerald-600'
      : 'text-foreground';
  return (
    <Card>
      <CardContent className="py-3 text-center">
        <div className={`text-headline font-semibold ${cls}`}>{value}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
