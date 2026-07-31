/**
 * Memory Retriever · 知识检索
 *
 * V1: 简单文本相似 (无 embedding 依赖, 可立即跑)
 * V2+: pgvector + 多模型 embedding (DeepSeek-Embed / BGE / Qwen-Embed)
 *
 * 实现 DecisionEngine 的 MemoryRetriever 接口.
 */

import type { MemoryRetriever, MemorySearchResult } from '../convergence/decision-engine';
import { getStore } from '../storage/repository';
import type { MemoryEntry, Material } from '../types/memory';
import { embed, cosineSim, isEmbeddingConfigured } from '../infra/embedding';
import { searchEmbeddings } from '../infra/vector-store';
import { expandNeighbors } from './graph';
import { reciprocalRankFusion, type RetrievalHit } from './agentic-retrieval';

/** 性能护栏: 单次最多对多少条候选做向量计算 (其余走 Jaccard 兜底) */
const SEMANTIC_EVAL_CAP = 80;
/** 语义命中阈值 (cosine) */
const SEMANTIC_MIN_SIM = 0.15;

// ---------------------------------------------------------------------------
// Tokenization (中英文混合简单分词)
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  // 中文按字, 英文/数字按词
  const tokens: string[] = [];
  const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push((m[1] ?? m[2]).toLowerCase());
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// 相似度算法 (Jaccard + TF 加权)
// ---------------------------------------------------------------------------

function similarity(query: string, doc: string): number {
  const q = new Set(tokenize(query));
  const d = tokenize(doc);
  if (q.size === 0 || d.length === 0) return 0;

  // 计算 query 中有多少 token 出现在 doc, 加权 doc 长度归一
  let hits = 0;
  for (const tok of d) {
    if (q.has(tok)) hits++;
  }
  const docTokens = new Set(d);
  const qArr = Array.from(q);
  const intersection = qArr.filter((t) => docTokens.has(t)).length;
  const union = new Set(qArr.concat(Array.from(docTokens))).size;
  const jaccard = intersection / union;
  const tf = hits / d.length;

  // 平滑加权
  return Math.min(1, jaccard * 0.6 + tf * 4);
}

// ---------------------------------------------------------------------------
// Store-backed retriever (V1)
// ---------------------------------------------------------------------------

export class StoreBackedMemoryRetriever implements MemoryRetriever {
  async findRelatedSOP(query: string, limit: number): Promise<MemorySearchResult[]> {
    // P1 下推: 走 KvStore_memory_type/status partial 索引 (0007), 避免 加载全集+JS 过滤.
    const store = getStore();
    const sops = await store.memories.list({ type: 'sop', status: 'active' } as Partial<MemoryEntry>);
    return rankSemantic(sops, query, limit);
  }

  async findHistoricalCases(query: string, limit: number): Promise<MemorySearchResult[]> {
    const store = getStore();
    const cases = await store.memories.list({ type: 'case', status: 'active' } as Partial<MemoryEntry>);
    return rankSemantic(cases, query, limit);
  }
}

/**
 * 语义检索 + 引用加权排序. 优先 embedding cosine, 任一环节不可用则无损回退 Jaccard.
 * 飞轮: 被引用越多的 SOP/案例 (referenceCount) 略微上浮, 让验证过的经验优先。
 */
