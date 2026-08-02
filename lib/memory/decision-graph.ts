/**
 * lib/memory/decision-graph.ts · 决策图谱 (Context Graph · Phase 1 · 纯函数, 无 DB)
 * ─────────────────────────────────────────────────────────
 * 背景 (2026 行业共识 · Foundation Capital "Context Graph" 命题):
 *   下一代企业 AI 的底座不是模型也不是 agent 框架, 而是"决策轨迹图谱"——
 *   把"谁、在什么约束下、基于什么信息、为何做了什么决定、结果如何"缝成可搜索的先例。
 *
 * 现状: lib/memory/timeline.ts 的 MAGMA-lite 已在 MemoryEntry 上做时间/因果链, 但
 *   "决策"本身散在 DecisionCard 里, 未作为一等节点入图。本片把 DecisionCard 显式抽成
 *   决策节点 (who/what/why/constraints/when/outcome), 并织成图, 支撑旗舰查询:
 *     "围绕某 KR, 我们一路是怎么决策的 / 以前遇到这种事我们怎么处理的"。
 *
 * 边类型 (决策→决策):
 *   supersedes    1.0  版本取代/复盘推翻 (最强)
 *   same_kr       0.9  锚定同一 KR 的相邻决策 (同目标演进主干)
 *   temporal_next 0.4  全局时间相邻 (弱主干)
 *
 * 不变量: 纯函数, 无 IO, 确定性 (稳定排序), 永不抛。pgvector 语义检索属 Phase 2 (需 infra 决策)。
 */

import type {
  DecisionCard,
  DecisionClass,
  ConvergenceState,
} from '@/lib/types/decision-card';

export interface DecisionNode {
  id: string;
  title: string;
  /** createdAt 原样 (ISO) */
  at: string;
  /** 毫秒时间戳 (无法解析 → 0) */
  ts: number;
  class: DecisionClass;
  state: ConvergenceState;
  /** 谁拍的板 (selectedBy 优先, 回落 createdBy) */
  decidedBy: string | null;
  /** 是否 AI 代行提交 (反欺诈水印) */
  isProxy: boolean;
  // ── why (理由/对齐) ──
  rationale: string | null;
  okrAlignment: string | null;
  driftPoint: string | null;
  // ── constraints (约束/锚点) ──
  primaryKrId: string | null;
  relatedKr: string[];
  expectedKrImpact: { kr: string; deltaPp: number }[];
  // ── provenance (信息来源) ──
  citedMemory: string[];
  // ── outcome (结果/学习, 复盘回填) ──
  outcome: string | null;
  learning: string | null;
}

export type DecisionEdgeKind = 'supersedes' | 'same_kr' | 'temporal_next';

export const DECISION_EDGE_WEIGHT: Record<DecisionEdgeKind, number> = {
  supersedes: 1.0,
  same_kr: 0.9,
  temporal_next: 0.4,
};

export interface DecisionEdge {
  fromId: string;
  toId: string;
  kind: DecisionEdgeKind;
  weight: number;
  /** 可选说明 (如 same_kr 的 KR id) */
  label?: string;
}

