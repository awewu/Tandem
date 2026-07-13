/**
 * Memory Graph · 确定性记忆图谱 (GraphRAG M1, 执行链 C · 2026-07-13)
 *
 * 对标 Glean permission-aware 知识图谱 (AI-RADAR 2026-07 · 行业优点 #2)。
 * 缺口: 现有 memory.search 是平面相似度 (Jaccard/embedding + rerank), 答不了关系型问题
 * ("这条决议牵动哪些 KR / 相关 Memory")。M1 从**既有信号** on-the-fly 构图, 无 LLM、无新 DDL:
 *   - supersedes 链   (MemoryEntry.supersedes / supersededBy) · 最强边
 *   - co-citation     (同一 DecisionCard 引用的 Memory) · 可选注入
 *   - entity 重叠     (共享 KR/OKR/决议 等 ID, 复用 reranker.extractEntityIds) 
 *   - tag 重叠        (共享标签) · 最弱边
 *
 * 决策防火墙 (Owner 2026-07-12) 保持: 默认排除 ownershipLevel='personal' 非审批记忆。
 *
 * 升级路径 (M2): LLM 抽取 conflict/causal/supports 类型化关系 + entity resolution + 冲突检测。
 */

import type { MemoryEntry } from '../types/memory';
import { extractEntityIds } from './reranker';

export type MemoryEdgeType = 'supersedes' | 'cocited' | 'entity' | 'tag';

export interface MemoryNeighbor {
  memory: MemoryEntry;
  edgeType: MemoryEdgeType;
  /** 经由哪个种子记忆连过来 */
  viaSeedId: string;
  /** 连接强度 (0-1), 用于邻居分衰减 */
  weight: number;
}

/** 边强度: 版本链 > 共引 > 同实体 > 共标签 */
const EDGE_WEIGHT: Record<MemoryEdgeType, number> = {
  supersedes: 1.0,
  cocited: 0.8,
  entity: 0.6,
  tag: 0.4,
};

interface IndexedMemory {
  m: MemoryEntry;
  entityIds: Set<string>;
  tags: Set<string>;
}

function indexMemory(m: MemoryEntry): IndexedMemory {
  return {
    m,
    entityIds: new Set(extractEntityIds(`${m.title} ${m.body ?? ''}`)),
    tags: new Set((m.tags ?? []).map((t) => t.toLowerCase())),
  };
}

export interface ExpandOptions {
  /** 最多返回多少邻居 (默认 10) */
  maxNeighbors?: number;
  /** co-citation 分组: 每组 = 同一决议引用的 memoryId 列表 (可选) */
  coCitationGroups?: string[][];
  /** 决策防火墙: 排除个人非审批记忆 (默认 true) */
  excludePersonalUnapproved?: boolean;
}

/**
 * 对种子记忆做 1 跳邻居扩展 (确定性图, 无 LLM)。
 * 返回不含种子本身的邻居, 按 weight 降序, 每个邻居去重取最强边。
 */
export function expandNeighbors(
  seedIds: string[],
  allMemories: MemoryEntry[],
  opts: ExpandOptions = {},
): MemoryNeighbor[] {
  const seedSet = new Set(seedIds);
  const maxNeighbors = opts.maxNeighbors ?? 10;
  const excludePersonal = opts.excludePersonalUnapproved ?? true;

  const byId = new Map(allMemories.map((m) => [m.id, m]));
  const indexed = allMemories.map(indexMemory);
  const seeds = indexed.filter((i) => seedSet.has(i.m.id));
  if (seeds.length === 0) return [];

  const found = new Map<string, MemoryNeighbor>();
  const consider = (mem: MemoryEntry | undefined, edgeType: MemoryEdgeType, viaSeedId: string): void => {
    if (!mem || seedSet.has(mem.id)) return;
    if (mem.status !== 'active') return;
    if (excludePersonal && mem.ownershipLevel === 'personal') return;
    const weight = EDGE_WEIGHT[edgeType];
    const prev = found.get(mem.id);
    if (!prev || weight > prev.weight) {
      found.set(mem.id, { memory: mem, edgeType, viaSeedId, weight });
    }
  };

  // co-citation 邻接: memoryId → 共引的 memoryId 集合
  const coCited = new Map<string, Set<string>>();
  if (opts.coCitationGroups) {
    for (const group of opts.coCitationGroups) {
      for (const a of group) {
        let s = coCited.get(a);
        if (!s) { s = new Set(); coCited.set(a, s); }
        for (const b of group) if (b !== a) s.add(b);
      }
    }
  }

  for (const seed of seeds) {
    const sm = seed.m;
    // ① supersedes 链 (双向)
    consider(sm.supersededBy ? byId.get(sm.supersededBy) : undefined, 'supersedes', sm.id);
    consider(sm.supersedes ? byId.get(sm.supersedes) : undefined, 'supersedes', sm.id);
    // ② co-citation
    const co = coCited.get(sm.id);
    if (co) for (const cid of Array.from(co)) consider(byId.get(cid), 'cocited', sm.id);
    // ③④ entity / tag 重叠 (扫全集; 规模化走倒排索引 M2)
    for (const cand of indexed) {
      if (cand.m.id === sm.id || seedSet.has(cand.m.id)) continue;
      let entityHit = false;
      if (seed.entityIds.size > 0 && cand.entityIds.size > 0) {
        for (const e of Array.from(seed.entityIds)) if (cand.entityIds.has(e)) { entityHit = true; break; }
      }
      if (entityHit) { consider(cand.m, 'entity', sm.id); continue; }
      if (seed.tags.size > 0 && cand.tags.size > 0) {
        for (const t of Array.from(seed.tags)) if (cand.tags.has(t)) { consider(cand.m, 'tag', sm.id); break; }
      }
    }
  }

  return Array.from(found.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxNeighbors);
}

/**
 * 按实体 ID (KR-N / OBJ-N / conv-xxx / kpi-xxx …) 找相关记忆。
 * memory.related 工具底层: 回答"这个 KR / 决议牵动哪些记忆"。
 */
export function findRelatedByEntity(
  entityId: string,
  allMemories: MemoryEntry[],
  opts: { maxResults?: number; excludePersonalUnapproved?: boolean } = {},
): MemoryEntry[] {
  const target = entityId.trim().toLowerCase();
  if (!target) return [];
  const excludePersonal = opts.excludePersonalUnapproved ?? true;
  const max = opts.maxResults ?? 10;
  const out: MemoryEntry[] = [];
  for (const m of allMemories) {
    if (m.status !== 'active') continue;
    if (excludePersonal && m.ownershipLevel === 'personal') continue;
    if (extractEntityIds(`${m.title} ${m.body ?? ''}`).includes(target)) out.push(m);
  }
  return out
    .sort((a, b) => (b.referenceCount ?? 0) - (a.referenceCount ?? 0))
    .slice(0, max);
}
