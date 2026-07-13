/**
 * GET /api/admin/usage · 自用阶段使用 + AI 成本看板
 *
 * 返回:
 *   - UsageEvent 维度: top 10 事件 / top 10 活跃用户 / 最近 24h 时序
 *   - LlmUsageLog 维度: 各 provider 调用次数 / token 总量 / 估算成本 / 失败率
 *
 * 查询参数 ?days=N (默认 7)
 *
 * 权限: admin
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbid = requireRole(auth, ['admin', 'owner']);
  if (forbid) return forbid;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? '7')));
  const sinceMs = Date.now() - days * 86400_000;
  const since = new Date(sinceMs);
  // postgres-js 无法把 JS Date 直接作为绑定参数序列化 (prod 报 ERR_INVALID_ARG_TYPE),
  // 传 ISO 字符串并在 SQL 里显式 cast 成 timestamptz.
  const sinceIso = since.toISOString();

  const { db } = await import('@/lib/infra/drizzle-client');

  // ---- UsageEvent 维度 ----
  const [topEvents, topUsers, dailyEvents] = await Promise.all([
    db.execute(sql`
      SELECT "eventName", COUNT(*)::int AS cnt
      FROM "UsageEvent"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
      GROUP BY "eventName"
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT "userId", COUNT(*)::int AS cnt
      FROM "UsageEvent"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
        AND "userId" IS NOT NULL
      GROUP BY "userId"
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
      FROM "UsageEvent"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
      GROUP BY day
      ORDER BY day
    `),
  ]);

  // ---- LlmUsageLog 维度 ----
  const [llmByProvider, llmByScenario, llmDaily, llmFailures] = await Promise.all([
    db.execute(sql`
      SELECT
        "provider",
        COUNT(*)::int AS calls,
        SUM("tokensIn")::int AS tokens_in,
        SUM("tokensOut")::int AS tokens_out,
        SUM("costMicroUsd")::bigint AS cost_micro_usd,
        AVG("latencyMs")::int AS avg_latency_ms,
        SUM(CASE WHEN "success" THEN 0 ELSE 1 END)::int AS failures
      FROM "LlmUsageLog"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
      GROUP BY "provider"
      ORDER BY calls DESC
    `),
    db.execute(sql`
      SELECT
        "scenario",
        COUNT(*)::int AS calls,
        SUM("tokensIn" + "tokensOut")::int AS total_tokens,
        SUM("costMicroUsd")::bigint AS cost_micro_usd
      FROM "LlmUsageLog"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
      GROUP BY "scenario"
      ORDER BY cost_micro_usd DESC NULLS LAST
      LIMIT 10
    `),
    db.execute(sql`
      SELECT
        to_char("createdAt", 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS calls,
        SUM("costMicroUsd")::bigint AS cost_micro_usd
      FROM "LlmUsageLog"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
      GROUP BY day
      ORDER BY day
    `),
    db.execute(sql`
      SELECT "errorMessage", COUNT(*)::int AS cnt
      FROM "LlmUsageLog"
      WHERE "createdAt" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
        AND "success" = false
      GROUP BY "errorMessage"
      ORDER BY cnt DESC
      LIMIT 5
    `),
  ]);

  // 总览 (整段时间)
  const totalsRes = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM "UsageEvent"
        WHERE "createdAt" >= ${sinceIso}::timestamptz AND "tenantId" = ${auth.tenantId}) AS total_events,
      (SELECT COUNT(DISTINCT "userId")::int FROM "UsageEvent"
        WHERE "createdAt" >= ${sinceIso}::timestamptz AND "tenantId" = ${auth.tenantId} AND "userId" IS NOT NULL) AS active_users,
      (SELECT COUNT(*)::int FROM "LlmUsageLog"
        WHERE "createdAt" >= ${sinceIso}::timestamptz AND "tenantId" = ${auth.tenantId}) AS total_llm_calls,
      (SELECT COALESCE(SUM("costMicroUsd"), 0)::bigint FROM "LlmUsageLog"
        WHERE "createdAt" >= ${sinceIso}::timestamptz AND "tenantId" = ${auth.tenantId}) AS total_cost_micro_usd
  `);

  const totalsRow = ((totalsRes as { rows?: unknown[] }).rows?.[0] ?? {}) as Record<string, unknown>;

  // ---- BossAI 维度 (audit log + UsageEvent boss_ai.opened 联合) ----
  const [bossAiPerUser, bossAiRateLimited, bossAiDaily] = await Promise.all([
    db.execute(sql`
      SELECT
        "actorId" AS user_id,
        SUM(CASE WHEN "action" = 'boss_ai.ask' THEN 1 ELSE 0 END)::int AS asks,
        SUM(CASE WHEN "action" = 'boss_ai.answer' THEN 1 ELSE 0 END)::int AS answers,
        SUM(CASE WHEN "action" = 'boss_ai.rate_limited' THEN 1 ELSE 0 END)::int AS rate_limited
      FROM "AuditLog"
      WHERE "timestamp" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
        AND "action" IN ('boss_ai.ask', 'boss_ai.answer', 'boss_ai.rate_limited')
      GROUP BY "actorId"
      ORDER BY asks DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM "AuditLog"
      WHERE "timestamp" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
        AND "action" = 'boss_ai.rate_limited'
    `),
    db.execute(sql`
      SELECT
        to_char("timestamp", 'YYYY-MM-DD') AS day,
        SUM(CASE WHEN "action" = 'boss_ai.ask' THEN 1 ELSE 0 END)::int AS asks
      FROM "AuditLog"
      WHERE "timestamp" >= ${sinceIso}::timestamptz
        AND "tenantId" = ${auth.tenantId}
        AND "action" = 'boss_ai.ask'
      GROUP BY day
      ORDER BY day ASC
    `),
  ]);

  const rateLimitedRow = ((bossAiRateLimited as { rows?: unknown[] }).rows?.[0] ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    days,
    since: since.toISOString(),
    totals: {
      totalEvents: Number(totalsRow.total_events ?? 0),
      activeUsers: Number(totalsRow.active_users ?? 0),
      totalLlmCalls: Number(totalsRow.total_llm_calls ?? 0),
      totalCostMicroUsd: Number(totalsRow.total_cost_micro_usd ?? 0),
      totalCostUsd: Number(totalsRow.total_cost_micro_usd ?? 0) / 10000,
    },
    usage: {
      topEvents: rowsOf(topEvents),
      topUsers: rowsOf(topUsers),
      dailyEvents: rowsOf(dailyEvents),
    },
    llm: {
      byProvider: rowsOf(llmByProvider),
      byScenario: rowsOf(llmByScenario),
      daily: rowsOf(llmDaily),
      failures: rowsOf(llmFailures),
    },
    bossAi: {
      topUsers: rowsOf(bossAiPerUser),    // [{user_id, asks, answers, rate_limited}]
      totalRateLimited: Number(rateLimitedRow.cnt ?? 0),
      daily: rowsOf(bossAiDaily),         // [{day, asks}]
    },
  });
});

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const r = (result as { rows?: unknown[] }).rows;
  return Array.isArray(r) ? r : [];
}
