'use client';

/**
 * /organization/performance — 我的绩效与潜力
 *
 * 「组织 · 反馈评估」组内的员工自视角聚合页:
 *   - 我的: 我的 KPI 完成率 + OKR/TTI 进度 + 【我的收入】(仅本人可见, 后端严格按 auth.userId 过滤)
 *   - 下属: 若本人在组织架构中有下属 (managerId 汇报链), 展示其目标达成情况——不含任何收入字段
 *
 * 数据源: GET /api/organization/performance?scope=me|reports (只读, 无写操作)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Target, Wallet, Users, TrendingUp, AlertCircle, Grid3x3, Coins, Layers, ArrowUpRight, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

type NineBoxCell =
  | 'star'
  | 'high_performer'
  | 'risk_burnout'
  | 'rising_talent'
  | 'core'
  | 'plateau'
  | 'mismatch'
  | 'low_engagement'
  | 'must_intervene';

const NINE_BOX_META: Record<NineBoxCell, { label: string; emoji: string; cls: string }> = {
  star: { label: '明星', emoji: '⭐', cls: 'bg-warning/5 text-warning border-warning/20' },
  high_performer: { label: '高产', emoji: '🚀', cls: 'bg-success/10 text-success border-success/30' },
  risk_burnout: { label: '风险枯萎', emoji: '⚠️', cls: 'bg-danger/5 text-danger border-danger/30' },
  rising_talent: { label: '升星人才', emoji: '🌱', cls: 'bg-info/10 text-info border-info/30' },
  core: { label: '核心力量', emoji: '🧱', cls: 'bg-surface-1 text-ink-primary border' },
  plateau: { label: '平台期', emoji: '➖', cls: 'bg-surface-1 text-ink-secondary border' },
  mismatch: { label: '人岗错位', emoji: '🔄', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  low_engagement: { label: '投入不足', emoji: '😴', cls: 'bg-warning/5 text-warning border-warning/20' },
  must_intervene: { label: '必须干预', emoji: '🚨', cls: 'bg-danger/10 text-danger border-danger/40' },
};

interface KpiSummary {
  id: string;
  title: string;
  scope: 'bonus' | 'monitor';
  weight: number;
  completion: number;
}

interface ObjectiveSummary {
  id: string;
  title: string;
  confidence: string;
  progress: number;
}

interface NineBoxSummary {
  kpiScore: number;
  ttiScore: number;
  cell: NineBoxCell;
}

interface MePerformance {
  userId: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox: NineBoxSummary | null;
  bonus: {
    baseBonus: number;
    weightedCompletion: number;
    finalBonus: number;
    committed: boolean;
  } | null;
}

interface ReportPerformance {
  userId: string;
  name?: string;
  email?: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox: NineBoxSummary | null;
}

interface CycleLite {
  id: string;
  name: string;
  status: string;
}

function completionColor(c: number): string {
  if (c >= 0.9) return 'text-success';
  if (c >= 0.6) return 'text-warning';
  return 'text-danger';
}

function confidenceBadge(confidence: string) {
  if (confidence === 'on-track') return { label: '进度健康', cls: 'bg-success/10 text-success border-success/30' };
  if (confidence === 'at-risk') return { label: '有风险', cls: 'bg-warning/5 text-warning border-warning/20' };
  return { label: '已偏离', cls: 'bg-danger/5 text-danger border-danger/30' };
}

function KpiRow({ k }: { k: KpiSummary }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-footnote">
        <span className="truncate flex items-center gap-1.5">
          {k.title}
          <Badge variant="outline" className="text-[9px] scale-90">
            {k.scope === 'bonus' ? '强考核' : '监控'}
          </Badge>
        </span>
        <span className={cn('font-semibold tabular-nums', completionColor(k.completion))}>
          {Math.round(k.completion * 100)}%
        </span>
      </div>
      <Progress value={Math.min(100, Math.round(k.completion * 100))} className="h-1.5" />
    </div>
  );
}

function ObjectiveRow({ o }: { o: ObjectiveSummary }) {
  const badge = confidenceBadge(o.confidence);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-footnote">
        <span className="truncate">{o.title}</span>
        <Badge variant="outline" className={cn('text-[9px] scale-90', badge.cls)}>
          {badge.label}
        </Badge>
      </div>
      <Progress value={Math.round(o.progress * 100)} className="h-1.5" />
    </div>
  );
}

function PersonCard({
  title,
  kpis,
  objectives,
  nineBox,
  bonus,
}: {
  title: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox?: NineBoxSummary | null;
  bonus?: MePerformance['bonus'];
}) {
  const nineBoxMeta = nineBox ? NINE_BOX_META[nineBox.cell] : null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-caption flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {title}
          </span>
          {nineBoxMeta && (
            <Badge variant="outline" className={cn('text-[10px] scale-90', nineBoxMeta.cls)}>
              {nineBoxMeta.emoji} {nineBoxMeta.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nineBox && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Grid3x3 className="h-3 w-3" />
            9-box 落点: KPI {Math.round(nineBox.kpiScore * 100)}% × TTI/360 {Math.round(nineBox.ttiScore * 100)}%
          </div>
        )}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Target className="h-3 w-3" /> KPI 目标达成
          </div>
          {kpis.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">当前周期暂无 KPI</p>
          ) : (
            kpis.map((k) => <KpiRow key={k.id} k={k} />)
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> OKR / TTI 进度
          </div>
          {objectives.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">当前无进行中的目标</p>
          ) : (
            objectives.map((o) => <ObjectiveRow key={o.id} o={o} />)
          )}
        </div>
        {bonus !== undefined && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Wallet className="h-3 w-3" /> 我的收入 (仅本人可见)
            </div>
            {bonus ? (
              <div className="bg-primary/5 rounded-md p-3 border border-primary/20 flex items-center justify-between">
                <div className="text-[10px] text-muted-foreground">
                  基础奖金 {bonus.baseBonus.toLocaleString()} × 加权完成率 {Math.round(bonus.weightedCompletion * 100)}%
                </div>
                <div className="text-right">
                  <div className="text-headline font-bold text-primary tabular-nums">
                    {Math.round(bonus.finalBonus).toLocaleString()}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {bonus.committed ? '已下发' : '预估 (未下发)'}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">本周期暂未生成奖金核算结果</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GradeGapSkill {
  id: string;
  name: string;
  skillWage: number;
}

interface CompGradeView {
  status: 'ok' | 'notfound';
  family?: { id: string; name: string; board: string };
  jobClass?: string;
  level?: string;
  taskGear?: string;
  breakdown?: { base: number; skill: number; task: number; monthly: number };
  certifiedSkillWage?: number;
  standardSkillWage?: number;
  nextLevel?: { level: string; standardSkillWage: number; gapSkills: GradeGapSkill[] } | null;
}

function SegmentBar({ base, skill, task }: { base: number; skill: number; task: number }) {
  const total = base + skill + task || 1;
  const seg = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full">
      <div className="bg-info/70" style={{ width: seg(base) }} title={`基本 ${base}`} />
      <div className="bg-success/70" style={{ width: seg(skill) }} title={`技能 ${skill}`} />
      <div className="bg-warning/70" style={{ width: seg(task) }} title={`任务 ${task}`} />
    </div>
  );
}

function CompGradeCard() {
  const [view, setView] = useState<CompGradeView | null>(null);
  const [locked, setLocked] = useState<{ hasPin: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [wiGear, setWiGear] = useState<string | null>(null);
  const [wiMonthly, setWiMonthly] = useState<number | null>(null);
  const [wiDelta, setWiDelta] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/comp/me/grade', { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      if (j.locked) { setLocked({ hasPin: !!j.hasPin }); setView(null); }
      else { setView(j.view ?? null); setLocked(null); }
    } catch {
      setView(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitPin(action: 'set' | 'unlock') {
    if (action === 'set' && pin !== pin2) { setPinErr('两次输入不一致'); return; }
    setBusy(true); setPinErr(null);
    try {
      const r = await fetch('/api/comp/income', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pin }),
      });
      const j = await r.json();
      if (!r.ok) { setPinErr(j.error ?? '操作失败'); return; }
      setPin(''); setPin2('');
      await load();
    } catch (e) {
      setPinErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function lockNow() {
    await fetch('/api/comp/income', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock' }),
    });
    setView(null); setLocked({ hasPin: true });
  }

  async function simGear(gear: string) {
    setWiGear(gear);
    try {
      const r = await fetch('/api/comp/me/what-if', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toGear: gear }),
      });
      const j = await r.json();
      if (j.result?.after) { setWiMonthly(j.result.after.monthly); setWiDelta(j.result.delta ?? 0); }
    } catch { /* noop */ }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center text-muted-foreground text-caption">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载薪酬构成…
        </CardContent>
      </Card>
    );
  }

  if (locked) {
    return (
      <Card className="border-warning/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-warning" /> 我的薪酬构成 · 已加密
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            {locked.hasPin
              ? '收入数据受二次密码保护，请输入二次密码解锁 (有效 15 分钟)。'
              : '首次查看请设置收入二次密码 (6-12 位数字，独立于登录密码)。'}
          </p>
          <div className="space-y-2 max-w-xs">
            <Input
              type="password"
              inputMode="numeric"
              placeholder={locked.hasPin ? '二次密码' : '设置二次密码 (6-12 位数字)'}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && locked.hasPin) void submitPin('unlock'); }}
              className="h-8 text-[12px]"
            />
            {!locked.hasPin && (
              <Input
                type="password"
                inputMode="numeric"
                placeholder="再次输入确认"
                value={pin2}
                onChange={(e) => setPin2(e.target.value)}
                className="h-8 text-[12px]"
              />
            )}
            {pinErr && <p className="text-[10px] text-danger">{pinErr}</p>}
            <Button
              size="sm"
              className="h-8 text-[12px] gap-1"
              disabled={busy || !pin}
              onClick={() => submitPin(locked.hasPin ? 'unlock' : 'set')}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
              {locked.hasPin ? '解锁查看' : '设置并解锁'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!view || view.status !== 'ok' || !view.breakdown) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption flex items-center gap-1.5">
            <Coins className="h-4 w-4" /> 我的薪酬构成
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-[11px] text-muted-foreground">
          尚未为你建立职级定位，薪酬构成暂不可用。
        </CardContent>
      </Card>
    );
  }

  const b = view.breakdown;
  const skillPct = view.standardSkillWage
    ? Math.min(100, Math.round(((view.certifiedSkillWage ?? 0) / view.standardSkillWage) * 100))
    : 100;
  const nextGain = view.nextLevel
    ? view.nextLevel.gapSkills.reduce((a, s) => a + s.skillWage, 0)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-caption flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <Coins className="h-4 w-4" /> 我的薪酬构成 (仅本人可见)
          </span>
          <span className="flex items-center gap-1">
            {view.family && (
              <Badge variant="outline" className="text-[9px] scale-90">{view.family.name}</Badge>
            )}
            <Badge variant="outline" className="text-[9px] scale-90 flex items-center gap-0.5">
              <Layers className="h-2.5 w-2.5" />{view.jobClass}类·{view.level}·任务{view.taskGear}档
            </Badge>
            <button
              onClick={() => void lockNow()}
              title="立即上锁"
              className="text-muted-foreground hover:text-warning transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-primary/5 rounded-md p-3 border border-primary/20">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] text-muted-foreground uppercase">月薪构成</span>
            <span className="text-headline font-bold text-primary tabular-nums">
              {b.monthly.toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground">/月</span>
            </span>
          </div>
          <SegmentBar base={b.base} skill={b.skill} task={b.task} />
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
            <span className="text-info">基本 {b.base.toLocaleString()}</span>
            <span className="text-success">技能 {b.skill.toLocaleString()}</span>
            <span className="text-warning">任务 {b.task.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-footnote">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase">
              <TrendingUp className="h-3 w-3" /> 技能认证进度 (A轨)
            </span>
            <span className="tabular-nums text-[10px] text-muted-foreground">
              已认证 {(view.certifiedSkillWage ?? 0).toLocaleString()} / 本级标准 {(view.standardSkillWage ?? 0).toLocaleString()}
            </span>
          </div>
          <Progress value={skillPct} className="h-1.5" />
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase">
            <Wallet className="h-3 w-3" /> 任务档试算 (B轨 · 承接越重越高)
          </div>
          <div className="flex gap-1">
            {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((gg) => (
              <button
                key={gg}
                onClick={() => void simGear(gg)}
                className={cn(
                  'h-6 w-7 rounded text-[10px] border tabular-nums transition-colors',
                  (wiGear ?? view.taskGear) === gg
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'text-ink-secondary border-border hover:bg-surface-1',
                )}
              >
                {gg}
              </button>
            ))}
          </div>
          {wiMonthly !== null && wiGear && (
            <p className="text-[10px] text-muted-foreground">
              {wiGear} 档月薪 <span className="text-primary font-semibold tabular-nums">{wiMonthly.toLocaleString()}</span>
              {wiDelta !== 0 && (
                <span className={cn('ml-1 tabular-nums', wiDelta > 0 ? 'text-success' : 'text-danger')}>
                  ({wiDelta > 0 ? '+' : ''}{wiDelta.toLocaleString()})
                </span>
              )}
            </p>
          )}
        </div>

        {view.nextLevel && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase">
                <ArrowUpRight className="h-3 w-3" /> 晋级 {view.nextLevel.level} 缺口
              </span>
              {nextGain > 0 && (
                <Badge variant="outline" className="text-[9px] scale-90 bg-success/10 text-success border-success/30">
                  认证全部 +{nextGain.toLocaleString()}/月
                </Badge>
              )}
            </div>
            {view.nextLevel.gapSkills.length === 0 ? (
              <p className="text-[10px] text-success">✓ 已满足下一级全部必备技能</p>
            ) : (
              <div className="space-y-1">
                {view.nextLevel.gapSkills.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-[10px]">
                    <span className="truncate text-ink-secondary">{s.name}</span>
                    <span className="tabular-nums text-success shrink-0">+{s.skillWage.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrganizationPerformancePage() {
  const [tab, setTab] = useState<'me' | 'reports'>('me');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<CycleLite | null>(null);
  const [me, setMe] = useState<MePerformance | null>(null);
  const [reports, setReports] = useState<ReportPerformance[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/organization/performance?scope=${tab}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setCycle(j.cycle ?? null);
        if (tab === 'me') setMe(j.me ?? null);
        else setReports(j.reports ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const hasReports = reports.length > 0;

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          我的绩效与潜力
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          BSC 目标达成 + OKR/TTI 推进进度{cycle && <> · 周期 <strong>{cycle.name}</strong></>}
        </p>
      </header>

      <div className="flex items-center gap-2 border-b">
        <button
          className={cn(
            'px-3 py-2 text-footnote font-medium border-b-2 -mb-px',
            tab === 'me' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
          )}
          onClick={() => setTab('me')}
        >
          我的
        </button>
        <button
          className={cn(
            'px-3 py-2 text-footnote font-medium border-b-2 -mb-px',
            tab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
          )}
          onClick={() => setTab('reports')}
        >
          下属
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-caption">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载中…
        </div>
      )}

      {!loading && error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-caption text-danger flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            加载失败: {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && tab === 'me' && (
        <div className="space-y-4">
          <PersonCard
            title="我的目标与收入"
            kpis={me?.kpis ?? []}
            objectives={me?.objectives ?? []}
            nineBox={me?.nineBox}
            bonus={me?.bonus}
          />
          <CompGradeCard />
        </div>
      )}

      {!loading && !error && tab === 'reports' && (
        hasReports ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((r) => (
              <PersonCard
                key={r.userId}
                title={r.name ?? r.email ?? r.userId}
                kpis={r.kpis}
                objectives={r.objectives}
                nineBox={r.nineBox}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-caption">
              <Users className="w-10 h-10 mx-auto opacity-20 mb-2" />
              你在组织架构中暂无下属 (managerId 汇报链为空)
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
