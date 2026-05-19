/**
 * Cache · Redis-first with InMemory fallback
 *
 * 抽象 cache-aside pattern, 业务代码不必关心 Redis 是否可用.
 *
 * 用法:
 *   const v = await cacheGetOrLoad(`badge:${userId}`, 30, () => loadFromDb());
 */

import { getRedis } from './redis-client';
import { logger } from './logger';

const memCache = new Map<string, { v: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return e.v;
}

function memSet(key: string, value: string, ttlSec: number): void {
  memCache.set(key, { v: value, expiresAt: Date.now() + ttlSec * 1000 });
  if (memCache.size > 10_000) {
    // 简单 LRU: 删最老的 1000
    const keys = Array.from(memCache.keys()).slice(0, 1000);
    keys.forEach((k) => memCache.delete(k));
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return memGet(key);
  try {
    return await r.get(key);
  } catch (err) {
    logger.warn({ err: (err as Error).message, key }, '[cache] redis get failed, fallback');
    return memGet(key);
  }
}

export async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  const r = getRedis();
  if (!r) {
    memSet(key, value, ttlSec);
    return;
  }
  try {
    await r.set(key, value, 'EX', ttlSec);
  } catch (err) {
    logger.warn({ err: (err as Error).message, key }, '[cache] redis set failed, fallback');
    memSet(key, value, ttlSec);
  }
}

export async function cacheDel(key: string | string[]): Promise<void> {
  const keys = Array.isArray(key) ? key : [key];
  const r = getRedis();
  if (r) {
    try {
      await r.del(...keys);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[cache] redis del failed');
    }
  }
  keys.forEach((k) => memCache.delete(k));
}

/** Cache-aside: get-or-load with TTL. Loader 异常会抛出 (不缓存错误). */
export async function cacheGetOrLoad<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet(key);
  if (cached !== null) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      /* fall through to reload */
    }
  }
  const value = await loader();
  await cacheSet(key, JSON.stringify(value), ttlSec);
  return value;
}
