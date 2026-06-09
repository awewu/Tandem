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
  if (isEmbeddingConfigured()) {
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

export class CompositeRetriever {
  async search(query: string, limit = 5): Promise<(MaterialMatch | MemoryMatch)[]> {
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

    const memMatches = memories
      .filter((m: MemoryEntry) => m.status === 'active')
      .map((m: MemoryEntry) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        similarity: Math.max(similarity(query, m.title) * 1.5, similarity(query, m.body)),
        source: 'memory' as const,
      }));

    return [...matMatches, ...memMatches]
      .filter((s) => s.similarity > 0.05)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
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
