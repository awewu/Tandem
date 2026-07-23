'use client';

/**
 * /okr/dashboard — 部门聚合 dashboard (OKR P1 · 2026-05-10)
 *
 * 维度:
 *   - 按部门 (Department / Ministry) 分组
 *   - 每部门: O 数 / 平均进度 / 风险数 / 落后数
 *   - Top 5 落后 + Top 5 高风险 + Top 5 进度领先
 *   - 跨部门对齐统计: 父子异部门 = 沟通成本
 *
 * 100% 派生自 useOKRStore + useOrgStore. 0 schema 改动.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useOKRStore, useOrgStore, type Objective, type KeyResult } from '@/lib/store';
import { objectiveProgress } from '@/lib/okr/progress';
import { objectiveScheduleRisk, type RiskBand } from '@/lib/okr/risk';
import {
  computeAdoptionRates,
  objectivesPerPersonDist,
  krsPerObjectiveDist,
} from '@/lib/okr/adoption';
import { buildDeptIndex, resolveOwner } from '@/lib/org/ownership';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, Users, Target, AlertTriangle, TrendingUp,
  TrendingDown, Network, Clock, ChevronRight, Filter,
} from 'lucide-react';
import { Stat } from '@/components/ui/stat';

const RISK_COLORS: Record<string, string> = {
  'on-track': 'bg-success/15 text-success',
  'at-risk': 'bg-warning/10 text-warning',
  'off-track': 'bg-danger/10 text-danger',
};

interface DeptStats {
  id: string;
  name: string;
  level: 'department' | 'team';
  parentName?: string;
  objectives: Objective[];
  avgProgress: number;
  atRiskCount: number;
  offTrackCount: number;
  onTrackCount: number;
  memberCount: number;
}

export default function OKRDashboardPage() {
  const { cycles, objectives, keyResults, initiatives } = useOKRStore();
  const { departments } = useOrgStore();
  const { people, nameOf } = useOwnerDirectory();

  const [cycleId, setCycleId] = useState<string>(() =>
    cycles.find((c) => c.isActive)?.id ?? cycles[0]?.id ?? ''
  );

  const cycleObjectives = useMemo(
    () => objectives.filter((o) => o.cycleId === cycleId),
    [objectives, cycleId]
  );

  /** Ownership SSOT: ministry/department 索引. 代替原手卷 ownerToDept (修 bug: 现支持 'team:X' / 'person:X' 前缀). */
  const deptIndex = useMemo(() => buildDeptIndex(departments), [departments]);

  /** 封装: ownerId → deptId/deptName/teamName (统一走 SSOT) */
  const ownerToDept = useMemo(() => {
    const cache = new Map<string, { deptId?: string; deptName?: string; teamId?: string; teamName?: string }>();
    const resolve = (ownerId: string) => {
      if (!cache.has(ownerId)) {
        const r = resolveOwner(ownerId, { people, deptIndex });
        cache.set(ownerId, {
          deptId: r.deptId,
          deptName: r.deptName,
          teamId: r.ministryId,
          teamName: r.ministryName,
        });
      }
      return cache.get(ownerId)!;
    };
    return { get: resolve };
  }, [people, deptIndex]);

  /** 部门统计 */
  const deptStats = useMemo<DeptStats[]>(() => {
    const stats: DeptStats[] = [];
    for (const d of departments) {
      const deptOs = cycleObjectives.filter((o) => {
        const di = ownerToDept.get(o.ownerId);
        return di?.deptId === d.id;
      });
      const memberCount = people.filter((p) => {
        const di = ownerToDept.get(p.id);
        return di?.deptId === d.id;
      }).length;

      let avgProg = 0;
      let atRisk = 0;
      let offTrack = 0;
      let onTrack = 0;
      for (const o of deptOs) {
        const prog = objectiveProgress(o, keyResults);
        avgProg += prog;
        if (o.confidence === 'at-risk') atRisk++;
        else if (o.confidence === 'off-track') offTrack++;
        else onTrack++;
      }
      avgProg = deptOs.length > 0 ? Math.round(avgProg / deptOs.length) : 0;

      stats.push({
        id: d.id,
        name: d.name,
        level: 'department',
        objectives: deptOs,
        avgProgress: avgProg,
        atRiskCount: atRisk,
        offTrackCount: offTrack,
        onTrackCount: onTrack,
        memberCount,
      });
    }
    return stats.sort((a, b) => b.objectives.length - a.objectives.length);
  }, [departments, cycleObjectives, ownerToDept, keyResults, people]);

  /** 跨部门对齐统计 */
  const crossDeptCount = useMemo(() => {
    let count = 0;
    for (const o of cycleObjectives) {
      if (!o.parentId) continue;
      const parent = cycleObjectives.find((p) => p.id === o.parentId);
      if (!parent) continue;
      const childDept = ownerToDept.get(o.ownerId)?.deptId;
      const parentDept = ownerToDept.get(parent.ownerId)?.deptId;
      if (childDept && parentDept && childDept !== parentDept) count++;
    }
    return count;
  }, [cycleObjectives, ownerToDept]);

  /** Top 5 列表 */
  const allWithProg = useMemo(
    () => cycleObjectives.map((o) => ({
      o,
      progress: objectiveProgress(o, keyResults),
      ownerName: nameOf(o.ownerId),
      deptName: ownerToDept.get(o.ownerId)?.deptName ?? '—',
    })),
    [cycleObjectives, keyResults, nameOf, ownerToDept]
  );

  const topLagging = [...allWithProg].sort((a, b) => a.progress - b.progress).slice(0, 5);
  const topRisk = allWithProg.filter((x) => x.o.confidence !== 'on-track').slice(0, 5);
  const topLeading = [...allWithProg].sort((a, b) => b.progress - a.progress).slice(0, 5);

  const overallAvg = allWithProg.length > 0
    ? Math.round(allWithProg.reduce((s, x) => s + x.progress, 0) / allWithProg.length)
    : 0;

  const activeCycle = useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);

  /** 组织级三率 (填写/对齐/执行分解) — 对标 Tita OKR 仪表盘 */
  const rates = useMemo(
    () => computeAdoptionRates({ objectives: cycleObjectives, keyResults, initiatives, people }),
    [cycleObjectives, keyResults, initiatives, people],
  );

  /** 分布直方图 */
  const distObj = useMemo(() => objectivesPerPersonDist(cycleObjectives, people), [cycleObjectives, people]);
  const distKr = useMemo(() => krsPerObjectiveDist(cycleObjectives, keyResults), [cycleObjectives, keyResults]);

  /** 客观进度风险 (时间基准线偏差) 分布 */
  const scheduleRisk = useMemo(() => {
    const counts: Record<RiskBand, number> = { 'on-track': 0, 'at-risk': 0, 'off-track': 0 };
    for (const o of cycleObjectives) {
      const r = objectiveScheduleRisk(o, activeCycle, keyResults);
      if (r) counts[r.band]++;
    }
    return counts;
  }, [cycleObjectives, activeCycle, keyResults]);

  /** OKR 提交-审批漏斗 (对标 Tita): 草稿 → 待审批 → 进行中 → 已完成 */
  const statusFunnel = useMemo(() => {
    const c = { draft: 0, submitted: 0, active: 0, paused: 0, completed: 0, abandoned: 0 };
    for (const o of cycleObjectives) {
      const s = (o.status ?? 'active') as keyof typeof c;
      if (s in c) c[s]++;
      else c.active++;
    }
    return c;
  }, [cycleObjectives]);

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-title-3 font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-info" />
              部门 OKR Dashboard
            </h1>
            <p className="text-footnote text-muted-foreground mt-1">
              按部门聚合的进度 / 风险 / 跨部门对齐 — 管理层视角
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              aria-label="选择周期"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="h-9 rounded border border-input bg-white px-2 text-caption"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isActive ? '· 当前' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 全局 KPI · Stat (Stripe-class: tabular-nums + 语义 delta + 单位分级) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <Stat
                label="本周期 Objective 数"
                value={cycleObjectives.length}
                format="integer"
              />
              <Target className="h-8 w-8 text-info opacity-30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <Stat
                label="整体平均进度"
                value={overallAvg / 100}
                format="percent"
                precision={0}
              />
              <TrendingUp
                className={`h-8 w-8 opacity-30 ${
                  overallAvg >= 60
                    ? 'text-success'
                    : overallAvg >= 30
                    ? 'text-warning'
                    : 'text-danger'
                }`}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <Stat
                label="风险 Objective 数"
                value={allWithProg.filter((x) => x.o.confidence !== 'on-track').length}
                format="integer"
                hint="越多越需介入"
                invertTrend
              />
              <AlertTriangle className="h-8 w-8 text-warning opacity-30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <Stat
                label="跨部门对齐"
                value={crossDeptCount}
                format="integer"
                hint="父子异部门 = 沟通重点"
              />
              <Network className="h-8 w-8 text-brand-700 opacity-30" />
            </CardContent>
          </Card>
        </div>

        {cycleObjectives.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-caption text-muted-foreground">
              本周期还没有 Objective. 去 <Link href="/okr" className="text-info underline">/okr</Link> 创建.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 三率: 填写 / 对齐 / 执行分解 — 对标 Tita OKR 仪表盘 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <RateCard
                label="OKR 填写率"
                rate={rates.coverage}
                detail={`${rates.peopleWithOkr} / ${rates.totalPeople} 人已制定 OKR`}
              />
              <RateCard
                label="目标对齐率"
                rate={rates.alignment}
                detail={`${rates.alignedObjectives} / ${rates.totalObjectives} 个 O 挂了上级`}
              />
              <RateCard
                label="执行分解率"
                rate={rates.breakdown}
                detail={`${rates.brokenDownObjectives} / ${rates.totalObjectives} 个 O 已拆到执行项`}
              />
            </div>

            {/* OKR 提交-审批漏斗 — 对标 Tita */}
            <Card className="mb-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-caption flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  提交-审批漏斗
                  <span className="text-[10px] font-normal text-muted-foreground">草稿 → 待审批 → 进行中 → 已完成</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Funnel
                  stages={[
                    { label: '草稿', value: statusFunnel.draft, color: 'bg-ink-tertiary' },
                    { label: '待审批', value: statusFunnel.submitted, color: 'bg-info' },
                    { label: '进行中', value: statusFunnel.active, color: 'bg-success' },
                    { label: '已完成', value: statusFunnel.completed, color: 'bg-brand-500' },
                  ]}
                  aside={[
                    { label: '暂停', value: statusFunnel.paused },
                    { label: '已放弃', value: statusFunnel.abandoned },
                  ]}
                />
              </CardContent>
            </Card>

            {/* 客观进度风险 (时间基准线偏差) + 分布 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-caption flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    客观进度风险
                    <span className="text-[10px] font-normal text-muted-foreground">按时间基准线偏差</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <RiskLine label="在轨" count={scheduleRisk['on-track']} color="bg-success" />
                  <RiskLine label="预警" count={scheduleRisk['at-risk']} color="bg-warning" />
                  <RiskLine label="落后" count={scheduleRisk['off-track']} color="bg-danger" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-caption">每人负责的 O 数分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <DistBar
                    segments={[
                      { label: '未设置', value: distObj.none, color: 'bg-surface-3' },
                      { label: '1 个', value: distObj.one, color: 'bg-success/30' },
                      { label: '2-4 个', value: distObj.twoToFour, color: 'bg-info' },
                      { label: '5+ 个', value: distObj.fivePlus, color: 'bg-danger/30' },
                    ]}
                    unit="人"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-caption">每个 O 下的 KR 数分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <DistBar
                    segments={[
                      { label: '未设置', value: distKr.none, color: 'bg-surface-3' },
                      { label: '1-2 个', value: distKr.oneToTwo, color: 'bg-warning' },
                      { label: '3-5 个', value: distKr.threeToFive, color: 'bg-success/30' },
                      { label: '5+ 个', value: distKr.fivePlus, color: 'bg-danger/30' },
                    ]}
                    unit="个 O"
                  />
                </CardContent>
              </Card>
            </div>

            {/* 部门栅格 */}
            <Card className="mb-5">
              <CardHeader>
                <CardTitle className="text-caption flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  各部门概览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deptStats.filter((d) => d.objectives.length > 0).map((d) => (
                  <DeptRow key={d.id} stats={d} />
                ))}
                {deptStats.filter((d) => d.objectives.length > 0).length === 0 && (
                  <div className="text-footnote text-muted-foreground py-4 text-center">
                    所有 Objective 的负责人都未关联到部门
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 列表 */}
            <div className="grid md:grid-cols-3 gap-4">
              <TopList
                title="🚨 落后 Top 5"
                titleColor="text-danger"
                items={topLagging}
                metric="progress"
              />
              <TopList
                title="⚠️ 风险 Top 5"
                titleColor="text-warning"
                items={topRisk}
                metric="confidence"
              />
              <TopList
                title="🚀 领先 Top 5"
                titleColor="text-success"
                items={topLeading}
                metric="progress"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RateCard({ label, rate, detail }: { label: string; rate: number; detail: string }) {
  const color = rate >= 60 ? 'bg-success' : rate >= 30 ? 'bg-warning' : 'bg-danger';
  const textColor = rate >= 60 ? 'text-success' : rate >= 30 ? 'text-warning' : 'text-danger';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-caption text-muted-foreground">{label}</div>
        <div className={`text-title-3 font-semibold tabular-nums mt-0.5 ${textColor}`}>{rate}%</div>
        <div className="h-1.5 bg-surface-3 rounded overflow-hidden mt-2">
          <div className={`h-full ${color} transition-all`} style={{ width: `${rate}%` }} />
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">{detail}</div>
      </CardContent>
    </Card>
  );
}

