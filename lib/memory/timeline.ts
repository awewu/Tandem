/**
 * lib/memory/timeline.ts · 记忆时间/因果链 (MAGMA-lite · Phase 4 深化)
 * ─────────────────────────────────────────────────────────
 * MAGMA 四图记忆 = 语义 + 实体 + 时间 + 因果。现有 lib/memory/graph.ts (GraphRAG M1)
 * 已覆盖**关联轴** (entity/tag/cocited/supersedes), 但那是"谁和谁相关"的平面关系,
 * 答不了"围绕某实体, 事情按时间怎么演进、哪一步导致下一步" (时间/因果轴)。
 *
 * 本片从**既有确定性信号**构建某实体 (KR/OKR/决议…) 的时间线 + 因果链, 无 LLM、无新 DDL:
 *   - temporal_next : 按 createdAt 排序的相邻事件 (时间主干 · "然后")
 *   - supersedes    : 版本取代链 (旧 → 新, 最强因果 · "被替代")
 *   - same_session  : 同一会话 (议事/1on1/BossAI) 产出的记忆 (共因推理 · 弱因果)
 *
 * 用途: ① 中央 AI 回答"这个 KR/决议一路怎么演进的"; ② A3 故事链 provenance 可视化后端。
 * 决策防火墙 (Owner 2026-07-12): 默认排除 ownershipLevel='personal' 非审批记忆。
 * 不变量: 纯函数, 无 IO, 确定性 (稳定排序), 永不抛。
 *
 * 升级路径: LLM 抽取 supports/conflicts/causes 类型化因果 + 冲突检测 (与 graph.ts M2 合流)。
 */

import type { MemoryEntry } from '../types/memory';
import { extractEntityIds } from './reranker';

export type CausalEdgeKind = 'temporal_next' | 'supersedes' | 'same_session';

/** 因果/时间边强度: 版本取代 > 时间相邻 > 同会话 */
export const CAUSAL_EDGE_WEIGHT: Record<CausalEdgeKind, number> = {
  supersedes: 1.0,
  temporal_next: 0.5,
  same_session: 0.4,
};

export interface TimelineEvent {
  memory: MemoryEntry;
  /** createdAt 原样 (ISO) */
  at: string;
  /** 解析后的毫秒时间戳 (无法解析 → 0) */
  ts: number;
  /** 0 起的时间序 */
  order: number;
}

export interface CausalLink {
  fromId: string;
  toId: string;
  kind: CausalEdgeKind;
  weight: number;
}

export interface MemoryTimeline {
  entityId: string;
  events: TimelineEvent[];
  causalLinks: CausalLink[];
}

export interface BuildTimelineOptions {
  /** 最多纳入多少事件 (取时间最近的 N 条; 默认 50) */
  maxEvents?: number;
  /** 决策防火墙: 排除个人非审批记忆 (默认 true) */
  excludePersonalUnapproved?: boolean;
  /** 仅限某租户/组织 (给定则按 orgId 过滤) */
  orgId?: string;
}

function parseTs(s?: string): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** 某记忆是否触及目标实体 (标题/正文出现该 ID)。 */
function touchesEntity(m: MemoryEntry, entityIdLc: string): boolean {
  return extractEntityIds(`${m.title} ${m.body ?? ''}`).includes(entityIdLc);
}

/**
 * 构建某实体的时间/因果链 (确定性)。
 * 事件按 createdAt 升序; 因果边 = 版本取代 + 时间相邻主干 + 同会话共因。
 */
export function buildEntityTimeline(
  entityId: string,
  allMemories: MemoryEntry[],
  opts: BuildTimelineOptions = {},
): MemoryTimeline {
  const target = (entityId ?? '').trim().toLowerCase();
  if (!target) return { entityId, events: [], causalLinks: [] };

  const excludePersonal = opts.excludePersonalUnapproved ?? true;
  const maxEvents = opts.maxEvents ?? 50;

  // 1) 筛选触及实体的活跃记忆 (含防火墙 + 租户过滤)
  const matched = allMemories.filter((m) => {
    if (m.status !== 'active') return false;
    if (excludePersonal && m.ownershipLevel === 'personal') return false;
    if (opts.orgId && (m.orgId ?? 'default') !== opts.orgId) return false;
    return touchesEntity(m, target);
  });

  // 2) 时间升序 (稳定: 时间相同按 id), 取最近 maxEvents 后再回到时间序
  const sortedDesc = [...matched].sort(
    (a, b) => parseTs(b.createdAt) - parseTs(a.createdAt) || b.id.localeCompare(a.id),
  );
  const kept = sortedDesc.slice(0, maxEvents);
  const events: TimelineEvent[] = kept
    .sort((a, b) => parseTs(a.createdAt) - parseTs(b.createdAt) || a.id.localeCompare(b.id))
    .map((m, i) => ({ memory: m, at: m.createdAt, ts: parseTs(m.createdAt), order: i }));

  const inSet = new Set(events.map((e) => e.memory.id));
  const links: CausalLink[] = [];
  const seen = new Set<string>();
  const addLink = (fromId: string, toId: string, kind: CausalEdgeKind): void => {
    if (fromId === toId || !inSet.has(fromId) || !inSet.has(toId)) return;
    const key = `${fromId}->${toId}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ fromId, toId, kind, weight: CAUSAL_EDGE_WEIGHT[kind] });
  };

  // 3a) 时间主干: 相邻事件 order i → i+1
  for (let i = 0; i + 1 < events.length; i++) {
    addLink(events[i].memory.id, events[i + 1].memory.id, 'temporal_next');
  }

  // 3b) 版本取代 (旧 → 新): supersededBy 指向的新版
  for (const e of events) {
    const m = e.memory;
    if (m.supersededBy) addLink(m.id, m.supersededBy, 'supersedes');
    // supersedes 指向旧版 → 反向也补一条 (旧 → 当前)
    if (m.supersedes) addLink(m.supersedes, m.id, 'supersedes');
  }

  // 3c) 同会话共因: 同 sessionId 的记忆两两 (按时间序, 前 → 后)
  const bySession = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const sid = e.memory.sessionId;
    if (!sid) continue;
    const arr = bySession.get(sid) ?? [];
    arr.push(e);
    bySession.set(sid, arr);
  }
  for (const arr of Array.from(bySession.values())) {
    if (arr.length < 2) continue;
    for (let i = 0; i + 1 < arr.length; i++) {
      addLink(arr[i].memory.id, arr[i + 1].memory.id, 'same_session');
    }
  }

  return { entityId, events, causalLinks: links };
}

/**
 * 把时间线压成紧凑文本 (供 LLM 注入 / 故事链摘要)。确定性, 无 IO。
 */
export function summarizeTimeline(tl: MemoryTimeline, opts: { maxLines?: number } = {}): string {
  if (tl.events.length === 0) return `实体 ${tl.entityId}: 暂无相关记忆事件。`;
  const maxLines = opts.maxLines ?? 20;
  const lines = tl.events.slice(0, maxLines).map((e) => {
    const day = e.at ? e.at.slice(0, 10) : '(无日期)';
    return `${e.order + 1}. [${day}] ${e.memory.title}`;
  });
  const supersedeCount = tl.causalLinks.filter((l) => l.kind === 'supersedes').length;
  const tail = supersedeCount > 0 ? `\n(含 ${supersedeCount} 处版本取代)` : '';
  return `实体 ${tl.entityId} 时间线 (${tl.events.length} 事件):\n${lines.join('\n')}${tail}`;
}
