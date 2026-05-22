export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { logger } from '@/lib/infra/logger';

/**
 * /api/health · liveness + readiness 探针
 *
 * - 200 ok=true     · 全部依赖健康 (k8s readiness 通过)
 * - 503 ok=false    · 至少一个关键依赖不可达 (k8s 摘除流量)
 *
 * 检查项:
 *   - process     · 进程存活, 启动时长
 *   - database    · PG 连通性 (SELECT 1)
 *   - redis       · 可选, 仅当 REDIS_URL 配置时检查
 *   - storage     · 可选, 仅当 S3_ENDPOINT 配置时检查 (HEAD bucket)
 */

type CheckResult = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

async function checkDb(): Promise<CheckResult> {
  if (!process.env.DATABASE_URL) return { ok: true, error: 'not configured (in-memory mode)' };
  const t0 = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: (err as Error).message };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.REDIS_URL;
  if (!url) return { ok: true, error: 'not configured' };
  const t0 = Date.now();
  try {
    const { getRedis } = await import('@/lib/infra/redis-client');
    const r = getRedis();
    if (!r) return { ok: true, error: 'not initialized' };
    const reply = await r.ping();
    return { ok: reply === 'PONG', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: (err as Error).message };
  }
}

async function checkStorage(): Promise<CheckResult> {
  if (!process.env.S3_ENDPOINT) return { ok: true, error: 'not configured' };
  const t0 = Date.now();
  try {
    const { headBucket } = await import('@/lib/infra/s3-client');
    await headBucket();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: (err as Error).message };
  }
}

async function checkLlm(): Promise<CheckResult> {
  // Lightweight provider config check — no actual ping (saves quota).
  // Detailed ping endpoint is /api/llm-health.
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const registered = router.listProviders();
    if (registered.length === 0) {
      return { ok: false, error: 'no LLM provider registered' };
    }
    const hasPrimary = registered.includes('deepseek-v3') || registered.includes('qwen-max');
    return hasPrimary
      ? { ok: true }
      : { ok: false, error: `no primary reasoner (got ${registered.join(',')})` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const startedAt = Date.now();

export async function GET() {
  const [database, redis, storage, llm] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkStorage(),
    checkLlm(),
  ]);
  // llm degraded != 503 (LLM is non-critical for liveness; readiness still passes)
  const allOk = database.ok && redis.ok && storage.ok;

  const body = {
    ok: allOk,
    version: process.env.APP_VERSION ?? 'dev',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    checks: { database, redis, storage, llm },
  };

  if (!allOk) {
    logger.warn({ checks: body.checks }, '[health] readiness failed');
    const failedDeps: string[] = [];
    if (!database.ok) failedDeps.push('database');
    if (!redis.ok) failedDeps.push('redis');
    if (!storage.ok) failedDeps.push('storage');
    const { fireAlert } = await import('@/lib/infra/alerts');
    void fireAlert({
      severity: 'critical',
      title: 'Readiness check failed',
      body: failedDeps.map((d) => `${d}: ${(body.checks as Record<string, CheckResult>)[d].error ?? 'unknown'}`).join('\n'),
      tags: { module: 'health', failed: failedDeps.join(',') },
    });
  }

  return Response.json(body, { status: allOk ? 200 : 503 });
}
