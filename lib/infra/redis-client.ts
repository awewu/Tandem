/**
 * Redis Client · ioredis 单例
 *
 * 用途: session 缓存 / rate-limit 状态 / notification badge / 分布式锁
 *
 * §T2: HMR-safe 单例 (挂 globalThis), 重复 import 不创建多个连接.
 * 仅在 REDIS_URL 配置时才连接; 否则返回 null, 调用方走降级 (in-memory).
 */

import Redis, { type Redis as RedisClient } from 'ioredis';
import { logger } from './logger';

type GlobalWithRedis = typeof globalThis & { __tandem_redis__?: RedisClient | null };
const _g = globalThis as GlobalWithRedis;

function build(url: string): RedisClient {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      // 指数退避, 上限 5s
      return Math.min(times * 200, 5000);
    },
  });
  client.on('error', (err) => {
    logger.warn({ err: err.message }, '[redis] connection error');
  });
  client.on('connect', () => {
    logger.info('[redis] connected');
  });
  return client;
}

/** 返回 Redis 客户端; REDIS_URL 未配置时返回 null. */
export function getRedis(): RedisClient | null {
  if (_g.__tandem_redis__ !== undefined) return _g.__tandem_redis__;
  const url = process.env.REDIS_URL;
  if (!url) {
    _g.__tandem_redis__ = null;
    return null;
  }
  _g.__tandem_redis__ = build(url);
  return _g.__tandem_redis__;
}

/** 优雅关闭 (测试 / shutdown hook 用). */
export async function closeRedis(): Promise<void> {
  const r = _g.__tandem_redis__;
  if (r) {
    await r.quit();
    _g.__tandem_redis__ = undefined;
  }
}
