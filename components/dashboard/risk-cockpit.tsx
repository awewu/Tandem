'use client';

/**
 * <RiskCockpit /> — 首页置顶 AI 风险驾驶舱 (2026-06-27)
 *
 * 对标 Tita 首页"风险分析"一句话摘要, 但用客观算法 (时间基准偏差) 而非人工标注:
 *   "AI 风险扫描:N 个目标严重滞后 · M 个预警 · X 个逾期行动项 · 填写率 Y%"
 *
 * 工程约束 (用户铁律):
 *   - 100% 派生自 useOKRStore (DB hydrate), 无写死/无 mock
 *   - SSR-safe: now 在 useEffect 内取
 *   - 无激活周期 → 不渲染; 无风险 → 渲染极简"全部在轨"(不占视觉)
 *   - 每个数字都能下钻到真实路由 (/okr/dashboard, /okr#obj-)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ArrowRight, AlertTriangle, Clock } from 'lucide-react';
import { useOKRStore } from '@/lib/store';
import { computeRiskCockpit } from '@/lib/okr/cockpit';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';

export function RiskCockpit() {
  const { cycles, objectives, keyResults, initiatives } = useOKRStore();
  const { people, nameOf } = useOwnerDirectory();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const activeCycle = useMemo(
    () => cycles.find((c) => c.isActive) ?? cycles[0],
    [cycles],
  );

  const cockpit = useMemo(() => {
    if (now == null) return null;
    return computeRiskCockpit({
      objectives, keyResults, initiatives, people, cycle: activeCycle, now,
    });
  }, [now, objectives, keyResults, initiatives, people, activeCycle]);

  // 未初始化 / 无激活周期 / 无活跃目标 → 不渲染 (不占位、不糊弄)
  if (!cockpit || cockpit.activeCycleId == null || cockpit.totalActiveObjectives === 0) {
    return null;
  }

  // 全部在轨 → 极简正向条
  if (!cockpit.hasRisk) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 text-success shrink-0" />
        <span className="text-caption text-success">
          AI 风险扫描:本周期 {cockpit.totalActiveObjectives} 个目标全部在轨 · 填写率 {cockpit.coverage}%
        </span>
        <Link
          href="/okr/dashboard"
          className="ml-auto text-footnote text-success hover:text-success inline-flex items-center gap-1 shrink-0"
        >
          健康看板 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card-elevated p-4 ring-1 ring-warning/20">
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-9 w-9 rounded-md bg-warning/10 flex items-center justify-center">
          <ShieldAlert className="h-4 w-4 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-headline text-ink-primary flex items-center gap-2">
              AI 风险扫描
              <span className="text-footnote font-normal text-ink-tertiary">
                · 时间基准客观评估 · {cockpit.totalActiveObjectives} 个目标
              </span>
            </div>
            <Link
              href="/okr/dashboard"
              className="text-caption text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 shrink-0"
            >
              健康看板 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* 一句话摘要数字 (全部真实派生, 可下钻) */}
          <div className="mt-2 flex items-center gap-x-5 gap-y-1.5 flex-wrap text-caption">
            <Metric value={cockpit.offTrack} label="严重滞后" tone="danger" />
            <Metric value={cockpit.atRisk} label="预警" tone="warning" />
            <Metric value={cockpit.overdueInitiatives} label="逾期行动项" tone="warning" icon={Clock} />
            <span className="text-ink-tertiary">
              填写率 <strong className="text-ink-secondary">{cockpit.coverage}%</strong>
            </span>
            <span className="text-ink-tertiary">
              对齐率 <strong className="text-ink-secondary">{cockpit.alignment}%</strong>
            </span>
          </div>

          {/* 最该关注的目标 — 直接下钻 */}
          {cockpit.topRisks.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {cockpit.topRisks.slice(0, 3).map((r) => (
                <li key={r.objectiveId} className="flex min-w-0 items-center gap-2 text-caption">
                  <AlertTriangle
                    className={`h-3.5 w-3.5 shrink-0 ${r.band === 'off-track' ? 'text-danger' : 'text-warning'}`}
                  />
                  <Link
                    href={`/okr#obj-${r.objectiveId}`}
                    className="text-ink-primary hover:text-brand-600 truncate"
                  >
                    {r.title}
                  </Link>
                  <span className="text-ink-tertiary shrink-0">· {nameOf(r.ownerId)}</span>
                  <span className="ml-auto text-footnote text-ink-tertiary shrink-0">
                    落后基准 <strong className="text-danger">{r.variance}%</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  value, label, tone, icon: Icon,
}: {
  value: number;
  label: string;
  tone: 'danger' | 'warning';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const color = tone === 'danger' ? 'text-danger' : 'text-warning';
  return (
    <span className="inline-flex items-center gap-1 text-ink-tertiary">
      {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
      <strong className={`text-body font-semibold ${value > 0 ? color : 'text-ink-secondary'}`}>{value}</strong>
      {label}
    </span>
  );
}
