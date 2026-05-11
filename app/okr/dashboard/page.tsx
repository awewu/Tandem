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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, Users, Target, AlertTriangle, TrendingUp,
  TrendingDown, Network, Clock, ChevronRight, Filter,
} from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
  'on-track': 'bg-emerald-100 text-emerald-700',
  'at-risk': 'bg-amber-100 text-amber-800',
  'off-track': 'bg-rose-100 text-rose-700',
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

function calcObjectiveProgress(o: Objective, krs: KeyResult[]): number {
  if (typeof o.progressOverride === 'number') return o.progressOverride;
  const own = krs.filter((k) => k.objectiveId === o.id);
  if (own.length === 0) return 0;
  const totalW = own.reduce((s, k) => s + (k.weight || 1), 0);
  let sum = 0;
  for (const k of own) {
    const range = k.targetValue - k.startValue;
    const ratio = range === 0 ? 0 : (k.currentValue - k.startValue) / range;
    sum += Math.max(0, Math.min(1, ratio)) * (k.weight || 1);
  }
  return Math.round((sum / totalW) * 100);
}

export default function OKRDashboardPage() {
  const { cycles, objectives, keyResults, people } = useOKRStore();
  const { departments } = useOrgStore();

  const [cycleId, setCycleId] = useState<string>(() =>
    cycles.find((c) => c.isActive)?.id ?? cycles[0]?.id ?? ''
  );

  const cycleObjectives = useMemo(
    () => objectives.filter((o) => o.cycleId === cycleId),
    [objectives, cycleId]
  );

  /** owner → department 映射 */
  const ownerToDept = useMemo(() => {
    const map = new Map<string, { deptId: string; deptName: string; teamId?: string; teamName?: string }>();
    for (const p of people) {
      // person.ministryId 可能是 ministry.id 或 department.id
      let info: { deptId: string; deptName: string; teamId?: string; teamName?: string } | null = null;
      for (const d of departments) {
        if (d.id === p.ministryId) {
          info = { deptId: d.id, deptName: d.name };
          break;
        }
        for (const m of d.ministries) {
          if (m.id === p.ministryId) {
            info = { deptId: d.id, deptName: d.name, teamId: m.id, teamName: m.name };
            break;
          }
        }
        if (info) break;
      }
      if (info) map.set(p.id, info);
    }
    return map;
  }, [people, departments]);

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
        const prog = calcObjectiveProgress(o, keyResults);
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
      progress: calcObjectiveProgress(o, keyResults),
      ownerName: people.find((p) => p.id === o.ownerId)?.name ?? o.ownerId,
      deptName: ownerToDept.get(o.ownerId)?.deptName ?? '—',
    })),
    [cycleObjectives, keyResults, people, ownerToDept]
  );

  const topLagging = [...allWithProg].sort((a, b) => a.progress - b.progress).slice(0, 5);
  const topRisk = allWithProg.filter((x) => x.o.confidence !== 'on-track').slice(0, 5);
  const topLeading = [...allWithProg].sort((a, b) => b.progress - a.progress).slice(0, 5);

  const overallAvg = allWithProg.length > 0
    ? Math.round(allWithProg.reduce((s, x) => s + x.progress, 0) / allWithProg.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              部门 OKR Dashboard
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              按部门聚合的进度 / 风险 / 跨部门对齐 — 管理层视角
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              aria-label="选择周期"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="h-9 rounded border border-input bg-white px-2 text-sm"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isActive ? '· 当前' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 全局 KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard
            label="本周期 Objective 数"
            value={cycleObjectives.length}
            icon={Target}
            color="text-blue-600"
          />
          <KpiCard
            label="整体平均进度"
            value={`${overallAvg}%`}
            icon={TrendingUp}
            color={overallAvg >= 60 ? 'text-emerald-600' : overallAvg >= 30 ? 'text-amber-600' : 'text-rose-600'}
          />
          <KpiCard
            label="风险 Objective 数"
            value={allWithProg.filter((x) => x.o.confidence !== 'on-track').length}
            icon={AlertTriangle}
            color="text-amber-600"
          />
          <KpiCard
            label="跨部门对齐"
            value={crossDeptCount}
            icon={Network}
            color="text-violet-600"
            hint="父子异部门 = 沟通重点"
          />
        </div>

        {cycleObjectives.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              本周期还没有 Objective. 去 <Link href="/okr" className="text-blue-600 underline">/okr</Link> 创建.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 部门栅格 */}
            <Card className="mb-5">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  各部门概览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deptStats.filter((d) => d.objectives.length > 0).map((d) => (
                  <DeptRow key={d.id} stats={d} />
                ))}
                {deptStats.filter((d) => d.objectives.length > 0).length === 0 && (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    所有 Objective 的负责人都未关联到部门
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top 列表 */}
            <div className="grid md:grid-cols-3 gap-4">
              <TopList
                title="🚨 落后 Top 5"
                titleColor="text-rose-700"
                items={topLagging}
                metric="progress"
              />
              <TopList
                title="⚠️ 风险 Top 5"
                titleColor="text-amber-700"
                items={topRisk}
                metric="confidence"
              />
              <TopList
                title="🚀 领先 Top 5"
                titleColor="text-emerald-700"
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

function KpiCard({
  label, value, icon: Icon, color, hint,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-30`} />
        </div>
      </CardContent>
    </Card>
  );
}

function DeptRow({ stats }: { stats: DeptStats }) {
  const progColor = stats.avgProgress >= 60 ? 'bg-emerald-500'
    : stats.avgProgress >= 30 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="border rounded p-3 hover:bg-slate-50/60 transition">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
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
        <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
          <div
            className={`h-full ${progColor} transition-all`}
            style={{ width: `${stats.avgProgress}%` }}
          />
        </div>
        <span className="text-xs font-mono w-10 text-right">{stats.avgProgress}%</span>
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
        <CardTitle className={`text-sm ${titleColor}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">无</div>
        ) : (
          items.map((x) => (
            <Link
              key={x.o.id}
              href={`/okr?o=${x.o.id}`}
              className="block border rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition"
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
