/**
 * lib/persona/company-brain-perception.ts · 中央 AI 内部感知层 (S1·CA-6/7 · 2026-06-08)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (ROADMAP §智能主轴 S1 "瞎子"):
 *   旧状态: invokeCompanyBrainReply 直接 router.chatStream, 不传 tools。
 *           中央 AI 只能凭"静态注入的公司层 Objective 文本"说话, 不能按需查
 *           全层级真实 KR 进度 / at-risk / 历史决议 → 一问执行情况就只能含糊。
 *
 *   本层: 在最终流式回答前, 跑一遍 runToolLoop "感知 pass" —— 让中央 AI 用
 *         **只读** 内部工具 (okr.health_digest / okr.read / memory.search /
 *         decision_card.list) 主动查 S0 rollup 真值, 把查到的真实数据注入
 *         systemPrompt, 再据此流式作答。"瞎子 → 能看"。
 *
 * 设计 (镜像 preSearchLayer):
 *   - 启发式 gate: 仅当问题像"要内部数据"才跑 (省 token, 闲聊不触发)。
 *   - 只读白名单: 4 个 green/proxyAllowed 工具, 不含任何写/红区动作。
 *   - 工具执行仍走 skillRegistry.execute 的治理守门 (与 runToolLoop 一致)。
 *   - fail-soft: 任何异常都返回"未感知", 绝不阻塞主回复流。
 *   - 有界: maxRounds 3 / maxTokens 600。
 */

import { COMPANY_BRAIN_USER_ID } from './company-brain';

/** 只读感知工具白名单 (全部 green · proxyAllowed · 无副作用) */
export const PERCEPTION_TOOLSET = [
  'okr.health_digest',
  'okr.business_review',
  'okr.read',
  'memory.search',
  'decision_card.list',
] as const;

export interface PerceptionResult {
  /** 是否真跑了感知 pass 且至少调到一个工具 */
  perceived: boolean;
  /** 注入用 system prompt (已追加内部真值上下文; 未感知则原样返回) */
  revisedSystemPrompt: string;
  /** 调用过的工具 (审计/调试) */
  toolInvocations: Array<{ name: string; ok: boolean }>;
  log: {
    query: string;
    triggerReason: string;
    toolCallCount: number;
    roundsExecuted: number;
    latencyMs: number;
    checkId: string;
  };
}

/**
 * 像"要查内部真实数据"的启发式关键词:
 *   OKR/进度/目标/KR/落后/at-risk/风险/健康度/决议/议事/完成率/执行情况 ...
 * 命中才跑感知 pass (避免每条闲聊都烧一次 tool-loop)。
 */
const INTERNAL_DATA_RE =
  /OKR|目标|KR\b|关键结果|进度|落后|滞后|at[ -]?risk|风险|健康度|预警|决议|议事|完成率|执行情况|落地情况|哪些目标|哪个目标|进展|周期目标|对齐/i;

export function shouldPerceive(query: string): { trigger: boolean; reason: string } {
  const q = (query ?? '').trim();
  if (!q) return { trigger: false, reason: 'empty query' };
  if (INTERNAL_DATA_RE.test(q)) {
    return { trigger: true, reason: 'internal-data keywords (OKR/进度/决议...)' };
  }
  return { trigger: false, reason: 'no internal-data keywords; static context likely sufficient' };
}

// ---------------------------------------------------------------------------
// 短 TTL 感知缓存 (UX·降重复提问延迟)
//
// 同一/相近问题在 TTL 内反复问 (例: 老板连续追问 "OKR 进度怎样" → "那 KR3 呢")
// 不该每次都重跑 ~4s 的 tool-loop。这里缓存"已查到的内部真值数据块" (dataBlock),
// 命中即拼回当前 baseSystemPrompt (base 每次不同, 故只缓存 data 后缀)。
//   - TTL 默认 45s: 足够覆盖一次连续追问会话, 又不至于让 S0 rollup 真值过期。
//   - 仅缓存成功感知 (至少 1 个工具结果); 失败/空不缓存。
//   - LRU 上限 50 条, 防无界增长。
// ---------------------------------------------------------------------------

const PERCEPTION_CACHE_TTL_MS = 45_000;
const PERCEPTION_CACHE_MAX = 50;

interface PerceptionCacheEntry {
  dataBlock: string;
  toolInvocations: Array<{ name: string; ok: boolean }>;
  toolCallCount: number;
  roundsExecuted: number;
  expiresAt: number;
}

const _perceptionCache = new Map<string, PerceptionCacheEntry>();

