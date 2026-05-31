/**
 * Leader Election / Cron 单飞行 (B3)
 *
 * 问题: boot.ts 用进程内 setInterval 跑议事 sweep / KPI 快照 / Memory SLA 等定时任务.
 * 多副本水平扩容时, 每个副本都会跑 → 重复快照 / 重复 escalate / 重复通知.
 *
 * 方案: 每次 tick 用 Redis SET NX PX 抢一把短时锁, 只有抢到的副本执行本轮任务.
 *   - 无 REDIS_URL (单进程): 直接执行 (无竞争).
 *   - 有 Redis: at-most-one 副本/每个 tick 窗口执行.
 *
 * 注: 这是"够用"的协调, 不是严格 leader 选举. 锁带 token, 跑完按 token 释放;
 * 若任务超过 ttl, 锁过期后可能被另一副本接管 (ttl 要给足任务时长).
 */

import { getRedis } from './redis-client';
import { logger } from './logger';

/** 本进程实例 id (用于锁 token, 防误删别人的锁) */
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

// 释放锁的原子脚本: 仅当 value == token 时 DEL (防删到别的副本刚抢到的锁)
const RELEASE_LUA = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end`;

/**
 * 以"单飞行"语义执行 fn: 多副本下同一 tick 只有一个副本真正执行.
 *
 * @param name  逻辑任务名 (锁 key 后缀), e.g. 'convergence-tick'
 * @param ttlMs 锁 TTL (毫秒), 必须 ≥ 任务最坏执行时长
 * @param fn    任务体
 * @returns     ran=true 表示本副本执行了; false 表示被别的副本抢走/跳过
 */
export async function withCronLock(
  name: string,
  ttlMs: number,
  fn: () => Promise<void>,
): Promise<{ ran: boolean }> {
  const redis = getRedis();

  // 单进程 (无 Redis): 无竞争, 直接跑
  if (!redis) {
    await fn();
    return { ran: true };
  }

  const key = `cron:lock:${name}`;
  let acquired = false;
  try {
    // SET key token NX PX ttl — 抢到才返回 'OK'
    const res = await redis.set(key, INSTANCE_ID, 'PX', ttlMs, 'NX');
    acquired = res === 'OK';
  } catch (err) {
    // Redis 异常 → fail-open 跑一次 (宁可偶尔重复, 不可定时任务全停)
    logger.warn({ err: (err as Error).message, name }, '[leader] lock acquire failed, fail-open run');
    await fn();
    return { ran: true };
  }

  if (!acquired) return { ran: false };

  try {
    await fn();
    return { ran: true };
  } finally {
    try {
      await redis.eval(RELEASE_LUA, 1, key, INSTANCE_ID);
    } catch {
      /* 释放失败无妨, 锁会按 ttl 自动过期 */
    }
  }
}
