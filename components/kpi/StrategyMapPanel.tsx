'use client';

/**
 * BSC 战略地图面板 (B-019)
 *
 * 显示位置: `/admin/kpi/setup` BSC 配比面板下方.
 * 数据来源: GET /api/kpi/causal-links?cycleId=...&map=1 (战略地图组装)
 *
 * 三块:
 *   1. 四维泳道 (财务在上 → 学习成长在下, Kaplan/Norton 战略地图惯例)
 *      每条泳道列出本维度 KPI 节点 chip.
 *   2. 因果链列表 (from → to, 强度条, 验证态, 方向合法标记) + 删除/验证.
 *   3. 新建因果链 inline 表单 (选 from/to + 强度 + 假设).
 *
 * 设计宪章 (memory#87c1d51d):
 *   - surface-card-soft / rounded-2xl / shadow-soft-sm
 *   - 维度色一律走 BSC_PERSPECTIVE token, 状态色走 HEALTH token
 *   - 字体 .text-title-3/.text-headline/.text-body/.text-caption/.text-footnote
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BSC_PERSPECTIVE, HEALTH, type BscPerspective } from '@/lib/design-tokens';
import { BSC_PERSPECTIVES } from '@/lib/kpi/bsc-validation';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

// 与 lib/kpi/causal-links.ts 的 StrategyMap 结构对齐 (避免 server-only import)
interface MapNode {
  kpiId: string;
  title: string;
  perspective?: BscPerspective;
  scope: 'bonus' | 'monitor';
  weight: number;
}
interface MapEdge {
  id: string;
  fromKpiId: string;
  toKpiId: string;
  strength: number;
  hypothesis?: string;
  validated: boolean;
  directionValid: boolean;
}
interface StrategyMap {
  cycleId: string;
  lanes: { perspective: BscPerspective; label: string; nodes: MapNode[] }[];
  unclassified: MapNode[];
  edges: MapEdge[];
}

interface Props {
  cycleId: string;
  /** 周期 closed 时进入只读模式 (不可增删, 仅验证回顾) */
  readOnly?: boolean;
  className?: string;
}

// 战略地图视觉顺序: 财务在顶 → 成长在底 (因果向上传导)
const LANE_ORDER: readonly BscPerspective[] = [...BSC_PERSPECTIVES].reverse() as BscPerspective[];

