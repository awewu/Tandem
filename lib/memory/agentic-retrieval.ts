/**
 * lib/memory/agentic-retrieval.ts · Agentic RAG (P1)
 *
 * ─────────────────────────────────────────────────────────
 * 器官 · 检索精细化 (Agentic RAG)
 *   问题: memory.search 单发一次词面检索, 对"跨主题/多意图"的复杂问题召回不全
 *         (例: "对比 A 方案和 B 方案的风险与成本" 应分别召回 A/B 的风险 + 成本 4 类记忆)。
 *
 *   本层: 把复杂 query 分解成多个子查询 (query decomposition), 各自检索,
 *         用 Reciprocal Rank Fusion (RRF) 融合排序去重 → 召回更全、更稳。
 *
 * 设计:
 *   - RRF 是确定性纯函数, 不依赖模型, 可单测。
 *   - decomposeQuery 走 LLM, 严格 fail-soft: 简单/短问题或出错 → 返回 [] (退化为单查询)。
 *   - agenticSearch 传入 subQueries 时完全确定 (测试可绕开 LLM)。
 */

import type { MaterialMatch, MemoryMatch, CompositeRetriever, CompositeSearchOptions } from './retriever';

export type RetrievalHit = MaterialMatch | MemoryMatch;

/** RRF 融合系数 (标准取 60): 名次越靠前贡献越大, 削弱单路异常高分的主导。 */
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion · 把多路检索结果按名次融合。
 *   score(doc) = Σ_lists 1 / (k + rank_in_list)   (rank 从 1 起)
 * 同一 doc 命中多路 → 分数叠加 (被多个子查询共同召回的更可信)。
 * 保留每条命中里"相似度最高"的那份元数据。纯函数, 确定性。
 */
export function reciprocalRankFusion(
  lists: RetrievalHit[][],
  opts: { k?: number; limit?: number } = {},
): RetrievalHit[] {
  const k = opts.k ?? RRF_K;
  const scoreById = new Map<string, number>();
  const bestById = new Map<string, RetrievalHit>();

  for (const list of lists) {
    list.forEach((hit, idx) => {
      const rank = idx + 1;
      scoreById.set(hit.id, (scoreById.get(hit.id) ?? 0) + 1 / (k + rank));
      const prev = bestById.get(hit.id);
      if (!prev || hit.similarity > prev.similarity) bestById.set(hit.id, hit);
    });
  }

  const fused = Array.from(scoreById.entries())
    .map(([id, rrf]) => ({ hit: bestById.get(id)!, rrf }))
    // 稳定次序: RRF 分降序, 平分时按原相似度降序, 再按 id 保证确定性
    .sort((a, b) => b.rrf - a.rrf || b.hit.similarity - a.hit.similarity || a.hit.id.localeCompare(b.hit.id))
    .map((x) => x.hit);

  return typeof opts.limit === 'number' ? fused.slice(0, opts.limit) : fused;
}

/** 复杂/多意图问题启发式: 含对比/并列/多问号/连接词 → 值得分解。 */
const MULTI_INTENT_RE = /对比|相比|比较|\bvs\b|区别|分别|以及|还有|和.*的|、|；|;|\?.*\?|？.*？|风险.*成本|优.*缺/i;

export function shouldDecompose(query: string): boolean {
  const q = (query ?? '').trim();
  if (q.length < 12) return false;
  return MULTI_INTENT_RE.test(q) || q.length >= 40;
}

const DECOMPOSE_SYSTEM = [
  '你是检索查询分解器。把用户的复杂问题拆成 2 到 4 个相互独立、各自聚焦单一意图的检索子查询,',
  '用于并行召回知识库。子查询要短(名词短语/关键词组), 覆盖原问题的不同方面, 不要重复。',
  '严格只输出 JSON: {"subQueries":["...","..."]}。若问题本身单一、无需分解, 返回 {"subQueries":[]}。',
].join('\n');

/**
 * LLM 查询分解。fail-soft: 未 boot / 出错 / 判定不需分解 → 返回 []。
 * 返回的子查询已去空、去重、截断到 4 条。
 */
export async function decomposeQuery(
  query: string,
  opts?: { actorUserId?: string; force?: boolean },
): Promise<string[]> {
  const q = (query ?? '').trim();
  if (!q) return [];
  if (!opts?.force && !shouldDecompose(q)) return [];

  try {
    // 解析 router: 优先 globalThis.__tandem_router__ (测试/已 boot), 避免 import 整条 boot
    // 图 (重量级 · 并行单测 CPU 争用下会拖到 >5s 超时)。与 reflexion/governed-chat 同模式。
    let router: Awaited<ReturnType<typeof import('../boot')['getRouter']>>;
    const _rg = globalThis as { __tandem_router__?: typeof router };
    if (_rg.__tandem_router__) {
      router = _rg.__tandem_router__;
    } else {
      const { getRouter } = await import('../boot');
      router = getRouter();
    }
    const reply = await router.chat({
      messages: [
        { role: 'system', content: DECOMPOSE_SYSTEM },
        { role: 'user', content: q },
      ],
      scenario: 'high_frequency',
      temperature: 0.1,
      maxTokens: 200,
      metadata: { userId: opts?.actorUserId ?? 'system' },
    });
    const content = typeof reply.message.content === 'string' ? reply.message.content : '';
    return parseSubQueries(content);
  } catch {
    return [];
  }
}

export function parseSubQueries(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as { subQueries?: unknown };
    if (!Array.isArray(obj.subQueries)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of obj.subQueries) {
      if (typeof s !== 'string') continue;
      const t = s.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= 4) break;
    }
    return out;
  } catch {
    return [];
  }
}

export interface AgenticSearchOptions extends CompositeSearchOptions {
  limit?: number;
  /** 直接指定子查询 (测试/调用方已分解); 提供则跳过 LLM 分解, 完全确定。 */
  subQueries?: string[];
  /** 是否允许 LLM 分解 (subQueries 未提供时). 默认 true。 */
  decompose?: boolean;
  actorUserId?: string;
}

/**
 * Agentic 检索: [原查询 + 子查询] 各跑一次 retriever.search, RRF 融合去重。
 *   - 未分解 (子查询为空) → 退化为单次 search, 结果与直接 search 一致 (仅经 RRF 单路, 排序不变)。
 *   - 每路子查询用 ceil(limit*1.5) 深度召回, 融合后再截到 limit, 提升召回覆盖。
 * fail-soft: 单路 search 抛错不影响其它路 (计入空结果)。
 */
export async function agenticSearch(
  retriever: Pick<CompositeRetriever, 'search'>,
  query: string,
  opts: AgenticSearchOptions = {},
): Promise<RetrievalHit[]> {
  const limit = opts.limit ?? 5;
  const perQueryLimit = Math.ceil(limit * 1.5);
  const compositeOpts: CompositeSearchOptions = { expandGraph: opts.expandGraph };

  let subQueries = opts.subQueries;
  if (!subQueries) {
    subQueries = opts.decompose === false ? [] : await decomposeQuery(query, { actorUserId: opts.actorUserId });
  }

  const queries = [query, ...subQueries.filter((s) => s && s !== query)];
  const lists = await Promise.all(
    queries.map((q) =>
      retriever.search(q, perQueryLimit, compositeOpts).catch(() => [] as RetrievalHit[]),
    ),
  );

  // 单路时 RRF 保持原顺序 (rank 单调), 等价于直接 search → 向后兼容。
  return reciprocalRankFusion(lists, { limit });
}