/** 归一化 query 作为缓存 key (trim + 小写 + 折叠空白)。 */
function perceptionCacheKey(query: string): string {
  return (query ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCachedPerception(key: string): PerceptionCacheEntry | null {
  const hit = _perceptionCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    _perceptionCache.delete(key);
    return null;
  }
  // LRU touch: 重新插入到队尾
  _perceptionCache.delete(key);
  _perceptionCache.set(key, hit);
  return hit;
}

function setCachedPerception(key: string, entry: PerceptionCacheEntry): void {
  _perceptionCache.set(key, entry);
  while (_perceptionCache.size > PERCEPTION_CACHE_MAX) {
    const oldest = _perceptionCache.keys().next().value;
    if (oldest === undefined) break;
    _perceptionCache.delete(oldest);
  }
}

/** 测试/手动失效用: 清空感知缓存。 */
export function clearPerceptionCache(): void {
  _perceptionCache.clear();
}

const PERCEPTION_SYSTEM = [
  '你是中央 AI 的「感知前置」。你的唯一任务是: 调用提供的只读工具, 收集与用户问题相关的公司内部真实数据 (OKR 真值进度 / at-risk 项 / 历史决议 / 知识库)。',
  '规则:',
  '1. 只收集数据, 不要回答用户的问题本身, 不要给建议。',
  '2. 用最少的工具调用拿到关键事实即可, 拿到后立即停止。',
  '3. 若问题与内部数据无关, 不调用任何工具, 直接简短说明"无需查询"。',
].join('\n');

/**
 * 中央 AI 内部感知 pass: 查只读真值并注入 systemPrompt。
 * fail-soft: 永不抛, 出错即返回 baseSystemPrompt 原样。
 */
export async function companyBrainPerceptionPass(
  query: string,
  baseSystemPrompt: string,
): Promise<PerceptionResult> {
  const t0 = Date.now();
  const checkId = `cbp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const empty = (reason: string): PerceptionResult => ({
    perceived: false,
    revisedSystemPrompt: baseSystemPrompt,
    toolInvocations: [],
    log: { query, triggerReason: reason, toolCallCount: 0, roundsExecuted: 0, latencyMs: Date.now() - t0, checkId },
  });

  const gate = shouldPerceive(query);
  if (!gate.trigger) return empty(gate.reason);

  // 短 TTL 缓存命中: 跳过 tool-loop, 直接拼回当前 baseSystemPrompt (省 ~4s)
  const cacheKey = perceptionCacheKey(query);
  const cached = getCachedPerception(cacheKey);
  if (cached) {
    return {
      perceived: true,
      revisedSystemPrompt: `${baseSystemPrompt}${cached.dataBlock}`,
      toolInvocations: cached.toolInvocations,
      log: {
        query,
        triggerReason: `${gate.reason} (cached <${Math.round(PERCEPTION_CACHE_TTL_MS / 1000)}s)`,
        toolCallCount: cached.toolCallCount,
        roundsExecuted: cached.roundsExecuted,
        latencyMs: Date.now() - t0,
        checkId,
      },
    };
  }

  try {
    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const loop = await runToolLoop({
      systemPrompt: PERCEPTION_SYSTEM,
      userQuery: query,
      toolset: [...PERCEPTION_TOOLSET],
      scenario: 'tool_use',
      actorUserId: COMPANY_BRAIN_USER_ID,
      isProxy: false,
      maxRounds: 3,
      maxTokens: 600,
      aiTraceId: checkId,
    });

    const okInvocations = loop.toolInvocations.filter((t) => t.ok);
    const toolInvocations = loop.toolInvocations.map((t) => ({ name: t.name, ok: t.ok }));

    // 一个工具都没调到 → 没拿到真值, 不改 prompt (但记录跑过)
    if (okInvocations.length === 0) {
      return {
        perceived: false,
        revisedSystemPrompt: baseSystemPrompt,
        toolInvocations,
        log: {
          query,
          triggerReason: `${gate.reason} → 0 tool results`,
          toolCallCount: loop.toolInvocations.length,
          roundsExecuted: loop.roundsExecuted,
          latencyMs: Date.now() - t0,
          checkId,
        },
      };
    }

    const dataLines = [
      '',
      '【中央 AI 本轮即时查询到的公司内部真实数据 · 优先据此作答】',
      ...okInvocations.map(
        (t, i) => `${i + 1}. [工具 ${t.name}] 返回:\n${t.result}`,
      ),
      '',
      '【约束】以上是你刚查到的系统真值 (S0 rollup 真实进度)。回答必须基于这些真实数据, 不要臆测进度/数字; 若某项数据为空, 如实说明"暂无数据"而非编造。',
    ];
    const dataBlock = `\n\n---\n${dataLines.join('\n')}`;
    const revisedSystemPrompt = `${baseSystemPrompt}${dataBlock}`;

    // 缓存成功感知的真值数据块, 供 TTL 内相近追问复用
    setCachedPerception(cacheKey, {
      dataBlock,
      toolInvocations,
      toolCallCount: loop.toolInvocations.length,
      roundsExecuted: loop.roundsExecuted,
      expiresAt: Date.now() + PERCEPTION_CACHE_TTL_MS,
    });

    return {
      perceived: true,
      revisedSystemPrompt,
      toolInvocations,
      log: {
        query,
        triggerReason: gate.reason,
        toolCallCount: loop.toolInvocations.length,
        roundsExecuted: loop.roundsExecuted,
        latencyMs: Date.now() - t0,
        checkId,
      },
    };
  } catch (err) {
    return {
      ...empty(`${gate.reason} → exception: ${(err as Error).message}`),
    };
  }
}
