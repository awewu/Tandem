export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { logger } from '@/lib/infra/logger';
import { isDatabaseMode } from '@/lib/infra/storage-mode';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { boot, getBootReadiness, type BootReadinessState } from '@/lib/boot';

/**
 * /api/health · liveness + readiness 探针
 *
 * - 200 ok=true     · 全部依赖健康 (k8s readiness 通过)
 * - 503 ok=false    · 至少一个关键依赖不可达 (k8s 摘除流量)
 *
 * 检查项:
 *   - process     · 进程存活, 启动时长
 *   - bootstrap   · seed / AI 设置 / MCP / S3 / 组织云盘初始化完成
 *   - database    · PG 连通性 (SELECT 1)
 *   - redis       · 可选, 仅当 REDIS_URL 配置时检查
 *   - storage     · 可选, 仅当 S3_ENDPOINT 配置时检查 (HEAD bucket)
 */

type CheckResult = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

type BootstrapCheckResult = CheckResult & {
  state: BootReadinessState;
  startedAt: number | null;
  completedAt: number | null;
  warnings: string[];
};

async function checkBootstrap(): Promise<BootstrapCheckResult> {
  let bootError: string | undefined;
  try {
    // In production this starts the background initialization and returns
    // immediately. In development/test it preserves boot()'s blocking behavior.
    await boot();
  } catch (err) {
    bootError = err instanceof Error ? err.message : String(err);
  }

  const status = getBootReadiness();
  const ok = !bootError && status.state === 'ready';
  const pendingError = status.state === 'initializing'
    ? 'initialization in progress'
    : status.state === 'not_started'
      ? 'initialization not started'
      : undefined;
  return {
    ok,
    state: bootError ? 'failed' : status.state,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
    warnings: status.warnings,
    latencyMs: status.durationMs ?? undefined,
    ...(!ok ? { error: bootError ?? status.error ?? pendingError ?? 'initialization failed' } : {}),
  };
}

async function checkDb(): Promise<CheckResult> {
  if (!isDatabaseMode()) return { ok: true, error: 'not configured (in-memory mode)' };
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

async function GETApiHandler() {
  const bootstrap = await checkBootstrap();
  const [database, redis, storage, llm] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkStorage(),
    checkLlm(),
  ]);
  // llm degraded != 503 (LLM is non-critical for liveness; readiness still passes)
  const allOk = bootstrap.ok && database.ok && redis.ok && storage.ok;

  const { isObservabilityEnabled } = await import('@/lib/infra/observability');

  const body = {
    ok: allOk,
    version: process.env.APP_VERSION ?? 'dev',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    checks: { bootstrap, database, redis, storage, llm },
    observability: isObservabilityEnabled(),
  };

  if (!allOk) {
    logger.warn({ checks: body.checks }, '[health] readiness failed');
    const failedDeps: string[] = [];
    if (!database.ok) failedDeps.push('database');
    if (!redis.ok) failedDeps.push('redis');
    if (!storage.ok) failedDeps.push('storage');
    if (!bootstrap.ok) failedDeps.push('bootstrap');

    // "initializing" is an expected readiness transition, not an incident.
    // Dependency failures and a terminal bootstrap failure still alert.
    const shouldAlert = !database.ok || !redis.ok || !storage.ok || bootstrap.state === 'failed';
    if (shouldAlert) {
      const { fireAlert } = await import('@/lib/infra/alerts');
      void fireAlert({
        severity: 'critical',
        title: 'Readiness check failed',
        body: failedDeps.map((d) => `${d}: ${(body.checks as Record<string, CheckResult>)[d].error ?? 'unknown'}`).join('\n'),
        tags: { module: 'health', failed: failedDeps.join(',') },
      }).catch((err) => {
        logger.warn({ err }, '[health] failed to dispatch readiness alert');
      });
    }
  }

  return Response.json(body, { status: allOk ? 200 : 503 });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/health' });
