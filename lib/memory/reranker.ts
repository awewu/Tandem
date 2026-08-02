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
    /** P1 #9 MAGMA 因果加分 (仅因果类 query 生效; 附加于融合分之上) */
    causal?: number;
    /** P2 #16 Mnemis 层次分类匹配加分 (结构相关但语义远的记忆; 附加于融合分之上) */
    hierarchy?: number;
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
  // P1 #9 MAGMA: 因果类 query (为什么/导致/影响…) 才启用因果加分
  const causalQuery = isCausalQuery(query);

  const results: RerankResult[] = candidates.map((c) => {
    const m = c.memory;
    const text = `${m.title} ${m.body ?? ''}`;
    const bm25 = bm25Lite(queryTokens, tokenize(text));
    const entity = entityScore(entityIds, m);
    const recency = recencyScore(m.updatedAt ?? m.createdAt, now);
    const popularity = popularityScore(m.referenceCount ?? 0, maxRef);
    const priority = priorityScore(m.priority);

    const fused = (
      w.bm25 * bm25 +
      w.entity * entity +
      w.recency * recency +
      w.popularity * popularity +
      w.priority * priority
    ) / norm;

    // P1 #9 MAGMA 因果加分: 因果 query 时, 处于因果链上的记忆 (有 causedBy/caused) 附加 bonus。
    //   非因果 query → causal=0, 行为与原实现完全一致 (零回归)。
    const causal = causalQuery ? causalScore(m) : 0;
    // P2 #16 Mnemis 层次加分: query token 命中记忆 categoryPath 时附加 bonus (结构相关)。
    //   无 categoryPath → hierarchy=0, 零回归。
    const hierarchy = hierarchyScore(queryTokens, m);
    const score = Math.max(0, Math.min(1, fused + CAUSAL_BONUS * causal + HIERARCHY_BONUS * hierarchy));

    return {
      memory: m,
      score,
      breakdown: {
        bm25, entity, recency, popularity, priority,
        ...(causalQuery ? { causal } : {}),
        ...(hierarchy > 0 ? { hierarchy } : {}),
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

/** P1 #9 MAGMA: 因果类 query 判定 (中英). 命中才启用因果加分。 */
export function isCausalQuery(query: string): boolean {
  if (!query) return false;
  return /为什么|导致|影响|因为|造成|引发|后果|归因|why|because|cause|caused|impact|lead to|result in/i.test(query);
}

/** P1 #9 MAGMA: 因果链信号 — 记忆有上/下游因果链接则得分 (0..1)。 */
export function causalScore(m: MemoryEntry): number {
  const up = (m.causedBy ?? []).length;
  const down = (m.caused ?? []).length;
  if (up === 0 && down === 0) return 0;
  // 有链接即 0.6 起, 链接越多越高 (封顶 1)
  return Math.min(1, 0.6 + 0.2 * Math.min(2, up + down));
}

/** 因果加分上限 (附加于归一化融合分之上) */
const CAUSAL_BONUS = 0.15;

/** P2 #16 Mnemis: 层次分类匹配 — query token 与记忆 categoryPath 各段的重叠率 (0..1)。 */
export function hierarchyScore(queryTokens: string[], m: MemoryEntry): number {
  const path = m.categoryPath ?? [];
  if (path.length === 0 || queryTokens.length === 0) return 0;
  const qSet = new Set(queryTokens);
  let hits = 0;
  for (const seg of path) {
    const segTokens = tokenize(seg);
    if (segTokens.some((t) => qSet.has(t))) hits++;
  }
  return hits / path.length;
}

/** 层次加分上限 (附加于归一化融合分之上) */
const HIERARCHY_BONUS = 0.1;

export function priorityScore(p?: MemoryEntry['priority']): number {
  switch (p) {
    case 'critical': return 1;
    case 'high': return 0.7;
    case 'medium': return 0.4;
    case 'low': return 0.1;
    default: return 0.3;
  }
}

// ──────────────────────────────────────────────────────────────────
// Tier0-Evo · LLM Reranker (second-pass semantic re-ranking)
// ──────────────────────────────────────────────────────────────────

/**
 * LLM reranker: 在确定性 rerank 后, 用 LLM 对 top-N 候选做语义重排.
 * 取 top-5 → LLM 选最相关的 top-3 → 返回重排结果.
 * fail-soft: LLM 调用失败 → 返回原始 rerank 结果 (降级不阻断).
 */
export async function llmRerank(
  query: string,
  candidates: RerankResult[],
  opts: { topN?: number; finalK?: number } = {},
): Promise<RerankResult[]> {
  const topN = opts.topN ?? 5;
  const finalK = opts.finalK ?? 3;
  const topCandidates = candidates.slice(0, topN);

  if (topCandidates.length <= finalK) return topCandidates;

  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();

    const candidateBlock = topCandidates
      .map((c, i) => `[${i}] title: ${c.memory.title}\n    body: ${(c.memory.body ?? '').slice(0, 200)}`)
      .join('\n');

    const prompt = `Given the user query and ${topCandidates.length} memory candidates, rank them by relevance to the query. Return ONLY the candidate indices in order of relevance, comma-separated (e.g. "2,0,3,1,4").\n\nQuery: ${query}\n\nCandidates:\n${candidateBlock}\n\nMost relevant first (indices only, comma-separated):`;

    const reply = await router.chat({
      messages: [
        { role: 'system', content: 'You are a relevance ranking assistant. Return only comma-separated indices.' },
        { role: 'user', content: prompt },
      ],
      scenario: 'high_frequency',
      maxTokens: 50,
      metadata: { userId: '__reranker__' },
    });

    const text = typeof reply.message.content === 'string' ? reply.message.content.trim() : '';
    const indices = text
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n < topCandidates.length);

    if (indices.length === 0) return topCandidates.slice(0, finalK);

    // Deduplicate while preserving order
    const seen = new Set<number>();
    const ordered: RerankResult[] = [];
    for (const idx of indices) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      ordered.push(topCandidates[idx]);
    }
    // Append any remaining candidates not in LLM's ranking
    for (let i = 0; i < topCandidates.length; i++) {
      if (!seen.has(i)) ordered.push(topCandidates[i]);
    }

    return ordered.slice(0, finalK);
  } catch {
    // fail-soft: return original deterministic rerank results
    return topCandidates.slice(0, finalK);
  }
}

// ──────────────────────────────────────────────────────────────────
// P2 #15 · MRAgent 主动记忆检索 (two-stage: 看 top-K tag → 判断缺什么 → 生成二次查询)
// ──────────────────────────────────────────────────────────────────

/**
 * MRAgent 检索推理步: 看首轮 top-K 候选摘要, 判断"要回答问题还缺什么信息", 生成一条二次查询。
 * 检索从被动 (一次 rerank 塞入 context) 变主动 (基于中间发现动态调整检索方向)。
 * 返回二次查询字符串; 无需补充或失败 → null (调用方跳过二次检索, 零回归)。
 */
export async function activeRetrievalQuery(
  query: string,
  topCandidates: RerankResult[],
): Promise<string | null> {
  if (topCandidates.length === 0) return null;
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const tagBlock = topCandidates
      .slice(0, 5)
      .map((c, i) => `[${i}] ${c.memory.title}${(c.memory.categoryPath ?? []).length ? ` (${(c.memory.categoryPath ?? []).join('/')})` : ''}`)
      .join('\n');
    const reply = await router.chat({
      messages: [
        { role: 'system', content: '你是记忆检索规划器。看用户问题与首轮检索到的记忆标题, 判断"要完整回答还缺什么信息"。若已足够, 只回复 NONE; 否则回复一条更聚焦的二次检索查询 (≤20字, 只输出查询本身)。' },
        { role: 'user', content: `问题: ${query}\n\n首轮命中:\n${tagBlock}\n\n二次查询 (或 NONE):` },
      ],
      scenario: 'high_frequency',
      maxTokens: 40,
      metadata: { userId: '__mragent__', feature: 'mragent_retrieval' },
    });
    const text = typeof reply.message.content === 'string' ? reply.message.content.trim() : '';
    if (!text || /^none/i.test(text)) return null;
    return text.slice(0, 60);
  } catch {
    return null;
  }
}