async function rankSemantic(
  entries: MemoryEntry[],
  query: string,
  limit: number,
): Promise<MemorySearchResult[]> {
  if (entries.length === 0) return [];

  // 0) pgvector ANN 统一检索层 (A3). 未启用返回 null → 落下方内存 cosine / Jaccard。
  //    安全: 结果与传入 entries 求交, 保住调用方的可见性/类型过滤; 命中不足则回退。
  try {
    const tenantId = (entries[0] as { orgId?: string }).orgId ?? 'default';
    const hits = await searchEmbeddings({
      queryText: query,
      tenantId,
      entityType: 'memory',
      topK: Math.max(limit * 4, 20),
      minSim: SEMANTIC_MIN_SIM,
    });
    if (hits) {
      const inSet = new Map(entries.map((e) => [e.id, e]));
      const ranked = hits
        .map((h) => {
          const e = inSet.get(h.entityId);
          return e ? { id: e.id, title: e.title, body: e.body, similarity: applyRefBoost(h.sim, e) } : null;
        })
        .filter((x): x is MemorySearchResult => !!x)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      if (ranked.length > 0) return ranked;
    }
  } catch {
    // 向量层异常 → 落内存 cosine / Jaccard
  }

  if (await isEmbeddingConfigured()) {
    try {
      const qv = await embed(query);
      if (qv) {
        // 优先最近更新的候选做向量计算, 控制 N+1 成本
        const cap = [...entries]
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
          .slice(0, SEMANTIC_EVAL_CAP);
        const scored = await Promise.all(
          cap.map(async (e) => {
            let v = e.embedding;
            if (!v || v.length === 0) v = (await embed(`${e.title}\n${e.body}`)) ?? undefined;
            const sim = v ? cosineSim(qv, v) : 0;
            return { e, sim };
          }),
        );
        const ranked = scored
          .map(({ e, sim }) => ({
            id: e.id,
            title: e.title,
            body: e.body,
            similarity: applyRefBoost(sim, e),
          }))
          .filter((s) => s.similarity >= SEMANTIC_MIN_SIM)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
        if (ranked.length > 0) return ranked;
        // 语义零命中 → 落 Jaccard 兜底 (embeddings 可能偏弱/稀疏)
      }
    } catch {
      // 向量检索失败 → 静默回退 Jaccard
    }
  }
  return rank(entries, query, limit);
}

/** 引用越多的条目略微加权 (上限 +0.1), 飞轮: 验证过的经验优先 */
function applyRefBoost(sim: number, e: MemoryEntry): number {
  const refBoost = Math.min(0.1, ((e.referenceCount ?? 0) as number) * 0.01);
  return Math.min(1, sim + refBoost);
}

