/**
 * Analytics · 用户行为 + LLM 调用埋点
 *
 * 设计原则:
 *   1. fire-and-forget — 失败不阻塞业务, 不抛错
 *   2. 不依赖第三方 (PostHog / Mixpanel), 自建可控
 *   3. 一行调用 — 最低心智负担
 *   4. 跟 audit/log.ts 共用 drizzle-client, 持久化路径一致
 *
 * §SELF-USE-FIRST priority #2 (用户行为埋点) + B-005 (LlmUsageLog)
 *
 * 用法:
 *   import { track, trackLlm } from '@/lib/analytics/track';
 *   await track({ eventName: 'okr.create', userId, props: { krCount: 3 } });
 *   await trackLlm({ scenario, provider, model, tokensIn, tokensOut, latencyMs, userId });
 */

const PERSIST_ENABLED = !!process.env.DATABASE_URL;

function genId(prefix: 'ev' | 'llm'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// UsageEvent · 用户行为埋点
// ---------------------------------------------------------------------------

export interface TrackInput {
  /** 事件名, 推荐 'domain.action' 格式: 'page.view' / 'okr.create' / 'persona.train' / 'memory.promote' */
  eventName: string;
  /** 用户 ID (匿名访问可省略) */
  userId?: string | null;
  /** 租户 ID, 默认 'default' */
  tenantId?: string;
  /** 任意属性 (path, durationMs, targetId, targetType, ...) */
  props?: Record<string, unknown>;
  /** 会话 ID (可选, 用于 funnel 分析) */
  sessionId?: string;
  /** User-Agent (可选, 区分桌面/移动) */
  userAgent?: string;
}

/**
 * 异步埋点. fire-and-forget, 失败仅 warn 不抛.
 * 服务端调用: 推荐 await (确保事件已写入); 也可不 await
 */
export async function track(input: TrackInput): Promise<void> {
  if (!input.eventName) return;
  if (!PERSIST_ENABLED) return; // 没配 DATABASE_URL 时跳过

  try {
    const { db, schema } = await import('@/lib/infra/drizzle-client');
    await db.insert(schema.usageEvent).values({
      id: genId('ev'),
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? 'default',
      eventName: input.eventName,
      props: (input.props as object | undefined) ?? null,
      sessionId: input.sessionId ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    // 不抛, 不影响业务路径
    // eslint-disable-next-line no-console
    console.warn('[analytics] track failed:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// LlmUsageLog · LLM 调用成本与延迟
// ---------------------------------------------------------------------------

export interface TrackLlmInput {
  /** TAF Router scenario */
  scenario: string;
  /** Provider (deepseek / anthropic / openai / kimi / doubao / qwen / ...) */
  provider: string;
  /** 具体模型 */
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  /** 成本 (1/10000 美元, integer 避免浮点; 计算公式: usd * 10000) */
  costMicroUsd?: number;
  userId?: string | null;
  tenantId?: string;
  /** 链路追踪 (可关联 baseline-guard checkId / request id) */
  requestId?: string;
  success?: boolean;
  errorMessage?: string;
}

/**
 * LLM 调用埋点. 每次 router.chat / router.complete 调用后写一行.
 * 即使 success=false 也要写 (用于失败率统计).
 */
export async function trackLlm(input: TrackLlmInput): Promise<void> {
  if (!PERSIST_ENABLED) return;
  if (!input.scenario || !input.provider || !input.model) return;

  try {
    const { db, schema } = await import('@/lib/infra/drizzle-client');
    await db.insert(schema.llmUsageLog).values({
      id: genId('llm'),
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? 'default',
      scenario: input.scenario,
      provider: input.provider,
      model: input.model,
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      latencyMs: input.latencyMs ?? 0,
      costMicroUsd: input.costMicroUsd ?? 0,
      requestId: input.requestId ?? null,
      success: input.success ?? true,
      errorMessage: input.errorMessage ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[analytics] trackLlm failed:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// 价格表 (估算, 单位: 1 美元 / 1M tokens) → 转 costMicroUsd
// ---------------------------------------------------------------------------

/**
 * 价格表 (input/output 价格, 单位: USD per 1M tokens)
 * 真实价格定期更新; V1 仅 4 家主力 provider, 其它走 UNKNOWN.
 *
 * 价格来源: 各家官方 pricing 页 (2026-05).
 * 如有出入, 以官方为准, 这里仅为成本估算.
 */
export const LLM_PRICING_USD_PER_M: Record<string, { in: number; out: number }> = {
  // DeepSeek
  'deepseek-chat': { in: 0.27, out: 1.1 },
  'deepseek-reasoner': { in: 0.55, out: 2.19 },
  // Anthropic
  'claude-3-5-sonnet': { in: 3.0, out: 15.0 },
  'claude-3-7-sonnet': { in: 3.0, out: 15.0 },
  'claude-haiku': { in: 0.25, out: 1.25 },
  // OpenAI
  'gpt-4o': { in: 2.5, out: 10.0 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gpt-4.1': { in: 2.0, out: 8.0 },
  // Kimi / Moonshot
  'moonshot-v1-8k': { in: 1.66, out: 1.66 },
  'moonshot-v1-32k': { in: 3.33, out: 3.33 },
  'moonshot-v1-128k': { in: 8.32, out: 8.32 },
  // 字节 / 豆包
  'doubao-pro': { in: 0.11, out: 0.32 },
  // 阿里 / Qwen
  'qwen-max': { in: 1.4, out: 5.6 },
  'qwen-plus': { in: 0.11, out: 0.28 },
};

/**
 * 估算 cost (单位: micro-USD = 0.0001 USD = 1/10000 USD).
 * 不在 pricing 表里的 model 返回 0 (不阻塞但 cost 不可见).
 */
export function estimateCostMicroUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = LLM_PRICING_USD_PER_M[model];
  if (!p) return 0;
  const inUsd = (tokensIn / 1_000_000) * p.in;
  const outUsd = (tokensOut / 1_000_000) * p.out;
  return Math.round((inUsd + outUsd) * 10_000);
}