export function StrategyMapPanel({ cycleId, readOnly = false, className }: Props) {
  const [map, setMap] = useState<StrategyMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kpi/causal-links?cycleId=${encodeURIComponent(cycleId)}&map=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '加载失败');
      setMap(data.map as StrategyMap);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allNodes = useMemo<MapNode[]>(() => {
    if (!map) return [];
    return [...map.lanes.flatMap((l) => l.nodes), ...map.unclassified];
  }, [map]);

  const titleOf = useCallback(
    (kpiId: string) => allNodes.find((n) => n.kpiId === kpiId)?.title ?? kpiId,
    [allNodes],
  );
  const perspectiveOf = useCallback(
    (kpiId: string) => allNodes.find((n) => n.kpiId === kpiId)?.perspective,
    [allNodes],
  );

  async function handleDelete(id: string) {
    const res = await fetch(`/api/kpi/causal-links/${id}`, { method: 'DELETE' });
    if (res.ok) void load();
  }

  async function handleValidate(id: string, validated: boolean) {
    const res = await fetch(`/api/kpi/causal-links/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ validate: validated }),
    });
    if (res.ok) void load();
  }

  return (
    <section
      className={`surface-card-soft rounded-2xl shadow-soft-sm p-5 space-y-4 ${className ?? ''}`}
      aria-label="BSC 战略地图"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-title-3 text-primary">BSC 战略地图 · 因果链</h3>
          <p className="text-caption text-secondary">
            学习成长 → 内部流程 → 客户 → 财务 · 自下而上的战略假设链 · DAG (无环)
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="surface-interactive inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption text-primary"
          >
            {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {adding ? '取消' : '新建因果链'}
          </button>
        )}
      </header>

      {error && (
        <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-caption ${HEALTH.red.badge}`}>
          <TriangleAlert className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && <p className="text-caption text-tertiary">加载中…</p>}

      {!loading && map && (
        <>
          {/* 新建表单 */}
          {adding && !readOnly && (
            <AddLinkForm
              cycleId={cycleId}
              nodes={allNodes}
              onCreated={() => {
                setAdding(false);
                void load();
              }}
            />
          )}

          {/* 四维泳道 */}
          <div className="space-y-2">
            {LANE_ORDER.map((p) => {
              const lane = map.lanes.find((l) => l.perspective === p);
              const meta = BSC_PERSPECTIVE[p];
              return (
                <div
                  key={p}
                  className={`rounded-2xl border ${meta.border} ${meta.bg} px-3 py-2.5`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span aria-hidden className="text-body leading-none">
                      {meta.emoji}
                    </span>
                    <span className={`text-caption font-medium ${meta.text}`}>{meta.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lane && lane.nodes.length > 0 ? (
                      lane.nodes.map((n) => <NodeChip key={n.kpiId} node={n} />)
                    ) : (
                      <span className="text-footnote text-tertiary">该维度暂无 KPI</span>
                    )}
                  </div>
                </div>
              );
            })}
            {map.unclassified.length > 0 && (
              <div className="rounded-2xl border surface-2 px-3 py-2.5">
                <div className="text-caption text-tertiary mb-1.5">未分类 (缺 BSC 维度)</div>
                <div className="flex flex-wrap gap-1.5">
                  {map.unclassified.map((n) => (
                    <NodeChip key={n.kpiId} node={n} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 因果链列表 */}
          <div className="space-y-1.5 pt-1">
            <div className="text-caption text-secondary">
              因果假设 ({map.edges.length})
            </div>
            {map.edges.length === 0 ? (
              <p className="text-footnote text-tertiary">
                尚无因果链 · 战略地图需要明确&ldquo;做好 A 会带来 B&rdquo;的跨维度假设
              </p>
            ) : (
              <ul className="space-y-1.5">
                {map.edges.map((e) => (
                  <EdgeRow
                    key={e.id}
                    edge={e}
                    fromTitle={titleOf(e.fromKpiId)}
                    toTitle={titleOf(e.toKpiId)}
                    fromPerspective={perspectiveOf(e.fromKpiId)}
                    toPerspective={perspectiveOf(e.toKpiId)}
                    readOnly={readOnly}
                    onDelete={() => handleDelete(e.id)}
                    onValidate={(v) => handleValidate(e.id, v)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub: KPI 节点 chip
// ---------------------------------------------------------------------------

function NodeChip({ node }: { node: MapNode }) {
  const meta = node.perspective ? BSC_PERSPECTIVE[node.perspective] : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-footnote ${
        meta ? meta.badge : 'surface-2 text-secondary'
      }`}
      title={`${node.title} · 权重 ${node.weight} · ${node.scope}`}
    >
      <span className="truncate max-w-[12rem]">{node.title}</span>
      {node.scope === 'monitor' && (
        <span className="text-tertiary tabular-nums">(监控)</span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub: 因果链行
// ---------------------------------------------------------------------------

function EdgeRow({
  edge,
  fromTitle,
  toTitle,
  fromPerspective,
  toPerspective,
  readOnly,
  onDelete,
  onValidate,
}: {
  edge: MapEdge;
  fromTitle: string;
  toTitle: string;
  fromPerspective?: BscPerspective;
  toPerspective?: BscPerspective;
  readOnly: boolean;
  onDelete: () => void;
  onValidate: (v: boolean) => void;
}) {
  const fromMeta = fromPerspective ? BSC_PERSPECTIVE[fromPerspective] : null;
  const toMeta = toPerspective ? BSC_PERSPECTIVE[toPerspective] : null;
  const strengthPct = Math.round(edge.strength * 100);

  return (
    <li className="rounded-2xl border surface-1 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-caption ${fromMeta ? fromMeta.text : 'text-primary'}`}>
          {fromMeta?.emoji} {fromTitle}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-tertiary flex-shrink-0" />
        <span className={`text-caption ${toMeta ? toMeta.text : 'text-primary'}`}>
          {toMeta?.emoji} {toTitle}
        </span>

        {!edge.directionValid && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-footnote ${HEALTH.amber.badge}`}>
            <TriangleAlert className="h-3 w-3" />
            反向 / 特批
          </span>
        )}
        {edge.validated ? (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-footnote ${HEALTH.green.badge}`}>
            <CheckCircle2 className="h-3 w-3" />
            已验证
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-footnote surface-2 text-tertiary">
            <CircleDot className="h-3 w-3" />
            假设
          </span>
        )}
      </div>

      {edge.hypothesis && (
        <p className="text-footnote text-secondary">{edge.hypothesis}</p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-footnote text-tertiary whitespace-nowrap">强度 {strengthPct}%</span>
          <div className="h-1.5 flex-1 rounded-full overflow-hidden surface-2" aria-hidden>
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(2, strengthPct)}%` }}
            />
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onValidate(!edge.validated)}
              className="surface-interactive rounded-full border px-2.5 py-1 text-footnote text-primary"
            >
              {edge.validated ? '撤销验证' : '标记验证'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="surface-interactive rounded-full border p-1.5 text-tertiary"
              aria-label="删除因果链"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Sub: 新建因果链表单
// ---------------------------------------------------------------------------

function AddLinkForm({
  cycleId,
  nodes,
  onCreated,
}: {
  cycleId: string;
  nodes: MapNode[];
  onCreated: () => void;
}) {
  const [fromKpiId, setFromKpiId] = useState('');
  const [toKpiId, setToKpiId] = useState('');
  const [strength, setStrength] = useState(0.5);
  const [hypothesis, setHypothesis] = useState('');
  const [allowAnyDirection, setAllowAny] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!fromKpiId || !toKpiId) {
      setErr('请选择 from 和 to KPI');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/kpi/causal-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cycleId, fromKpiId, toKpiId, strength, hypothesis, allowAnyDirection }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || '创建失败');
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border surface-1 p-3 space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <label className="space-y-1">
          <span className="text-footnote text-secondary">驱动因 (from)</span>
          <select
            value={fromKpiId}
            onChange={(e) => setFromKpiId(e.target.value)}
            className="w-full rounded-2xl border surface-2 px-2.5 py-1.5 text-caption text-primary"
          >
            <option value="">选择 KPI…</option>
            {nodes.map((n) => (
              <option key={n.kpiId} value={n.kpiId}>
                {n.perspective ? `${BSC_PERSPECTIVE[n.perspective].label} · ` : ''}
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-footnote text-secondary">结果果 (to)</span>
          <select
            value={toKpiId}
            onChange={(e) => setToKpiId(e.target.value)}
            className="w-full rounded-2xl border surface-2 px-2.5 py-1.5 text-caption text-primary"
          >
            <option value="">选择 KPI…</option>
            {nodes.map((n) => (
              <option key={n.kpiId} value={n.kpiId}>
                {n.perspective ? `${BSC_PERSPECTIVE[n.perspective].label} · ` : ''}
                {n.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-footnote text-secondary">
          因果强度 {Math.round(strength * 100)}%
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
          className="w-full accent-brand-500"
        />
      </label>

      <label className="space-y-1 block">
        <span className="text-footnote text-secondary">假设描述 (可选)</span>
        <input
          type="text"
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="e.g. 技能提升 → 交付效率提升 → NPS 上升"
          className="w-full rounded-2xl border surface-2 px-2.5 py-1.5 text-caption text-primary"
        />
      </label>

      <label className="flex items-center gap-2 text-footnote text-secondary">
        <input
          type="checkbox"
          checked={allowAnyDirection}
          onChange={(e) => setAllowAny(e.target.checked)}
          className="accent-brand-500"
        />
        允许反向 / 跨维度 (议事室特批语义)
      </label>

      {err && (
        <p className={`rounded-2xl border px-2.5 py-1.5 text-footnote ${HEALTH.red.badge}`}>{err}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rheem-btn-pill text-caption disabled:opacity-50"
        >
          {submitting ? '创建中…' : '创建因果链'}
        </button>
      </div>
    </div>
  );
}