function rank(entries: MemoryEntry[], query: string, limit: number): MemorySearchResult[] {
  const scored = entries.map((e) => ({
    id: e.id,
    title: e.title,
    body: e.body,
    similarity: Math.max(
      similarity(query, e.title) * 1.5,
      similarity(query, e.body)
    ),
  }));
  return scored
    .filter((s) => s.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Composite retriever (材料 + 记忆混合, V2 升级)
// ---------------------------------------------------------------------------

export interface MaterialMatch extends MemorySearchResult {
  source: 'material';
}
export interface MemoryMatch extends MemorySearchResult {
  source: 'memory';
}

export interface CompositeSearchOptions {
  /**
   * §GraphRAG M1 (执行链 C · 2026-07-13): 对命中的组织级记忆做 1 跳确定性图谱扩展,
   * 补入关系相关记忆 (supersedes 链 / 同 KR-OKR-决议实体 / 共标签)。默认 false,
   * 保持既有调用方行为不变; 中央 AI / 分身的 memory.search 工具开启以获得关系型召回。
   */
  expandGraph?: boolean;
}

export class CompositeRetriever {
  async search(
    query: string,
    limit = 5,
    opts: CompositeSearchOptions = {},
  ): Promise<(MaterialMatch | MemoryMatch)[]> {
    const store = getStore();
    const [materials, memories] = await Promise.all([
      store.materials.list(),
      store.memories.list(),
    ]);

    const matMatches = materials.map((m: Material) => ({
      id: m.id,
      title: m.title,
      body: serializeBody(m.body),
      similarity:
        Math.max(similarity(query, m.title) * 1.5, similarity(query, serializeBody(m.body))) * 0.85,
      source: 'material' as const,
    }));

    // 防火墙 (Owner 2026-07-12): memory.search = "公司知识库", 只返回【已签批的组织级】记忆。
    // 个人非审批记事本 (ownershipLevel='personal') 不属于公司知识库, 排除以防个人成长咨询
    // 经中央 AI 感知/推理 pass 污染 OKR/议事等决策依赖。
    const memMatches = memories
      .filter((m: MemoryEntry) => m.status === 'active' && m.ownershipLevel !== 'personal')
      .map((m: MemoryEntry) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        similarity: Math.max(similarity(query, m.title) * 1.5, similarity(query, m.body)),
        source: 'memory' as const,
      }));

    // 词面 (Jaccard) 全量排序 (先不截断, 供混合融合)
    const lexicalRanked = [...matMatches, ...memMatches]
      .filter((s) => s.similarity > 0.05)
      .sort((a, b) => b.similarity - a.similarity);

    // §Agentic RAG 混合检索 (P1): embedding 已配置时, 语义召回与词面用 RRF 融合排序,
    //   兼顾"语义相近但用词不同"与"关键词精确命中"。未配置 embedding → 与既有行为完全一致 (纯 Jaccard)。
    let base: (MaterialMatch | MemoryMatch)[];
    let embConfigured = false;
    try {
      embConfigured = await isEmbeddingConfigured();
    } catch {
      embConfigured = false;
    }
    if (embConfigured) {
      const semanticRanked = await this.semanticRank(query, materials, memories);
      base =
        semanticRanked && semanticRanked.length > 0
          ? (reciprocalRankFusion([lexicalRanked, semanticRanked], { limit }) as (
              | MaterialMatch
              | MemoryMatch
            )[])
          : lexicalRanked.slice(0, limit);
    } else {
      base = lexicalRanked.slice(0, limit);
    }

    if (!opts.expandGraph) return base;

    // §GraphRAG 1 跳扩展: 用命中的 memory 作种子拉关系相关记忆, 邻居分 = 种子分 × 边权 × 0.5。
    const seedIds = base.filter((b) => b.source === 'memory').map((b) => b.id);
    if (seedIds.length === 0) return base;
    const neighbors = expandNeighbors(seedIds, memories, { maxNeighbors: limit });
    const seenIds = new Set(base.map((b) => b.id));
    const seedScoreById = new Map(base.map((b) => [b.id, b.similarity]));
    const expanded: MemoryMatch[] = [];
    for (const nb of neighbors) {
      if (seenIds.has(nb.memory.id)) continue;
      const seedScore = seedScoreById.get(nb.viaSeedId) ?? 0.3;
      expanded.push({
        id: nb.memory.id,
        title: nb.memory.title,
        body: nb.memory.body,
        similarity: seedScore * nb.weight * 0.5,
        source: 'memory' as const,
      });
      seenIds.add(nb.memory.id);
    }
    return [...base, ...expanded].sort((a, b) => b.similarity - a.similarity).slice(0, limit * 2);
  }

  /**
   * §Agentic RAG (P1) · 语义召回一路 (供与词面 RRF 融合)。
   * 仅在 embedding 已配置时被调用。对 materials + 已签批组织记忆做向量 cosine 排序,
   * 复用防火墙 (排除 personal/非 active) 与 material 0.85 折扣。N+1 成本受 SEMANTIC_EVAL_CAP 限。
   * 任一环节失败 → 返回 null, 调用方落纯词面 (fail-soft)。
   */
  private async semanticRank(
    query: string,
    materials: Material[],
    memories: MemoryEntry[],
  ): Promise<RetrievalHit[] | null> {
    try {
      const qv = await embed(query);
      if (!qv) return null;

      const candidates: Array<{
        id: string;
        title: string;
        body: string;
        source: 'material' | 'memory';
        discount: number;
        embedding?: number[];
        updatedAt?: string;
      }> = [
        ...materials.map((m) => ({
          id: m.id,
          title: m.title,
          body: serializeBody(m.body),
          source: 'material' as const,
          discount: 0.85,
          updatedAt: (m as { updatedAt?: string }).updatedAt,
        })),
        ...memories
          .filter((m) => m.status === 'active' && m.ownershipLevel !== 'personal')
          .map((m) => ({
            id: m.id,
            title: m.title,
            body: m.body,
            source: 'memory' as const,
            discount: 1,
            embedding: m.embedding,
            updatedAt: m.updatedAt,
          })),
      ];
      if (candidates.length === 0) return null;

      const capped = [...candidates]
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
        .slice(0, SEMANTIC_EVAL_CAP);

      const scored = await Promise.all(
        capped.map(async (c) => {
          let v = c.embedding;
          if (!v || v.length === 0) v = (await embed(`${c.title}\n${c.body}`)) ?? undefined;
          const sim = v ? cosineSim(qv, v) * c.discount : 0;
          return { c, sim };
        }),
      );

      const ranked = scored
        .filter((s) => s.sim >= SEMANTIC_MIN_SIM)
        .sort((a, b) => b.sim - a.sim)
        .map(({ c, sim }) => ({
          id: c.id,
          title: c.title,
          body: c.body,
          similarity: sim,
          source: c.source,
        })) as RetrievalHit[];

      return ranked.length > 0 ? ranked : null;
    } catch {
      return null;
    }
  }
}

function serializeBody(body: unknown): string {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}
