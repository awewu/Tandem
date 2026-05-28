/**
 * GET /api/im/messages/:id/ai-trace
 *
 * §IM-7 (CHARTER-FOUR-PILLARS) · AI 回复透明化
 *
 * 给定一条 IM message id, 返回背后的 LLM 调用 trace:
 *   - 用了哪个 provider / model
 *   - tokens (in/out) + cost + latency
 *   - success / 失败原因
 *   - scenario
 *   - 创建时间
 *
 * 飞书 / 钉钉的 AI 回复是黑盒, 用户没法知道这条 AI 答案是怎么来的, 烧了多少钱.
 * Tandem 把每次 AI 调用变可见, 这是 IM-7 "AI 回复透明化" 的核心.
 *
 * 后续可扩展: 召回了哪些 Memory (需要 baseline-guard 把 hits 也持久化), prompt 全文 (privacy)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const messageId = params.id;

  // 1) 拿 message
  const store = getStore();
  const message = await store.imMessages.get(messageId);
  if (!message) {
    return NextResponse.json({ error: 'message not found' }, { status: 404 });
  }

  if (message.senderKind !== 'persona' || !message.aiTraceId) {
    return NextResponse.json(
      {
        error: 'no trace',
        reason: '只有 AI 分身回复 (senderKind=persona) 才有 trace',
        senderKind: message.senderKind,
      },
      { status: 404 }
    );
  }

  // 2) 拿对应的 LlmUsageLog (尝试 PG; 若没接 PG, 返回降级数据)
  let trace: {
    provider?: string;
    model?: string;
    scenario?: string;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
    costMicroUsd?: number;
    costUsd?: number;
    success?: boolean;
    errorMessage?: string | null;
    createdAt?: string;
  } = {};

  try {
    const { db, schema } = await import('@/lib/infra/drizzle-client');
    const { eq, desc } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(schema.llmUsageLog)
      .where(eq(schema.llmUsageLog.requestId, message.aiTraceId))
      .orderBy(desc(schema.llmUsageLog.createdAt))
      .limit(1);
    if (rows.length > 0) {
      const r = rows[0];
      trace = {
        provider: r.provider,
        model: r.model,
        scenario: r.scenario,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        latencyMs: r.latencyMs,
        costMicroUsd: r.costMicroUsd,
        costUsd: r.costMicroUsd / 10_000,
        success: r.success,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      };
    }
  } catch (err) {
    // PG 不通 / migration 未跑: 降级返回 traceId, 不抛错
    return NextResponse.json({
      messageId,
      aiTraceId: message.aiTraceId,
      trace: null,
      warning: 'LlmUsageLog 查询失败, 可能 PG 未配置或 migration 0003 未应用',
      reason: (err as Error)?.message?.slice(0, 200),
    });
  }

  return NextResponse.json({
    messageId,
    aiTraceId: message.aiTraceId,
    senderId: message.senderId,
    trace: Object.keys(trace).length > 0 ? trace : null,
  });
}
