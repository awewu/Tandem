'use client';

/**
 * /analytics — 组织级分析报表层.
 *
 * 设计 (2026-05-10 v1):
 *  - 加新 sub-route, 不影响 /report (5min 个人日报 · M2 placeholder)
 *  - 指标全部派生自 zustand store, 无新 schema
 *  - SSR-safe: now/computed 全在 useEffect 后渲染
 *  - 后续可加导出 CSV / 时间区间过滤
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Target,
  MessagesSquare,
  Sparkles,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  useOKRStore,
  useOneOnOneStore,
  useReview360Store,
  useOrgStore,
} from '@/lib/store';
import {
  generateInsights,
  computeOrgMetrics,
  type OrgMetrics,
} from '@/lib/insights/derive';
import { buildDeptIndex, resolveOwner } from '@/lib/org/ownership';

export default function AnalyticsPage() {
  const okr = useOKRStore();
  const oneOnOne = useOneOnOneStore();
  const r360 = useReview360Store();
  const org = useOrgStore();

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const metrics: OrgMetrics | null = useMemo(() => {
    if (now == null) return null;
    const input = {
      objectives: okr.objectives,
      keyResults: okr.keyResults,
      checkIns: okr.checkIns,
      meetings: oneOnOne.meetings,
      submissions: r360.submissions,
      cycles360: r360.cycles,
      people: okr.people,
      now,
    };
    const insights = generateInsights(input);
    return computeOrgMetrics(input, insights);
  }, [now, okr.objectives, okr.keyResults, okr.checkIns, okr.people, oneOnOne.meetings, r360.submissions, r360.cycles]);

  // 部门维度 OKR 健康 (走 Ownership SSOT, 修 bug: 原逻辑只看 person.ministryId, 不能解 'team:X' / 'person:X')
  const deptHealth = useMemo(() => {
    if (now == null) return [];
    // 优先用 HR 部门树; 若为空则降级到治理模板 departments
    const hrDepts = org.hrDepts ?? [];
    const deptSrc = hrDepts.length > 0
      ? hrDepts.map((d: import('@/lib/org/departments').HrDept) => ({
          id: d.id, name: d.name, pillar: undefined,
          ministries: [{ id: d.id, name: d.name, tag: d.id, description: d.description, agents: [] }],
        }))
      : org.departments;
    const deptIndex = buildDeptIndex(deptSrc);
    const byKey = new Map<string, { name: string; total: number; onTrack: number; progressSum: number }>();
    for (const o of okr.objectives) {
      const owner = resolveOwner(o.ownerId, { people: okr.people, deptIndex });
      const key = owner.ministryId ?? owner.deptId ?? 'unknown';
      const name = owner.ministryName ?? owner.deptName ?? '未归属';
      const krs = okr.keyResults.filter((k) => k.objectiveId === o.id);
      const prog = krs.length
        ? krs.reduce((s, k) => {
            const span = k.targetValue - k.startValue;
            const pct = span === 0 ? (k.currentValue >= k.targetValue ? 100 : 0) :
              Math.max(0, Math.min(100, ((k.currentValue - k.startValue) / span) * 100));
            return s + pct;
          }, 0) / krs.length
        : 0;
      const cur = byKey.get(key) ?? { name, total: 0, onTrack: 0, progressSum: 0 };
      cur.total++;
      if (o.confidence === 'on-track') cur.onTrack++;
      cur.progressSum += prog;
      byKey.set(key, cur);
    }
    return Array.from(byKey.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        total: v.total,
        onTrack: v.onTrack,
        avg: Math.round(v.progressSum / Math.max(1, v.total)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [now, okr.objectives, okr.keyResults, okr.people, org.departments]);

  return (
    <div className="page-container section-y space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
            <Activity className="h-6 w-6 text-brand-500" />
            组织级分析 · 报表层
          </h1>
          <p className="mt-1 text-body text-ink-secondary">
            跨模块关键指标聚合, 让管理者在 1 屏内看清 OKR 健康 / 1on1 节奏 / 360 进度 / 信号分布.
          </p>
        </div>
        <div className="text-caption text-ink-tertiary">
          {now == null ? '初始化中…' : new Date(now).toLocaleDateString('zh-CN')}
        </div>
      </header>

      {metrics == null ? (
        <div className="card-elevated p-10 text-center text-ink-tertiary">加载中…</div>
      ) : (
        <>
          {/* KPI 卡片行 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              icon={Target}
              label="OKR 健康度"
              value={`${metrics.okrHealth}%`}
              hint={`on-track 占比 · 平均进度 ${metrics.okrAvgProgress}%`}
              tone={metrics.okrHealth >= 70 ? 'good' : metrics.okrHealth >= 40 ? 'warn' : 'bad'}
            />
            <KpiCard
              icon={TrendingUp}
              label="近 30 天 Check-in"
              value={`${metrics.okrCheckInFreq}`}
              hint="平均每 Objective 次数"
              tone={metrics.okrCheckInFreq >= 2 ? 'good' : metrics.okrCheckInFreq >= 1 ? 'warn' : 'bad'}
            />
            <KpiCard
              icon={MessagesSquare}
              label="1on1 覆盖率"
              value={`${metrics.oneOnOneCoverage}%`}
              hint={`平均干劲 ${metrics.oneOnOneAvgMood || '—'}/5`}
              tone={metrics.oneOnOneCoverage >= 80 ? 'good' : metrics.oneOnOneCoverage >= 50 ? 'warn' : 'bad'}
            />
            <KpiCard
              icon={Sparkles}
              label="360 当期进度"
              value={`${metrics.review360Progress}%`}
              hint={metrics.review360Progress > 0 ? '当期已收回比例' : '当前无活跃周期'}
              tone={metrics.review360Progress >= 80 ? 'good' : metrics.review360Progress >= 30 ? 'warn' : 'bad'}
            />
          </div>

          {/* 信号分布 */}
          <section className="card-elevated p-5">
            <h2 className="text-headline text-ink-primary flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-brand-500" />
              信号分布
            </h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <SignalBar label="严重" value={metrics.insightCounts.critical} max={Math.max(1, ...Object.values(metrics.insightCounts))} color="bg-danger" />
              <SignalBar label="注意" value={metrics.insightCounts.warning} max={Math.max(1, ...Object.values(metrics.insightCounts))} color="bg-warning" />
              <SignalBar label="信息" value={metrics.insightCounts.info} max={Math.max(1, ...Object.values(metrics.insightCounts))} color="bg-info" />
              <SignalBar label="正向" value={metrics.insightCounts.positive} max={Math.max(1, ...Object.values(metrics.insightCounts))} color="bg-emerald-500" />
            </div>
            <div className="mt-3 text-footnote text-ink-tertiary">
              详情见 <a href="/insights" className="text-brand-600 hover:underline">/insights</a>
            </div>
          </section>

          {/* OKR 进度直方图 */}
          <section className="card-elevated p-5">
            <h2 className="text-headline text-ink-primary flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-500" />
              OKR 进度分布
            </h2>
            <div className="mt-4 flex items-end gap-1 h-32">
              {metrics.okrProgressHistogram.map((n, i) => {
                const max = Math.max(1, ...metrics.okrProgressHistogram);
                const h = Math.round((n / max) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className="text-footnote text-ink-tertiary">{n || ''}</div>
                    <div
                      className="w-full bg-brand-200 rounded-t"
                      style={{ height: `${h}%`, minHeight: n > 0 ? 4 : 0 }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1 text-footnote text-ink-tertiary">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="flex-1 text-center">{i * 10}-{i * 10 + 9}%</div>
              ))}
            </div>
          </section>

          {/* 部门 OKR 健康表 */}
          <section className="card-elevated p-5">
            <h2 className="text-headline text-ink-primary flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-500" />
              部门 / 小组 OKR 健康
            </h2>
            {deptHealth.length === 0 ? (
              <div className="mt-4 text-caption text-ink-tertiary">暂无数据.</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-caption">
                  <thead>
                    <tr className="text-left text-ink-tertiary border-b">
                      <th className="py-2">小组</th>
                      <th className="py-2 text-right">Objectives</th>
                      <th className="py-2 text-right">on-track</th>
                      <th className="py-2 text-right">平均进度</th>
                      <th className="py-2">健康条</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptHealth.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="py-2 text-ink-primary">{d.name}</td>
                        <td className="py-2 text-right">{d.total}</td>
                        <td className="py-2 text-right">
                          {d.onTrack}/{d.total}
                        </td>
                        <td className="py-2 text-right">{d.avg}%</td>
                        <td className="py-2 w-40">
                          <div className="h-2 bg-surface-3 rounded overflow-hidden">
                            <div
                              className={`h-full ${
                                d.avg >= 70 ? 'bg-emerald-500' : d.avg >= 40 ? 'bg-warning' : 'bg-danger'
                              }`}
                              style={{ width: `${d.avg}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const toneColor =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
      ? 'text-warning'
      : 'text-danger';
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 text-caption text-ink-tertiary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 text-title-1 font-bold ${toneColor}`}>{value}</div>
      <div className="mt-1 text-footnote text-ink-tertiary">{hint}</div>
    </div>
  );
}

function SignalBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const h = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-caption">
        <span className="text-ink-secondary">{label}</span>
        <span className="text-ink-primary font-semibold">{value}</span>
      </div>
      <div className="mt-1 h-2 bg-surface-3 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${h}%` }} />
      </div>
    </div>
  );
}
