'use client';

/**
 * /okr/calibration · 经理一屏校准下属 OKR 评分 (vs Tita/WorkBoard 季末校准会议)
 *
 * 用法:
 *   - 路径: /okr/calibration?cycleId=xxx (默认 active cycle)
 *   - 经理 (currentUserId) 看到下属在该周期的所有 Objective
 *   - 每行: 下属 / Objective / 自评 / AI 推荐 / 偏差 / [输入校准分] / 推理 tooltip
 *   - 高偏差 (>=0.2) 排序在前, 经理优先看
 *   - 批量保存 → 写 managerScore + reviewedAt + audit
 *
 * 数据源:
 *   - currentUserId 当 managerId
 *   - 下属: useOneOnOneStore.meetings 按 managerId === currentUserId 推 reportId
 *   - 全部 Objective + KR + Person 来自 useOKRStore
 *   - active cycle 默认 + URL ?cycleId 覆盖
 *
 * v0 范围: 单屏 grid + 批量保存. v1 加 1on1 联动 / 校准会议日历自动插.
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useOKRStore, useOneOnOneStore } from '@/lib/store';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import {
  buildCalibrationGrid,
  saveCalibrations,
  type CalibrationRow,
  type CalibrationUpdate,
} from '@/lib/services/okr-calibration';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Save,
  RotateCcw,
  Info,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DRIFT_META = {
  high: { label: '高偏差', tone: 'text-danger', bg: 'bg-danger/5 ring-danger/30' },
  medium: { label: '中偏差', tone: 'text-warning', bg: 'bg-warning/5 ring-warning/30' },
  low: { label: '小偏差', tone: 'text-success', bg: 'bg-success/5 ring-success/30' },
} as const;

export default function OkrCalibrationPage() {
  return (
    <Suspense fallback={null}>
      <OkrCalibrationPageInner />
    </Suspense>
  );
}

function OkrCalibrationPageInner() {
  const searchParams = useSearchParams();
  const currentUserId = useCurrentUserId();

  const { cycles, objectives, keyResults, people, updateObjective, activeCycleId } = useOKRStore();
  const meetings = useOneOnOneStore((s) => s.meetings);

  const cycleIdFromUrl = searchParams.get('cycleId');
  const cycleId = cycleIdFromUrl ?? activeCycleId ?? cycles[0]?.id ?? '';
  const cycle = cycles.find((c) => c.id === cycleId);

  // 派生下属: 1on1 meetings 中 managerId === currentUserId 的 reportId 集合
  const subordinateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of meetings) {
      if (m.managerId === currentUserId) ids.add(m.reportId);
    }
    return Array.from(ids);
  }, [meetings, currentUserId]);

  const ownerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of people) map[p.id] = p.name;
    return map;
  }, [people]);

  // grid 派生 (随 store 变化重算)
  const grid = useMemo(
    () =>
      buildCalibrationGrid({
        managerId: currentUserId,
        cycleId,
        subordinateIds,
        allObjectives: objectives,
        allKrs: keyResults,
        ownerNameMap,
      }),
    [currentUserId, cycleId, subordinateIds, objectives, keyResults, ownerNameMap],
  );

  // 编辑态: objectiveId → managerScore (本地缓冲, 未保存)
  const [drafts, setDrafts] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // 日期管理: 季度(周期) / 月度期中检查点
  const [granularity, setGranularity] = useState<'quarter' | 'month'>('quarter');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const monthsInCycle = useMemo(() => {
    if (!cycle) return [] as { value: string; label: string }[];
    const out: { value: string; label: string }[] = [];
    const start = new Date(cycle.startDate);
    const end = new Date(cycle.endDate);
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    let guard = 0;
    while (d <= last && guard < 36) {
      out.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      });
      d.setMonth(d.getMonth() + 1);
      guard++;
    }
    return out;
  }, [cycle]);
  const activeMonth = selectedMonth ?? monthsInCycle[0]?.value ?? null;

  // 重置 draft 当 grid 数据变化 (不要覆盖用户正在打字)
  useEffect(() => {
    // 只清空未编辑过的; 保留编辑中的
    setDrafts((prev) => {
      const next: Record<string, number | null> = {};
      for (const r of grid.rows) {
        if (r.objectiveId in prev) next[r.objectiveId] = prev[r.objectiveId];
      }
      return next;
    });
  }, [grid.rows]);

  function setDraft(objectiveId: string, value: number | null) {
    setDrafts((prev) => ({ ...prev, [objectiveId]: value }));
  }

  function fillRecommended(row: CalibrationRow) {
    setDraft(row.objectiveId, row.suggestedScore);
  }

  function fillAllRecommended() {
    const next: Record<string, number | null> = {};
    for (const r of grid.rows) {
      next[r.objectiveId] = r.managerScore ?? r.suggestedScore;
    }
    setDrafts(next);
  }

  function clearAll() {
    setDrafts({});
  }

  const dirtyCount = Object.keys(drafts).length;

  async function save() {
    if (saving || dirtyCount === 0) return;
    setSaving(true);
    try {
      const updates: CalibrationUpdate[] = Object.entries(drafts).map(([objectiveId, managerScore]) => ({
        objectiveId,
        managerScore,
      }));
      await saveCalibrations({
        managerId: currentUserId,
        cycleId,
        updates,
        updateObjective,
      });
      setDrafts({});
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container py-6 md:py-8 space-y-4 md:space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-title-2 text-ink-primary inline-flex items-center gap-2">
              <Scale className="h-6 w-6 text-[rgb(var(--brand-500))]" />
              OKR 校准 · 经理一屏
            </h1>
            <p className="mt-1 text-caption text-ink-secondary">
              {cycle?.name ?? '当前周期'} · 共 {grid.subordinateCount} 个下属 ·{' '}
              {grid.totalObjectives} 个 Objective ·
              <span className="ml-1 text-warning">{grid.pendingCount} 待校准</span>
              {grid.highDriftCount > 0 && (
                <span className="ml-2 text-danger">⚠ {grid.highDriftCount} 个高偏差需重点关注</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/okr"
              className="surface-interactive rounded-md px-3 py-2 text-caption text-ink-secondary hover:bg-surface-3"
            >
              ← 返回 OKR
            </Link>
          </div>
        </div>

        {/* 日期管理: 季度(周期) / 月度(期中检查点) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-caption">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5">
            {(['quarter', 'month'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                aria-pressed={granularity === g}
                className={cn(
                  'rounded-full px-3 py-1 font-medium transition-colors',
                  granularity === g
                    ? 'bg-white text-ink-primary shadow-soft-xs'
                    : 'text-ink-tertiary hover:text-ink-secondary',
                )}
              >
                {g === 'quarter' ? '季度' : '月度'}
              </button>
            ))}
          </div>
          <span className="text-ink-tertiary">·</span>
          {granularity === 'quarter' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-ink-tertiary">周期:</span>
              {cycles.map((c) => (
                <Link
                  key={c.id}
                  href={`/okr/calibration?cycleId=${c.id}`}
                  className={cn(
                    'surface-interactive rounded-full px-2.5 py-0.5 ring-1',
                    c.id === cycleId
                      ? 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))] ring-[rgb(var(--brand-300))]'
                      : 'bg-surface-2 text-ink-secondary ring-border hover:bg-surface-3',
                  )}
                >
                  {c.name}
                  {c.isActive && ' · 当前'}
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-ink-tertiary">月份:</span>
              {monthsInCycle.length === 0 ? (
                <span className="text-ink-tertiary">当前周期无月份范围</span>
              ) : (
                monthsInCycle.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setSelectedMonth(m.value)}
                    className={cn(
                      'surface-interactive rounded-full px-2.5 py-0.5 ring-1',
                      activeMonth === m.value
                        ? 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))] ring-[rgb(var(--brand-300))]'
                        : 'bg-surface-2 text-ink-secondary ring-border hover:bg-surface-3',
                    )}
                  >
                    {m.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {granularity === 'month' && (
          <p className="mt-1.5 text-footnote text-ink-tertiary">
            月度为期中校准检查点 (review 当月推进); 季末以「季度」做正式校准评分.
          </p>
        )}
      </header>

      {/* 空态 */}
      {grid.subordinateCount === 0 && (
        <div className="card-elevated p-12 text-center space-y-3">
          <Users className="mx-auto h-10 w-10 text-ink-tertiary" />
          <div className="text-headline text-ink-primary">没有下属在该周期</div>
          <p className="text-caption text-ink-secondary max-w-md mx-auto">
            校准的前提是: 你是某员工的 1on1 manager. 去{' '}
            <Link href="/1on1" className="text-[rgb(var(--brand-600))] underline">
              /1on1
            </Link>{' '}
            建立 manager-report 关系, 系统会自动识别你的下属.
          </p>
        </div>
      )}

      {/* 主 grid */}
      {grid.subordinateCount > 0 && grid.totalObjectives === 0 && (
        <div className="card-elevated p-12 text-center text-ink-tertiary">
          {grid.subordinateCount} 个下属在 {cycle?.name ?? '本周期'} 还没有 Objective.
        </div>
      )}

      {grid.subordinateCount > 0 && grid.totalObjectives > 0 && (
        <>
          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-2 card-elevated p-3">
            <div className="flex items-center gap-2 text-caption text-ink-secondary">
              <Info className="h-3.5 w-3.5 text-ink-tertiary" />
              <span>评分范围 0.0-1.0 · 0.7 = 健康. 推荐分基于自评 + KR 实际进度.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fillAllRecommended}
                className="surface-interactive rounded-md px-3 py-1.5 text-caption text-ink-secondary ring-1 ring-border hover:bg-surface-3"
              >
                一键填充推荐
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={dirtyCount === 0}
                className="surface-interactive rounded-md px-3 py-1.5 text-caption text-ink-secondary hover:bg-surface-3 disabled:opacity-40"
              >
                <RotateCcw className="inline h-3 w-3 mr-1" /> 撤销修改
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || dirtyCount === 0}
                className={cn(
                  'surface-interactive rounded-md px-4 py-1.5 text-caption font-medium',
                  'bg-[rgb(var(--brand-500))] text-white hover:bg-[rgb(var(--brand-600))]',
                  'disabled:opacity-40',
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="inline h-3 w-3 mr-1" />
                    保存 ({dirtyCount} 处修改)
                  </>
                )}
              </button>
            </div>
          </div>

          {savedAt && (
            <div className="text-caption text-success inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              已保存于 {new Date(savedAt).toLocaleTimeString('zh-CN')}
            </div>
          )}

          {/* Grid 表格 */}
          <div className="card-elevated overflow-x-auto">
            <table className="w-full text-caption">
              <thead className="bg-surface-2 border-b border-border">
                <tr className="text-ink-secondary">
                  <th className="text-left px-4 py-2 font-medium">下属</th>
                  <th className="text-left px-4 py-2 font-medium min-w-[200px]">Objective</th>
                  <th className="text-right px-3 py-2 font-medium tabular-nums">实际进度</th>
                  <th className="text-right px-3 py-2 font-medium tabular-nums">自评</th>
                  <th className="text-right px-3 py-2 font-medium tabular-nums">AI 推荐</th>
                  <th className="text-center px-3 py-2 font-medium">偏差</th>
                  <th className="text-right px-3 py-2 font-medium tabular-nums w-[140px]">校准分</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => {
                  const draftValue = drafts[row.objectiveId];
                  const inputValue =
                    draftValue !== undefined
                      ? draftValue
                      : row.managerScore !== null
                      ? row.managerScore
                      : null;
                  const isDirty = draftValue !== undefined;
                  const meta = DRIFT_META[row.drift];
                  return (
                    <tr
                      key={row.objectiveId}
                      className={cn(
                        'border-b border-border last:border-b-0 transition-colors',
                        row.drift === 'high' && 'bg-danger/[0.03]',
                      )}
                    >
                      <td className="px-4 py-2.5 text-ink-primary">
                        {row.ownerName ?? row.ownerId}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/okr?o=${row.objectiveId}`}
                          className="text-ink-primary hover:text-[rgb(var(--brand-600))] line-clamp-2"
                          title={row.reasoning}
                        >
                          {row.objectiveTitle}
                        </Link>
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums text-ink-secondary">
                        {(row.actualProgress * 100).toFixed(0)}%
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">
                        {row.selfScore != null ? (
                          <span className="text-ink-primary">{(row.selfScore * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-ink-tertiary">—</span>
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5 tabular-nums">
                        <button
                          type="button"
                          onClick={() => fillRecommended(row)}
                          className="text-[rgb(var(--brand-600))] hover:underline"
                          title={row.reasoning}
                        >
                          {(row.suggestedScore * 100).toFixed(0)}% <ArrowRight className="inline h-3 w-3" />
                        </button>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-footnote ring-1',
                            meta.bg,
                            meta.tone,
                          )}
                        >
                          {row.drift === 'high' && <AlertTriangle className="h-3 w-3" />}
                          {meta.label}
                          {row.driftDelta > 0 && (
                            <span className="tabular-nums">
                              {' '}
                              ({(row.driftDelta * 100).toFixed(0)}pp)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2.5">
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          value={inputValue ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') return setDraft(row.objectiveId, null);
                            const num = parseFloat(v);
                            if (Number.isNaN(num)) return;
                            setDraft(row.objectiveId, Math.max(0, Math.min(1, num)));
                          }}
                          placeholder={
                            row.managerScore == null ? '未校准' : (row.managerScore * 100).toFixed(0) + '%'
                          }
                          className={cn(
                            'w-20 rounded-md border bg-surface-1 px-2 py-1 text-right tabular-nums outline-none focus:border-[rgb(var(--brand-500))] focus:ring-2 focus:ring-[rgb(var(--brand-500))/0.2]',
                            isDirty ? 'border-warning' : 'border-border',
                          )}
                          aria-label={`${row.ownerName ?? row.ownerId} - ${row.objectiveTitle} 校准分`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 法律小字 */}
          <p className="text-footnote text-ink-tertiary">
            校准分写入 <code>Objective.managerScore</code> + <code>reviewedAt</code>,
            走 audit 留痕. KPI/TTI 双轨独立, 校准分不直接挂奖金 (见{' '}
            <Link href="/admin/kpi/health-dashboard" className="underline">
              KPI 健康度
            </Link>
            ).
          </p>
        </>
      )}
    </div>
  );
}