export interface DecisionGraph {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

export interface BuildDecisionGraphOptions {
  /** 仅纳入已承诺决议 (COMMIT); 默认 false = 纳入全部非否决态 */
  committedOnly?: boolean;
  /** 租户过滤 (给定则按 tenantId 过滤; 缺省字段视作 'default') */
  tenantId?: string;
  /** 最多纳入多少节点 (取时间最近的 N; 默认 200) */
  maxNodes?: number;
}

function parseTs(s?: string): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** 选中选项的理由 (selected option 的 reasoning / novelInsight)。 */
function selectedRationale(card: DecisionCard): string | null {
  const sel = card.selected ? card.options.find((o) => o.id === card.selected) : undefined;
  if (!sel) return null;
  return sel.novelInsight?.trim() || sel.reasoning?.trim() || null;
}

function selectedOption(card: DecisionCard) {
  return card.selected ? card.options.find((o) => o.id === card.selected) : undefined;
}

/** 把一张 DecisionCard 抽成决策节点 (纯提取, 不判定可见性)。 */
export function toDecisionNode(card: DecisionCard): DecisionNode {
  const sel = selectedOption(card);
  const relatedKr = Array.isArray(card.relatedKr) ? card.relatedKr.filter(Boolean) : [];
  return {
    id: card.id,
    title: card.title,
    at: card.createdAt,
    ts: parseTs(card.createdAt),
    class: card.decisionClass,
    state: card.convergenceState,
    decidedBy: card.selectedBy ?? card.createdBy ?? null,
    isProxy: card.watermark?.isProxy ?? false,
    rationale: selectedRationale(card),
    okrAlignment: sel?.okrAlignment ?? null,
    driftPoint: sel?.driftPoint ?? null,
    primaryKrId: card.primaryKrId ?? null,
    relatedKr,
    expectedKrImpact: Array.isArray(card.expectedKrImpact) ? card.expectedKrImpact : [],
    citedMemory: Array.isArray(sel?.citedMemory) ? sel!.citedMemory!.filter(Boolean) : [],
    outcome: card.retrospective?.actualOutcome?.trim() || null,
    learning: card.retrospective?.learning?.trim() || null,
  };
}

/** 一个决策节点锚定的全部 KR (primaryKrId ∪ relatedKr, 去重)。 */
export function decisionKrs(n: DecisionNode): string[] {
  const set = new Set<string>();
  if (n.primaryKrId) set.add(n.primaryKrId);
  for (const k of n.relatedKr) set.add(k);
  return Array.from(set);
}

/**
 * 从 DecisionCard[] 构建决策图谱 (确定性)。
 * 节点按时间升序; 边 = same_kr 相邻主干 + 全局 temporal_next。
 */
export function buildDecisionGraph(
  cards: DecisionCard[],
  opts: BuildDecisionGraphOptions = {},
): DecisionGraph {
  const committedOnly = opts.committedOnly ?? false;
  const maxNodes = opts.maxNodes ?? 200;

  // 1) 过滤: 排除已否决; 可选仅 COMMIT; 租户过滤
  const matched = cards.filter((c) => {
    if (c.convergenceState === 'VETOED') return false;
    if (committedOnly && c.convergenceState !== 'COMMIT') return false;
    if (opts.tenantId && (c.tenantId ?? 'default') !== opts.tenantId) return false;
    return true;
  });

  // 2) 取时间最近 maxNodes, 回到时间升序 (稳定: 同时间按 id)
  const kept = [...matched]
    .sort((a, b) => parseTs(b.createdAt) - parseTs(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, maxNodes)
    .sort((a, b) => parseTs(a.createdAt) - parseTs(b.createdAt) || a.id.localeCompare(b.id));

  const nodes = kept.map(toDecisionNode);
  const inSet = new Set(nodes.map((n) => n.id));

  const edges: DecisionEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (fromId: string, toId: string, kind: DecisionEdgeKind, label?: string): void => {
    if (fromId === toId || !inSet.has(fromId) || !inSet.has(toId)) return;
    const key = `${fromId}->${toId}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ fromId, toId, kind, weight: DECISION_EDGE_WEIGHT[kind], label });
  };

  // 3a) 全局时间主干: 相邻节点 i → i+1
  for (let i = 0; i + 1 < nodes.length; i++) {
    addEdge(nodes[i].id, nodes[i + 1].id, 'temporal_next');
  }

  // 3b) same_kr 主干: 每个 KR 下按时间序相邻决策 (同目标演进链)
  const byKr = new Map<string, DecisionNode[]>();
  for (const n of nodes) {
    for (const kr of decisionKrs(n)) {
      const arr = byKr.get(kr) ?? [];
      arr.push(n);
      byKr.set(kr, arr);
    }
  }
  for (const [kr, arr] of Array.from(byKr.entries())) {
    if (arr.length < 2) continue;
    // arr 已随 nodes 的时间升序 (push 顺序即时间序)
    for (let i = 0; i + 1 < arr.length; i++) {
      addEdge(arr[i].id, arr[i + 1].id, 'same_kr', kr);
    }
  }

  return { nodes, edges };
}

/**
 * 旗舰查询: 围绕某 KR 的决策先例链 (时间升序)。
 * 回答"以前围绕这个目标我们是怎么决策的 / 结果如何"。
 */
export function buildKrDecisionTrail(
  krId: string,
  cards: DecisionCard[],
  opts: BuildDecisionGraphOptions = {},
): DecisionGraph {
  const target = (krId ?? '').trim();
  if (!target) return { nodes: [], edges: [] };
  const full = buildDecisionGraph(cards, opts);
  const nodes = full.nodes.filter((n) => decisionKrs(n).includes(target));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = full.edges.filter(
    (e) => ids.has(e.fromId) && ids.has(e.toId) && (e.kind !== 'same_kr' || e.label === target),
  );
  return { nodes, edges };
}
