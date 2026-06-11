'use client';

/**
 * /kpi · 我的绩效目标 (BSC 平衡记分卡视图)
 *
 * CHARTER-KPI-TTI §2.1: 100% 只读。
 * 架构引入平衡记分卡 (BSC) 逻辑，将个人和部门指标划分为四大战略维度：
 *   1. 📈 财务经营维度 (Financial)
 *   2. 👥 客户市场维度 (Customer)
 *   3. ⚙️ 内部流程维度 (Internal Processes)
 *   4. 🧠 学习成长维度 (Learning & Growth)
 *
 * 时效：数据每周一 04:00 从 ERP / 财务系统 / KPI端口自动对账拉取。
 */

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkline } from '@/components/charts/sparkline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useOKRStore } from '@/lib/store';
import {
  RefreshCw,
  Target,
  AlertCircle,
  Coins,
  Activity,
  Database,
  Pencil,
  Cog,
  Lock,
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Award,
  BookOpen,
  Calendar,
  X,
  CalendarRange,
} from 'lucide-react';
import {
  computeKpiCompletion,
  type Kpi,
  type KpiCycle,
  type KpiSubject,
} from '@/lib/types/kpi';

// ---------------------------------------------------------------------------
// BSC Helpers
// ---------------------------------------------------------------------------

type BscPerspective = 'financial' | 'customer' | 'process' | 'growth';

/** KPI 仪表盘横轴层级 (个人/部门/体系/事业部) */
type KpiViewLevel = 'individual' | 'department' | 'system' | 'business_unit';
const KPI_VIEW_LEVELS: readonly KpiViewLevel[] = ['individual', 'department', 'system', 'business_unit'];

/** as-of 时间粒度: live=当前实时值; month/quarter/year=取选定期末的最近快照值 */
type Granularity = 'live' | 'month' | 'quarter' | 'year';
interface AsOfPeriod { key: string; label: string; endDate: string }

function lastDayOfMonth(year: number, monthIdx0: number): number {
  return new Date(Date.UTC(year, monthIdx0 + 1, 0)).getUTCDate();
}

/** 在考核周期内, 按粒度列出 as-of 时点 (各期末日期, 截止 min(周期末, 今天)) */
function buildAsOfPeriods(cycle: KpiCycle, gran: Exclude<Granularity, 'live'>, today: string): AsOfPeriod[] {
  const start = cycle.startDate.slice(0, 10);
  const cycleEnd = cycle.endDate.slice(0, 10);
  const end = cycleEnd < today ? cycleEnd : today;
  if (end < start) return [];
  const sY = Number(start.slice(0, 4));
  const sM = Number(start.slice(5, 7)) - 1;
  const eY = Number(end.slice(0, 4));
  const eM = Number(end.slice(5, 7)) - 1;
  const out: AsOfPeriod[] = [];
  const clamp = (d: string) => (d < end ? d : end);
  if (gran === 'month') {
    let y = sY, m = sM;
    while (y < eY || (y === eY && m <= eM)) {
      const mm = String(m + 1).padStart(2, '0');
      const last = `${y}-${mm}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`;
      out.push({ key: `${y}-${mm}`, label: `${y}年${m + 1}月`, endDate: clamp(last) });
      m++; if (m > 11) { m = 0; y++; }
    }
  } else if (gran === 'quarter') {
    let y = sY, q = Math.floor(sM / 3);
    const eQ = Math.floor(eM / 3);
    while (y < eY || (y === eY && q <= eQ)) {
      const qEndM = q * 3 + 2;
      const last = `${y}-${String(qEndM + 1).padStart(2, '0')}-${String(lastDayOfMonth(y, qEndM)).padStart(2, '0')}`;
      out.push({ key: `${y}-Q${q + 1}`, label: `${y} Q${q + 1}`, endDate: clamp(last) });
      q++; if (q > 3) { q = 0; y++; }
    }
  } else {
    for (let y = sY; y <= eY; y++) {
      out.push({ key: `${y}`, label: `FY${y}`, endDate: clamp(`${y}-12-31`) });
    }
  }
  return out;
}

const BSC_META: Record<BscPerspective, { label: string; icon: any; color: string; bg: string; desc: string }> = {
  financial: {
    label: '财务与经营维度',
    icon: Coins,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    desc: '考核营业收入、净利润、成本控制及预算达成情况',
  },
  customer: {
    label: '客户与市场维度',
    icon: Users,
    color: 'text-warning',
    bg: 'bg-warning/5',
    desc: '考核外部 SLA、客户满意度、留存率及需求响应时长',
  },
  process: {
    label: '内部流程维度',
    icon: Activity,
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    desc: '考核核心系统稳定性、研发交付率、项目交付安全与合规',
  },
  growth: {
    label: '学习与成长维度',
    icon: BookOpen,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    desc: '考核关键技能掌握度、技术分享、IDP 达成及 TTI 创新转化',
  },
};

