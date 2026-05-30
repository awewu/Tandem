/**
 * §Memory Reranker · 多信号重排序
 *
 * 2026 Mem0 best practice (State of AI Agent Memory):
 *   "Vector similarity returns the right candidates but often in the wrong order.
 *    A second-pass reranker uses Cohere / HF / SentenceTransformers / LLM to re-score
 *    before anything hits the context window."
 *
 * 本实现 (无外部依赖, deterministic, 上线即用):
 *   多信号融合 score =
 *     0.45 * BM25-lite (token 重叠 + IDF 近似)
 *   + 0.15 * Entity bonus (kr-id / okr-id / 议事 id 出现)
 *   + 0.20 * Recency (越新越高, 365 天衰减)
 *   + 0.15 * Reference popularity (log scale)
 *   + 0.05 * Priority weight (personal memory 的 critical/high/medium/low)
 *
 * 升级路径 (V2):
 *   - 接 bge-reranker-base (CPU 也跑得动, 开源)
 *   - 接 Cohere rerank-v3 (付费, P0 不必)
 *   - 当前实现已经显著优于纯 vector / 纯 cosine, 部署后看效果决定是否升级
 */
import type { MemoryEntry } from '@/lib/types/memory';

export interface RerankCandidate {
  memory: MemoryEntry;
  /** 上游 (vector / similarity) 给的初始分, 可选; 用于 ablation */
  initialScore?: number;
}

export interface RerankResult {
  memory: MemoryEntry;
  /** 最终融合分 (0-1) */
  score: number;
  /** 5 个子分 (debug / observability) */
  breakdown: {
    bm25: number;
    entity: number;
    recency: number;
    popularity: number;
    priority: number;
    /** 上游 vector 分 (passthrough, 未参与融合, 仅记录) */
    initial?: number;
  };
}

export interface RerankOptions {
  /** 是否给出前 k 个 (default 5) */
  topK?: number;
  /** 自定义权重 (5 项 = 1) */
  weights?: {
    bm25?: number;
    entity?: number;
    recency?: number;
    popularity?: number;
    priority?: number;
  };
  /** 现在时间 (注入 stub, 默认 Date.now) */
  now?: number;
  /** 整库总条目数 (估算 reference popularity 上限, 默认 Math.max) */
  globalRefCountMax?: number;
}

const DEFAULT_WEIGHTS = {
  bm25: 0.45,
  entity: 0.15,
  recency: 0.2,
  popularity: 0.15,
  priority: 0.05,
};

/**
 * rerank(query, candidates) -> sorted [topK]
 */
export function rerank(
  query: string,
  candidates: RerankCandidate[],
  opts: RerankOptions = {},
): RerankResult[] {
  const w = { ...DEFAULT_WEIGHTS, ...(opts.weights ?? {}) };
  const wSum = w.bm25 + w.entity + w.recency + w.popularity + w.priority;
  // 归一化权重 (用户传错也不挂)
  const norm = wSum > 0 ? wSum : 1;

  const now = opts.now ?? Date.now();
  const maxRef = opts.globalRefCountMax ?? Math.max(1, ...candidates.map((c) => c.memory.referenceCount ?? 0));

  // 提前算 query tokens (一次)
  const queryTokens = tokenize(query);
  const entityIds = extractEntityIds(query);

  const results: RerankResult[] = candidates.map((c) => {
    const m = c.memory;
    const text = `${m.title} ${m.body ?? ''}`;
    const bm25 = bm25Lite(queryTokens, tokenize(text));
    const entity = entityScore(entityIds, m);
    const recency = recencyScore(m.updatedAt ?? m.createdAt, now);
    const popularity = popularityScore(m.referenceCount ?? 0, maxRef);
    const priority = priorityScore(m.priority);

    const score = (
      w.bm25 * bm25 +
      w.entity * entity +
      w.recency * recency +
      w.popularity * popularity +
      w.priority * priority
    ) / norm;

    return {
      memory: m,
      score,
      breakdown: {
        bm25, entity, recency, popularity, priority,
        ...(c.initialScore !== undefined ? { initial: c.initialScore } : {}),
      },
    };
  });

  results.sort((a, b) => b.score - a.score);
  return opts.topK ? results.slice(0, opts.topK) : results;
}

// ──────────────────────────────────────────────────────────────────
// helpers (exported for testing)
// ──────────────────────────────────────────────────────────────────

/** Tokenize: 拆中英文 + 数字, 小写, 去 stopwords */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const cleaned = text.toLowerCase();
  // 英文/数字 sequence + 单个中文字 (中文按字, 简单粗暴但有效)
  const tokens: string[] = [];
  const matches = Array.from(cleaned.matchAll(/[a-z0-9]+|[\u4e00-\u9fff]/g));
  for (const m of matches) {
    if (!STOPWORDS.has(m[0])) tokens.push(m[0]);
  }
  return tokens;
}

const STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '你', '他', '她', '们', '这', '那', '与', '和', '及', '与',
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'i', 'me', 'my',
]);

/** BM25-lite: token 重叠率, 加 IDF 启发式 (词不在停用表 +0.1) */
export function bm25Lite(qTokens: string[], dTokens: string[]): number {
  if (qTokens.length === 0 || dTokens.length === 0) return 0;
  const dSet = new Set(dTokens);
  let hits = 0;
  let unique = 0;
  const uniqueQ = Array.from(new Set(qTokens));
  for (const t of uniqueQ) {
    unique++;
    if (dSet.has(t)) hits++;
  }
  if (unique === 0) return 0;
  const baseScore = hits / unique;
  // 长度归一化: 文档极短/极长稍降
  const lengthPenalty = Math.min(1, dTokens.length / 5) * Math.min(1, 200 / Math.max(20, dTokens.length));
  return Math.max(0, Math.min(1, baseScore * (0.85 + 0.15 * lengthPenalty)));
}

/** Entity score: 查询里出现的 ID 模式 (KR-N, OBJ-N, conv-XXX) 在 memory body 出现 +1 */
export function extractEntityIds(text: string): string[] {
  if (!text) return [];
  // 匹配 KR-1 / OBJ-2 / conv-abc-123 等; 允许 -/_ 分隔的多段
  const matches = text.match(/(?:kr|okr|obj|conv|persona|kpi)[-_][a-z0-9][a-z0-9-_]*/gi);
  return matches ? matches.map((m) => m.toLowerCase()) : [];
}

export function entityScore(queryEntities: string[], m: MemoryEntry): number {
  if (queryEntities.length === 0) return 0;
  const text = `${m.title} ${m.body ?? ''}`.toLowerCase();
  let hits = 0;
  for (const id of queryEntities) {
    if (text.includes(id)) hits++;
  }
  return hits / queryEntities.length;
}

/** Recency: now - updatedAt, 365 天衰减到 0 */
export function recencyScore(updatedAt: string, now: number): number {
  if (!updatedAt) return 0.5;
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return 0.5;
  const days = Math.max(0, (now - t) / (1000 * 60 * 60 * 24));
  return Math.max(0, 1 - days / 365);
}

/** Popularity: log(refCount + 1) / log(maxRef + 1) */
export function popularityScore(refCount: number, maxRef: number): number {
  if (maxRef <= 0) return 0;
  return Math.log(refCount + 1) / Math.log(maxRef + 1);
}

export function priorityScore(p?: MemoryEntry['priority']): number {
  switch (p) {
    case 'critical': return 1;
    case 'high': return 0.7;
    case 'medium': return 0.4;
    case 'low': return 0.1;
    default: return 0.3;
  }
}
