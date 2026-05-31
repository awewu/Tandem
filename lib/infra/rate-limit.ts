/**
 * Rate Limiter · Redis sliding-window + InMemory fallback
 *
 * 设计:
 *   - Redis 配置 → 分布式 sliding window (sorted set + ZADD/ZREMRANGEBYSCORE)
 *   - 无 Redis → 内存 Map (单机, dev only)
 *   - 失败开放 (Redis 故障 → 放行, 不破坏可用性)
 *
 * 用法:
 *   const r = await rateLimit({ key: `login:${ip}`, limit: 5, windowSec: 3600 });
 *   if (!r.allowed) return 429;
 */

import { getRedis } from './redis-client';
import { logger } from './logger';

export interface RateLimitOptions {
  /** 唯一标识 (e.g. `login:1.2.3.4` / `api:user:abc`) */
  key: string;
  /** 窗口内最多允许次数 */
  limit: number;
  /** 窗口长度 (秒) */
  windowSec: number;
  /**
   * B6: Redis 故障时的策略.
   *   - false (默认): fail-open — 放行, 保可用性 (适合普通业务端点)
   *   - true: fail-closed — 拒绝, 保安全 (适合 login/mfa/register 等鉴权敏感端点,
   *     防 Redis 宕机窗口期被绕过限流爆破). 可用 RATE_LIMIT_FORCE_OPEN=1 全局回退到 fail-open.
   */
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSec: number;
  totalHits: number;
}

// ---------------------------------------------------------------------------
// InMemory fallback
// ---------------------------------------------------------------------------
const memBuckets = new Map<string, number[]>();

function memCheck(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowSec * 1000;
  const arr = (memBuckets.get(opts.key) ?? []).filter((t) => t > cutoff);
  arr.push(now);
  memBuckets.set(opts.key, arr);
  // 简单 GC: bucket 数过大时清理过期 key
  if (memBuckets.size > 5000) {
    memBuckets.forEach((v, k) => {
      if (v.length === 0 || v[v.length - 1] < cutoff) memBuckets.delete(k);
    });
  }
  return {
    allowed: arr.length <= opts.limit,
    remaining: Math.max(0, opts.limit - arr.length),
    resetSec: opts.windowSec,
    totalHits: arr.length,
  };
}

// ---------------------------------------------------------------------------
// Redis sliding window
// ---------------------------------------------------------------------------
async function redisCheck(opts: RateLimitOptions): Promise<RateLimitResult> {
  const r = getRedis();
  if (!r) return memCheck(opts);
  const now = Date.now();
  const cutoff = now - opts.windowSec * 1000;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;
  const redisKey = `rl:${opts.key}`;
  try {
    // Pipeline: 删过期 + 新增 + 计数 + 设 TTL
    const pipe = r.multi();
    pipe.zremrangebyscore(redisKey, 0, cutoff);
    pipe.zadd(redisKey, now, member);
    pipe.zcard(redisKey);
    pipe.expire(redisKey, opts.windowSec + 5);
    const res = await pipe.exec();
    const totalHits = Number((res?.[2]?.[1] as number) ?? 0);
    return {
      allowed: totalHits <= opts.limit,
      remaining: Math.max(0, opts.limit - totalHits),
      resetSec: opts.windowSec,
      totalHits,
    };
  } catch (err) {
    const r = failureResult(opts);
    logger.warn(
      { err: (err as Error).message, key: opts.key, allowed: r.allowed },
      `[rate-limit] redis failed, ${r.allowed ? 'fail-open (allow)' : 'fail-CLOSED (deny)'}`,
    );
    return r;
  }
}

/**
 * B6: Redis 故障时的结果决策 (纯函数, 便于测试).
 * failClosed=true 且未全局强制 open → 拒绝; 否则放行.
 */
export function failureResult(opts: RateLimitOptions): RateLimitResult {
  const forceOpen = process.env.RATE_LIMIT_FORCE_OPEN === '1';
  const failClosed = !!opts.failClosed && !forceOpen;
  return {
    allowed: !failClosed,
    remaining: failClosed ? 0 : opts.limit,
    resetSec: opts.windowSec,
    totalHits: failClosed ? opts.limit + 1 : 0,
  };
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (process.env.REDIS_URL) return redisCheck(opts);
  return memCheck(opts);
}

// ---------------------------------------------------------------------------
// 预设策略 (从 env 读 limit)
// ---------------------------------------------------------------------------

export const POLICIES = {
  login: () => ({
    limit: Number(process.env.RATE_LIMIT_LOGIN_PER_HOUR ?? 5),
    windowSec: 3600,
    failClosed: true,
  }),
  api: () => ({
    limit: Number(process.env.RATE_LIMIT_API_PER_MINUTE ?? 120),
    windowSec: 60,
  }),
  expensive: () => ({
    limit: Number(process.env.RATE_LIMIT_EXPENSIVE_PER_MINUTE ?? 10),
    windowSec: 60,
  }),
  // §BossAI · LLM 调用昂贵, 默认 20/分钟 (= 1200/小时), Owner 可调
  bossAi: () => ({
    limit: Number(process.env.RATE_LIMIT_BOSS_AI_PER_MINUTE ?? 20),
    windowSec: 60,
  }),
  // §BossAI 日上限 · 防失控成本, 默认 500 次/日/人
  bossAiDaily: () => ({
    limit: Number(process.env.RATE_LIMIT_BOSS_AI_PER_DAY ?? 500),
    windowSec: 86_400,
  }),
} as const;

/** 提取客户端 IP (尊重 trust proxy headers). */
export function getClientIp(headers: Headers): string {
  const xf = headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}