function Funnel({
  stages, aside,
}: {
  stages: { label: string; value: number; color: string }[];
  aside: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].value : null;
          const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-12 text-[10px] text-muted-foreground text-right">{s.label}</span>
              <div className="flex-1 h-5 bg-surface-3 rounded overflow-hidden">
                <div
                  className={`h-full ${s.color} transition-all flex items-center justify-end pr-1.5`}
                  style={{ width: `${Math.max((s.value / max) * 100, s.value > 0 ? 8 : 0)}%` }}
                >
                  {s.value > 0 && <span className="text-[10px] font-mono text-white">{s.value}</span>}
                </div>
              </div>
              <span className="w-12 text-[10px] text-muted-foreground">
                {conv != null ? `${conv}%↓` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 sm:flex-col sm:border-l sm:pl-3">
        {aside.map((a) => (
          <div key={a.label} className="text-center sm:text-left">
            <div className="text-caption font-semibold tabular-nums">{a.value}</div>
            <div className="text-[10px] text-muted-foreground">{a.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskLine({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-footnote">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{count}</span>
    </div>
  );
}

function DistBar({
  segments, unit,
}: {
  segments: { label: string; value: number; color: string }[];
  unit: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div>
      <div className="flex h-3 rounded overflow-hidden bg-surface-3">
        {total === 0 ? (
          <div className="flex-1" />
        ) : (
          segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.label}
                className={s.color}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value} ${unit}`}
              />
            ) : null,
          )
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="flex-1">{s.label}</span>
            <span className="font-mono">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeptRow({ stats }: { stats: DeptStats }) {
  const progColor = stats.avgProgress >= 60 ? 'bg-success'
    : stats.avgProgress >= 30 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="border rounded p-3 hover:bg-surface-2/60 transition">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="text-caption font-semibold flex items-center gap-1.5">
            {stats.name}
            <span className="text-[10px] text-muted-foreground font-normal">
              {stats.objectives.length} O · {stats.memberCount} 人
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {stats.onTrackCount > 0 && (
            <Badge className={RISK_COLORS.on_track}>{stats.onTrackCount} 在轨</Badge>
          )}
          {stats.atRiskCount > 0 && (
            <Badge className={RISK_COLORS.at_risk}>{stats.atRiskCount} 风险</Badge>
          )}
          {stats.offTrackCount > 0 && (
            <Badge className={RISK_COLORS.off_track}>{stats.offTrackCount} 落后</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-3 rounded overflow-hidden">
          <div
            className={`h-full ${progColor} transition-all`}
            style={{ width: `${stats.avgProgress}%` }}
          />
        </div>
        <span className="text-footnote font-mono w-10 text-right">{stats.avgProgress}%</span>
      </div>
    </div>
  );
}

function TopList({
  title, titleColor, items, metric,
}: {
  title: string;
  titleColor: string;
  items: { o: Objective; progress: number; ownerName: string; deptName: string }[];
  metric: 'progress' | 'confidence';
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-caption ${titleColor}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-footnote text-muted-foreground py-2">无</div>
        ) : (
          items.map((x) => (
            <Link
              key={x.o.id}
              href={`/okr?o=${x.o.id}`}
              className="block border rounded px-2 py-1.5 text-footnote hover:bg-muted/50 transition"
            >
              <div className="font-medium truncate">{x.o.title}</div>
              <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                <span>{x.ownerName} · {x.deptName}</span>
                {metric === 'progress' ? (
                  <span className="font-mono font-semibold">{x.progress}%</span>
                ) : (
                  <Badge className={`text-[9px] h-3.5 px-1 ${RISK_COLORS[x.o.confidence as keyof typeof RISK_COLORS]}`}>
                    {x.o.confidence === 'at-risk' ? '风险' : x.o.confidence === 'off-track' ? '落后' : '在轨'}
                  </Badge>
                )}
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