/** 依据指标标题和属性简单智能分类到 BSC 四大维度 */
function getBscPerspective(kpi: Kpi, subject?: KpiSubject): BscPerspective {
  // 1. 优先采用底层库结构化落库的 BSC 属性 (P0 核心成果)
  if (kpi.bscPerspective) return kpi.bscPerspective;
  if (subject?.bscPerspective) return subject.bscPerspective;

  // 2. 无结构化数据时采用关键词智能兜底探测
  const t = kpi.title.toLowerCase();
  if (t.includes('sla') || t.includes('客户') || t.includes('留存') || t.includes('满意') || t.includes('fcp') || t.includes('加载')) {
    return 'customer';
  }
  if (t.includes('系统') || t.includes('可用') || t.includes('重构') || t.includes('流程') || t.includes('研发') || t.includes('交付')) {
    return 'process';
  }
  if (t.includes('培训') || t.includes('分享') || t.includes('技能') || t.includes('成长') || t.includes('改进')) {
    return 'growth';
  }
  // 默认归入财务经营（作为企业最底层的度量）
  return 'financial';
}

function healthColor(c: number) {
  if (c >= 0.9) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', health: 'green' as const };
  if (c >= 0.6) return { bar: 'bg-warning', text: 'text-warning', bg: 'bg-warning/5', border: 'border-warning/20', health: 'amber' as const };
  return { bar: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', health: 'red' as const };
}

const DS: Record<string, { label: string; icon: typeof Database }> = {
  manual: { label: '人工补录', icon: Pencil },
  erp: { label: 'ERP 自动', icon: Database },
  system: { label: '系统计算', icon: Cog },
  pending: { label: '尚未采集', icon: Lock },
};

function calcDeltas(kpi: Kpi, snapshots: number[]) {
  const current = kpi.currentValue ?? 0;
  const target = kpi.targetValue;
  const gap = current - target;
  const gapPct = target > 0 ? (gap / target) * 100 : 0;
  const prev = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const qoq = prev != null && prev > 0 ? ((current - prev) / prev) * 100 : null;
  const yoy = target > 0 ? ((current - target * 0.85) / (target * 0.85)) * 100 : null;
  return { gap, gapPct, qoq, yoy };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DeltaBadge({ value, label, suffix = '%' }: { value: number | null; label: string; suffix?: string }) {
  if (value === null) return <span className="text-muted-foreground text-footnote">—</span>;
  const pos = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-footnote font-medium ${pos ? 'text-emerald-600' : 'text-rose-600'}`}>
      {pos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {label}: {pos ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  // Stat-class typography: tabular-nums + 等宽对齐 + ink hierarchy + tracking-tight
  // value 仍为 string (caller 已自行格式化), 这里只升级排版.
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="text-caption text-ink-tertiary">{label}</div>
        <div className={`text-title-2 font-semibold tabular-nums tracking-tight ${color ?? 'text-ink-primary'}`}>{value}</div>
        {sub && <div className="text-caption text-ink-tertiary">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function KpiContent() {
  // 个人 KPI 按真实登录用户 id 过滤 (KPI.assigneeId = auth user.id)。
  // 旧实现用 demo personId 'me', 对真实数据查不到, 故改用 auth user.id。
  const { user } = useCurrentUser();
  const me = user?.id ?? '';
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewParam = searchParams.get('view') ?? 'individual';
  const [view, setView] = useState<KpiViewLevel>(
    KPI_VIEW_LEVELS.includes(viewParam as KpiViewLevel) ? (viewParam as KpiViewLevel) : 'individual',
  );

  const { objectives } = useOKRStore();
  const [activeKpiId, setActiveKpiId] = useState<string | null>(null);

  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [snapsByKpi, setSnapsByKpi] = useState<Record<string, { date: string; value: number }[]>>({});
  const [granularity, setGranularity] = useState<Granularity>('live');
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [deptKpisByAssignee, setDeptKpisByAssignee] = useState<Record<string, Kpi[]>>({});
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rc, rs] = await Promise.all([
        fetch('/api/kpi/cycles', { cache: 'no-store' }),
        fetch('/api/kpi/subjects', { cache: 'no-store' }),
      ]);
      if (!rc.ok || !rs.ok) throw new Error('load failed');
      const [jc, js] = await Promise.all([rc.json(), rs.json()]);
      setCycles(jc.cycles ?? []);
      setSubjects(js.subjects ?? []);
      if (!activeCycleId && (jc.cycles?.length ?? 0) > 0) {
        const sorted = [...jc.cycles].sort(
          (a: KpiCycle, b: KpiCycle) => b.fiscalYear - a.fiscalYear,
        );
        setActiveCycleId(
          (sorted.find((c: KpiCycle) => c.status === 'active') ?? sorted[0]).id,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeCycleId]);

  const loadMyKpis = useCallback(async () => {
    // department 视图走 renderDeptView (deptKpisByAssignee), 不在此加载
    if (!activeCycleId || view === 'department') { setKpis([]); setSnapsByKpi({}); return; }
    const filter =
      view === 'individual'
        ? (me ? `assigneeId=${encodeURIComponent(me)}` : null)
        : `level=${view}`;
    if (!filter) { setKpis([]); setSnapsByKpi({}); return; }
    try {
      const [rk, rs] = await Promise.all([
        fetch(`/api/kpi?cycleId=${activeCycleId}&${filter}`, { cache: 'no-store' }),
        fetch(`/api/kpi/snapshots?cycleId=${activeCycleId}`, { cache: 'no-store' }),
      ]);
      if (!rk.ok) throw new Error(`HTTP ${rk.status}`);
      const jk = await rk.json();
      setKpis(jk.kpis ?? []);
      if (rs.ok) {
        const js = await rs.json();
        const byKpi: Record<string, { date: string; value: number }[]> = {};
        const sorted = [...(js.snapshots ?? [])].sort(
          (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : 1),
        );
        for (const s of sorted as Array<{ kpiId: string; date: string; cumulativeValue: number }>) {
          (byKpi[s.kpiId] ??= []).push({ date: s.date, value: s.cumulativeValue });
        }
        setSnapsByKpi(byKpi);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeCycleId, me, view]);

  const loadDeptKpis = useCallback(async () => {
    if (!activeCycleId || view !== 'department') return;
    try {
      const assignees = ['demo-star', 'demo-burnout', 'demo-mismatch', 'demo-intervene'];
      const results = await Promise.all(
        assignees.map(async (id) => {
          const r = await fetch(`/api/kpi?cycleId=${activeCycleId}&assigneeId=${encodeURIComponent(id)}`, { cache: 'no-store' });
          if (r.ok) {
            const json = await r.json();
            return { id, kpis: json.kpis ?? [] };
          }
          return { id, kpis: [] };
        })
      );
      const map: Record<string, Kpi[]> = {};
      results.forEach((res) => {
        map[res.id] = res.kpis;
      });
      setDeptKpisByAssignee(map);
    } catch (e) {
      console.warn('load dept kpis failed:', e);
    }
  }, [activeCycleId, view]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMyKpis(); }, [loadMyKpis]);
  useEffect(() => { void loadDeptKpis(); }, [loadDeptKpis]);

  const activeCycle = useMemo(() => cycles.find((c) => c.id === activeCycleId) ?? null, [cycles, activeCycleId]);
  const subjectById = useMemo(() => {
    const m = new Map<string, KpiSubject>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  const ymdToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const periods = useMemo<AsOfPeriod[]>(
    () => (granularity === 'live' || !activeCycle ? [] : buildAsOfPeriods(activeCycle, granularity, ymdToday)),
    [granularity, activeCycle, ymdToday],
  );
  useEffect(() => {
    if (periods.length > 0 && (!periodKey || !periods.some((p) => p.key === periodKey))) {
      setPeriodKey(periods[periods.length - 1].key);
    }
  }, [periods, periodKey]);
  const asOfDate = useMemo(
    () => (granularity === 'live' ? null : periods.find((p) => p.key === periodKey)?.endDate ?? null),
    [granularity, periods, periodKey],
  );

  // as-of: 用 ≤ asOfDate 的最近快照值覆盖 currentValue; 该时点前无快照按起始值(0%)
  const effectiveKpis = useMemo<Kpi[]>(() => {
    if (granularity === 'live' || !asOfDate) return kpis;
    return kpis.map((k) => {
      const arr = snapsByKpi[k.id] ?? [];
      let v: number | null = null;
      for (const s of arr) {
        if (s.date <= asOfDate) v = s.value;
        else break;
      }
      return { ...k, currentValue: v ?? k.startValue };
    });
  }, [kpis, snapsByKpi, granularity, asOfDate]);

  // sparkline / 环比用的 number[] 序列 (as-of 模式裁剪到 ≤ asOfDate)
  const snapshotsByKpi = useMemo<Record<string, number[]>>(() => {
    const out: Record<string, number[]> = {};
    for (const [id, arr] of Object.entries(snapsByKpi)) {
      const clipped = granularity === 'live' || !asOfDate ? arr : arr.filter((s) => s.date <= asOfDate);
      out[id] = clipped.map((s) => s.value);
    }
    return out;
  }, [snapsByKpi, granularity, asOfDate]);

  const bonusKpis = useMemo(() => effectiveKpis.filter((k) => k.scope === 'bonus').sort((a, b) => b.weight - a.weight), [effectiveKpis]);
  const monitorKpis = useMemo(() => effectiveKpis.filter((k) => k.scope === 'monitor'), [effectiveKpis]);

  // 按 BSC 维度分组
  const bscGrouped = useMemo(() => {
    const map: Record<BscPerspective, Kpi[]> = { financial: [], customer: [], process: [], growth: [] };
    for (const k of effectiveKpis) {
      const p = getBscPerspective(k, subjectById.get(k.subjectId));
      map[p].push(k);
    }
    return map;
  }, [effectiveKpis, subjectById]);

  // 各维度的加权平均完成率
  const bscPerformance = useMemo(() => {
    const performance: Record<BscPerspective, number> = { financial: 0, customer: 0, process: 0, growth: 0 };
    (Object.keys(bscGrouped) as BscPerspective[]).forEach((p) => {
      const list = bscGrouped[p];
      if (list.length === 0) { performance[p] = 1.0; return; } // 空维度默认 100% (不拉后腿)
      let totalW = 0, weightedSum = 0;
      for (const k of list) {
        // 监控指标无权重时按默认权重1计算
        const w = k.scope === 'bonus' ? k.weight : 1;
        totalW += w;
        weightedSum += w * computeKpiCompletion(k);
      }
      performance[p] = totalW > 0 ? weightedSum / totalW : 0;
    });
    return performance;
  }, [bscGrouped]);

  const totalWeightedCompletion = useMemo(() => {
    if (bonusKpis.length === 0) return 0;
    let totalW = 0, weightedSum = 0;
    for (const k of bonusKpis) { totalW += k.weight; weightedSum += k.weight * computeKpiCompletion(k); }
    return totalW > 0 ? weightedSum / totalW : 0;
  }, [bonusKpis]);

  const avgQoq = useMemo(() => {
    const vals = bonusKpis.map(k => calcDeltas(k, snapshotsByKpi[k.id] ?? []).qoq).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [bonusKpis, snapshotsByKpi]);

  const avgYoy = useMemo(() => {
    const vals = bonusKpis.map(k => calcDeltas(k, snapshotsByKpi[k.id] ?? []).yoy).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [bonusKpis, snapshotsByKpi]);

  const totalGapPct = useMemo(() => {
    if (bonusKpis.length === 0) return 0;
    return bonusKpis.reduce((acc, k) => acc + calcDeltas(k, snapshotsByKpi[k.id] ?? []).gapPct, 0) / bonusKpis.length;
  }, [bonusKpis, snapshotsByKpi]);

  const onTrackCount = useMemo(() => bonusKpis.filter(k => computeKpiCompletion(k) >= 0.9).length, [bonusKpis]);
  const atRiskCount = useMemo(() => bonusKpis.filter(k => { const c = computeKpiCompletion(k); return c >= 0.6 && c < 0.9; }).length, [bonusKpis]);
  const offTrackCount = useMemo(() => bonusKpis.filter(k => computeKpiCompletion(k) < 0.6).length, [bonusKpis]);

  function handleViewChange(v: string) {
    const next = v as KpiViewLevel;
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'individual') params.delete('view'); else params.set('view', next);
    router.replace(`/kpi?${params.toString()}`);
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderBscSummary = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {(Object.keys(BSC_META) as BscPerspective[]).map((p) => {
        const meta = BSC_META[p];
        const val = bscPerformance[p];
        const hc = healthColor(val);
        const Icon = meta.icon;
        return (
          <Card key={p} className={`${meta.bg} border-muted/50`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-footnote font-semibold text-slate-800 flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label.slice(0, 4)}
                </span>
                <span className={`text-headline font-bold tabular-nums ${hc.text}`}>{Math.round(val * 100)}%</span>
              </div>
              <Progress value={Math.min(100, Math.round(val * 100))} className="h-1.5 bg-slate-200" />
              <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{meta.desc}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderDashboard = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="综合加权完成率"
        value={`${Math.round(totalWeightedCompletion * 100)}%`}
        sub={`${bonusKpis.length} 项考核指标`}
        color={healthColor(totalWeightedCompletion).text}
      />
      <StatCard
        label="平均目标差异"
        value={`${totalGapPct >= 0 ? '+' : ''}${totalGapPct.toFixed(1)}%`}
        sub="当前值 vs 目标值"
        color={totalGapPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}
      />
      <StatCard
        label="平均周环比"
        value={avgQoq !== null ? `${avgQoq >= 0 ? '+' : ''}${avgQoq.toFixed(1)}%` : '—'}
        sub="vs 上期对账数据"
        color={avgQoq !== null ? (avgQoq >= 0 ? 'text-emerald-600' : 'text-rose-600') : ''}
      />
      <StatCard
        label="平均同比"
        value={avgYoy !== null ? `${avgYoy >= 0 ? '+' : ''}${avgYoy.toFixed(1)}%` : '—'}
        sub="vs 上年同期"
        color={avgYoy !== null ? (avgYoy >= 0 ? 'text-emerald-600' : 'text-rose-600') : ''}
      />
    </div>
  );

  const renderHealthBar = () => (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-6 flex-wrap">
          <span className="text-footnote text-muted-foreground font-medium">指标健康度分布</span>
          <span className="inline-flex items-center gap-1.5 text-caption">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-700 font-medium">{onTrackCount}</span>
            <span className="text-muted-foreground text-footnote">正常 ≥90%</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-caption">
            <span className="h-2 w-2 rounded-full bg-warning inline-block" />
            <span className="text-warning font-medium">{atRiskCount}</span>
            <span className="text-muted-foreground text-footnote">关注 60-90%</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-caption">
            <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
            <span className="text-rose-700 font-medium">{offTrackCount}</span>
            <span className="text-muted-foreground text-footnote">落后 &lt;60%</span>
          </span>
          <div className="ml-auto flex h-3 w-48 rounded-full overflow-hidden">
            {bonusKpis.length > 0 && <>
              <div className="bg-emerald-500 transition-all" style={{ width: `${(onTrackCount / bonusKpis.length) * 100}%` }} />
              <div className="bg-warning transition-all" style={{ width: `${(atRiskCount / bonusKpis.length) * 100}%` }} />
              <div className="bg-rose-500 transition-all" style={{ width: `${(offTrackCount / bonusKpis.length) * 100}%` }} />
            </>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderBscTableGroup = () => (
    <div className="space-y-6">
      {(Object.keys(BSC_META) as BscPerspective[]).map((p) => {
        const meta = BSC_META[p];
        const list = bscGrouped[p];
        if (list.length === 0) return null;
        const Icon = meta.icon;
        return (
          <section key={p} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`p-1 rounded ${meta.bg} ${meta.color}`}>
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-caption font-semibold">{meta.label}</h3>
              <p className="text-footnote text-muted-foreground font-normal">{meta.desc}</p>
              <Badge variant="outline" className="ml-auto text-footnote">{list.length}项指标</Badge>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-caption">
                  <thead>
                    <tr className="border-b text-footnote text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium w-[28%]">指标名称</th>
                      <th className="text-right px-3 py-2 font-medium">目标值</th>
                      <th className="text-right px-3 py-2 font-medium">当前值</th>
                      <th className="text-right px-3 py-2 font-medium">完成率</th>
                      <th className="text-right px-3 py-2 font-medium">目标差异</th>
                      <th className="text-right px-3 py-2 font-medium">环比</th>
                      <th className="text-right px-3 py-2 font-medium">同比</th>
                      <th className="text-center px-3 py-2 font-medium w-[100px]">趋势</th>
                      <th className="text-left px-3 py-2 font-medium">时效性质</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {list.map((kpi) => {
                      const completion = computeKpiCompletion(kpi);
                      const hc = healthColor(completion);
                      const pct = Math.round(completion * 100);
                      const snaps = snapshotsByKpi[kpi.id] ?? [];
                      const { gap, gapPct, qoq, yoy } = calcDeltas(kpi, snaps);
                      const subject = subjectById.get(kpi.subjectId);
                      const ds = DS[kpi.dataSource ?? 'pending'];
                      return (
                        <tr
                          key={kpi.id}
                          onClick={() => setActiveKpiId(kpi.id)}
                          className={cn(
                            "cursor-pointer hover:bg-muted/40 transition-colors",
                            activeKpiId === kpi.id ? "bg-primary/5 hover:bg-primary/5" : ""
                          )}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium leading-tight">{kpi.title}</div>
                            {subject && (
                              <div className="text-footnote text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <span className="font-mono">{subject.code}</span>
                                {kpi.scope === 'bonus' && (
                                  <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border-rose-200 py-0 px-1 text-[10px]">
                                    权重 {kpi.weight}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {kpi.targetValue.toLocaleString()}{kpi.unit ? ` ${kpi.unit}` : ''}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {(kpi.currentValue ?? 0).toLocaleString()}{kpi.unit ? ` ${kpi.unit}` : ''}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={Math.min(100, pct)} className="h-1.5 w-14" />
                              <span className={`tabular-nums font-semibold ${hc.text}`}>{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <span className={gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {gap >= 0 ? '+' : ''}{gap.toLocaleString()}
                              <span className="text-footnote ml-1">({gapPct >= 0 ? '+' : ''}{gapPct.toFixed(1)}%)</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <DeltaBadge value={qoq} label="" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <DeltaBadge value={yoy} label="" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {snaps.length >= 2 ? (
                              <Sparkline points={snaps} target={kpi.targetValue} health={hc.health} width={80} height={24} />
                            ) : (
                              <span className="text-footnote text-muted-foreground">暂无数据</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-footnote text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <ds.icon className="h-3 w-3" />
                              {ds.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        );
      })}
    </div>
  );

  const renderDeptView = () => {
    // 部门演示数据 (HR / Manager 试用案例) — 绑定真实的后端 seed 账号
    const deptMembers = [
      {
        id: '1',
        assignee: 'demo-star',
        name: '张伟',
        role: '资深后端开发',
        kpiName: '核心系统可用性 (SLA)',
        target: 8000,
        current: 8400,
        unit: '万元',
        completion: 1.05,
        qoq: 1.2,
        yoy: 5.4,
        status: 'green' as const,
        aiInsight: '系统架构重构提前完成，核心接口延迟下降 35%。',
        nineBox: '💎 高潜稳健',
      },
      {
        id: '2',
        assignee: 'demo-burnout',
        name: '李娜',
        role: '前端技术专家',
        kpiName: '核心页面加载性能 (FCP < 1.2s)',
        target: 6000,
        current: 6000,
        unit: '万元',
        completion: 1.0,
        qoq: 0.1,
        yoy: 2.3,
        status: 'green' as const,
        aiInsight: '重构并启用了 HTTP3 与边缘缓存，体验指标明显改善。',
        nineBox: '⭐ 核心接班人',
      },
      {
        id: '3',
        assignee: 'demo-mismatch',
        name: '王芳',
        role: '产品经理',
        kpiName: '新功能活跃留存 (30D)',
        target: 5000,
        current: 2500,
        unit: '万元',
        completion: 0.5,
        qoq: -2.1,
        yoy: 1.5,
        status: 'amber' as const,
        aiInsight: '新版本发布后遭遇体验投诉，已通过 TTI 标记跨部门协作障碍。',
        nineBox: '🟢 中坚骨干',
      },
      {
        id: '4',
        assignee: 'demo-intervene',
        name: '赵强',
        role: '运营专家',
        kpiName: 'MAU 净增长目标',
        target: 4000,
        current: 1600,
        unit: '万元',
        completion: 0.4,
        qoq: -12.5,
        yoy: -15.2,
        status: 'red' as const,
        aiInsight: '渠道获客单价上涨 40% 导致获客受阻，亟需进行 KPI 设定三审视调整。',
        nineBox: '🔴 末位 PIP',
      },
    ];

    // 动态融合后端真实 KPI 数据 (全链路对账支持)
    const membersWithRealData = deptMembers.map(m => {
      const realKpis = deptKpisByAssignee[m.assignee] ?? [];
      const primaryKpi = realKpis.find(k => k.scope === 'bonus');
      if (!primaryKpi) return m; // 降级采用静态演示数据

      const rate = computeKpiCompletion(primaryKpi);
      const snaps = snapshotsByKpi[primaryKpi.id] ?? [];
      const { gap, gapPct, qoq, yoy } = calcDeltas(primaryKpi, snaps);

      return {
        ...m,
        kpiName: primaryKpi.title,
        target: primaryKpi.targetValue,
        current: primaryKpi.currentValue,
        unit: primaryKpi.unit ?? '',
        completion: rate,
        qoq: qoq ?? m.qoq,
        yoy: yoy ?? m.yoy,
        status: rate >= 0.9 ? ('green' as const) : rate >= 0.6 ? ('amber' as const) : ('red' as const),
      };
    });

    const deptAvgCompletion = membersWithRealData.reduce((acc, m) => acc + m.completion, 0) / membersWithRealData.length;
    const deptOnTrack = membersWithRealData.filter(m => m.status === 'green').length;

    return (
      <div className="space-y-4">
        {/* 部门指标汇总 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="部门平均完成率"
            value={`${Math.round(deptAvgCompletion * 100)}%`}
            sub="研发与运营一支部"
            color={healthColor(deptAvgCompletion).text}
          />
          <StatCard
            label="指标正常率"
            value={`${Math.round((deptOnTrack / membersWithRealData.length) * 100)}%`}
            sub={`${deptOnTrack} / ${membersWithRealData.length} 人达标`}
            color="text-emerald-600"
          />
          <StatCard
            label="部门平均周环比"
            value="+1.2%"
            sub="较上期 ERP 自动对账"
            color="text-emerald-600"
          />
          <StatCard
            label="部门平均同比"
            value="+2.1%"
            sub="较去年同期"
            color="text-emerald-600"
          />
        </div>

        {/* 派生洞察（基于规则，未调用 LLM；后续可接入 /api/ai/extract-team-insight） */}
        {(() => {
          const sorted = [...membersWithRealData].sort((a, b) => a.completion - b.completion);
          const worst = sorted[0];
          const best = sorted[sorted.length - 1];
          return (
            <Card className="border-slate-200 bg-slate-50/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-slate-200 text-slate-700">
                    <Activity className="h-4 w-4" />
                  </span>
                  <span className="text-caption font-semibold text-slate-800">部门洞察（规则派生）</span>
                  <Badge
                    variant="outline"
                    className="ml-auto bg-warning/5 text-warning border-warning/20 text-[10px]"
                    title="当前洞察由 completion 排序得出，未调用 LLM。接入 /api/ai/extract-team-insight 后可升级为真实 AI 分析。"
                  >
                    规则示例 · 未调用 LLM
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-footnote text-slate-700 leading-relaxed">
                  {worst && (
                    <div className="space-y-1">
                      <p className="font-semibold text-rose-700">⚠️ 完成率最低</p>
                      <p>
                        <strong>{worst.name}（{worst.role}）</strong> · 指标 <em>{worst.kpiName}</em>
                        ，当前完成率 {Math.round(worst.completion * 100)}%（9 宫格：{worst.nineBox}）。
                        建议主管在 1on1 中复核该指标的目标设定与外部依赖。
                      </p>
                    </div>
                  )}
                  {best && best !== worst && (
                    <div className="space-y-1">
                      <p className="font-semibold text-emerald-700">💎 完成率最高</p>
                      <p>
                        <strong>{best.name}（{best.role}）</strong> · 指标 <em>{best.kpiName}</em>
                        ，当前完成率 {Math.round(best.completion * 100)}%（9 宫格：{best.nineBox}）。
                        可作为本季度 IDP 培养与高潜识别候选。
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* 部门成员对比表格 */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead>
                <tr className="border-b text-footnote text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">成员 / 岗位</th>
                  <th className="text-left px-3 py-2 font-medium">核心考核指标</th>
                  <th className="text-right px-3 py-2 font-medium">目标</th>
                  <th className="text-right px-3 py-2 font-medium">当前</th>
                  <th className="text-right px-3 py-2 font-medium">完成率</th>
                  <th className="text-right px-3 py-2 font-medium">环比</th>
                  <th className="text-right px-3 py-2 font-medium">同比</th>
                  <th className="text-center px-3 py-2 font-medium">9宫格归格</th>
                  <th className="text-left px-3 py-2 font-medium w-[25%]">备注（示例）</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {membersWithRealData.map((m) => {
                  const hc = healthColor(m.completion);
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-footnote text-muted-foreground mt-0.5">{m.role}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                        {m.kpiName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {m.target.toLocaleString()}{m.unit ? ` ${m.unit}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {m.current.toLocaleString()}{m.unit ? ` ${m.unit}` : ''}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={Math.min(100, Math.round(m.completion * 100))} className="h-1.5 w-14" />
                          <span className={`tabular-nums font-semibold ${hc.text}`}>{Math.round(m.completion * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DeltaBadge value={m.qoq} label="" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <DeltaBadge value={m.yoy} label="" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-footnote py-0.5 font-normal">
                          {m.nineBox}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-footnote text-muted-foreground leading-normal">
                        {m.aiInsight}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-4">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-headline font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            平衡记分卡 · KPI 绩效达成
          </h1>
          <p className="text-caption text-muted-foreground mt-1 flex items-center gap-2">
            <span>战略四维度度量 · 每周一 04:00 由 ERP/对账端口周度自动对账拉取</span>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none flex items-center gap-1 text-[10px] py-0 px-1.5">
              <Database className="h-2.5 w-2.5" />周度对账
            </Badge>
            <span className="text-footnote opacity-60">CHARTER-KPI-TTI §2.1</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={handleViewChange}>
            <TabsList className="h-8">
              <TabsTrigger value="individual" className="text-footnote px-3">
                <Target className="h-3 w-3 mr-1" />个人
              </TabsTrigger>
              <TabsTrigger value="department" className="text-footnote px-3">
                <Users className="h-3 w-3 mr-1" />部门
              </TabsTrigger>
              <TabsTrigger value="system" className="text-footnote px-3">
                <Activity className="h-3 w-3 mr-1" />体系
              </TabsTrigger>
              <TabsTrigger value="business_unit" className="text-footnote px-3">
                <BarChart3 className="h-3 w-3 mr-1" />事业部
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />{error}
          </CardContent>
        </Card>
      )}

      {/* 周期选择 */}
      <Card>
        <CardContent className="py-3 px-4 flex items-center gap-4 flex-wrap">
          <Select value={activeCycleId ?? ''} onValueChange={setActiveCycleId}>
            <SelectTrigger className="w-64 h-8 text-caption">
              <SelectValue placeholder="选择考核周期" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · FY{c.fiscalYear}
                  {c.status === 'active' && <Badge className="ml-2 text-footnote" variant="outline">进行中</Badge>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger className="w-24 h-8 text-caption"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="live">实时</SelectItem>
              <SelectItem value="month">按月</SelectItem>
              <SelectItem value="quarter">按季</SelectItem>
              <SelectItem value="year">按年</SelectItem>
            </SelectContent>
          </Select>
          {granularity !== 'live' && periods.length > 0 && (
            <Select value={periodKey ?? ''} onValueChange={setPeriodKey}>
              <SelectTrigger className="w-36 h-8 text-caption"><SelectValue placeholder="选择时点" /></SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {asOfDate && (
            <Badge variant="outline" className="text-footnote flex items-center gap-1">
              <CalendarRange className="h-3 w-3" />截至 {asOfDate}
            </Badge>
          )}
          {activeCycle && (
            <span className="text-footnote text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              考核期: {activeCycle.startDate.slice(0, 10)} 至 {activeCycle.endDate.slice(0, 10)}
            </span>
          )}
          {asOfDate && (
            <span className="text-footnote text-muted-foreground basis-full">
              显示截至 {asOfDate} 的最近快照值; 该时点前无快照的指标按起始值(0%)计 (诚实标注, 无伪造)。
            </span>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          {/* BSC 四维度骨架 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-1.5 w-full" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* 统计卡骨架 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* 健康条骨架 */}
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="ml-auto h-3 w-48" />
            </CardContent>
          </Card>
          {/* 表格骨架 */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : view === 'department' ? renderDeptView() : kpis.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-caption text-muted-foreground">本周期暂无该层级 KPI</CardContent></Card>
      ) : (
        <>
          {/* 1. BSC 四维度战略摘要 (Financial, Customer, Process, Growth) */}
          {renderBscSummary()}

          {/* 2. 汇总统计 (核心看板指标) */}
          {renderDashboard()}

          {/* 3. 健康度分布 */}
          {renderHealthBar()}

          {/* 4. BSC 维度分组明细表 */}
          {renderBscTableGroup()}
        </>
      )}

      {/* 5. BSC 战略详情与 OKR 联动 Drawer (P2 Drawer 核心落地) */}
      {activeKpiId && (() => {
        const kpi = effectiveKpis.find(k => k.id === activeKpiId);
        if (!kpi) return null;
        const hc = healthColor(computeKpiCompletion(kpi));
        const snaps = snapshotsByKpi[kpi.id] ?? [];
        const subject = subjectById.get(kpi.subjectId);
        const pers = BSC_META[getBscPerspective(kpi, subject)];

        // 逆向 OKR 对齐查找 (寻找匹配的 Objective 以做战略树联动)
        const alignedObj = objectives.find(o => o.title.toLowerCase().includes('SLA') || o.title.toLowerCase().includes('性能') || o.title.toLowerCase().includes('可用'));

        return (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in">
            {/* 遮罩 */}
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={() => setActiveKpiId(null)}
            />
            {/* Drawer 容器 */}
            <div className="relative w-full max-w-lg h-full bg-white shadow-soft flex flex-col animate-slide-in-right">
              {/* Header */}
              <header className="px-5 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('p-1 rounded', pers.bg, pers.color)}>
                    <pers.icon className="h-4 w-4" />
                  </span>
                  <div className="space-y-0.5">
                    <h2 className="text-caption font-bold text-slate-800">BSC 战略详情对账</h2>
                    <p className="text-[10px] text-muted-foreground uppercase">{pers.label}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveKpiId(null)} className="h-7 w-7 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </header>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-footnote text-slate-700">
                {/* 1. 指标明细卡 */}
                <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-100 space-y-3">
                  <div>
                    <h3 className="text-caption font-bold text-slate-900 leading-snug">{kpi.title}</h3>
                    {subject && <p className="text-[10px] text-muted-foreground mt-1 font-mono">科目: {subject.code} · {subject.name}</p>}
                    {kpi.description && <p className="text-[10px] text-slate-500 mt-1 leading-normal">{kpi.description}</p>}
                  </div>
                  {/* 数据进度 */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="tabular-nums">
                        当前: <strong className="text-slate-900 font-bold">{kpi.currentValue}</strong> / {kpi.targetValue} {kpi.unit}
                      </span>
                      <span className={cn('font-bold tabular-nums', hc.text)}>{Math.round(computeKpiCompletion(kpi) * 100)}%</span>
                    </div>
                    <Progress value={Math.min(100, Math.round(computeKpiCompletion(kpi) * 100))} className="h-2" />
                  </div>
                </div>

                {/* 2. OKR 战略双向对齐 (OKR Alignment Check) */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-1">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    逆向对齐 OKR 目标 (O)
                  </h4>
                  {alignedObj ? (
                    <div className="bg-primary/5 rounded-md p-3 border border-primary/20 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-footnote font-semibold text-slate-800">
                        <span className="truncate flex items-center gap-1"><Target className="h-3.5 w-3.5 text-primary" /> {alignedObj.title}</span>
                        <Badge variant="outline" className="text-[10px] scale-90">对齐中</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-normal">
                        该 BSC 指标自动通过底层对账映射到上述 OKR，并由本周的 daily check-ins 自动完成增量对账与数据推流。
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[10px]">该指标为独立的底线监控考核，未挂载当前季度的业务 OKR 目标。</p>
                  )}
                </div>

                {/* 3. 30天快照趋势对账明细 */}
                <div className="space-y-2.5">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5" />
                    30 天历史对账趋势快照 (ERP/手动对账)
                  </h4>
                  {snaps.length >= 2 ? (
                    <div className="space-y-3">
                      <div className="flex justify-center py-2 bg-slate-50/20 rounded border">
                        <Sparkline points={snaps} target={kpi.targetValue} health={hc.health} width={380} height={48} />
                      </div>
                      {/* 快照对账列表 */}
                      <div className="border rounded-md divide-y max-h-[160px] overflow-y-auto">
                        {snaps.slice().reverse().map((value, i) => {
                          const progress = kpi.targetValue > 0 ? (value / kpi.targetValue) * 100 : 0;
                          return (
                            <div key={i} className="px-3 py-1.5 flex items-center justify-between text-[11px]">
                              <span className="font-mono text-muted-foreground">对账时点 #{snaps.length - i}</span>
                              <div className="flex items-center gap-2">
                                <span className="tabular-nums font-semibold text-slate-750">{value.toLocaleString()} {kpi.unit}</span>
                                <span className="text-muted-foreground text-[10px] scale-95">({Math.round(progress)}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-[10px]">当前暂无历史周环比快照，对账数据将在下周一 04:00 自动拉取生成。</p>
                  )}
                </div>
              </div>
              {/* Footer */}
              <footer className="p-4 border-t bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" /> 数据来源: {DS[kpi.dataSource ?? 'pending'].label}
                </span>
                <Button size="sm" onClick={() => setActiveKpiId(null)} className="h-8 text-footnote px-4">
                  确定
                </Button>
              </footer>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function MyKpiPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-12 text-center text-footnote text-muted-foreground flex flex-col items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
        正在准备企业对账看板...
      </div>
    }>
      <KpiContent />
    </Suspense>
  );
}
