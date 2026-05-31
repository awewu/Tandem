/**
 * 后端硬化回归测试 (2026-05-31 · PRODUCTION-AUDIT B3/B5/B6/B7)
 *
 *   B5 · AuditLog 内存环形缓冲 (防无界增长)
 *   B6 · rate-limit fail-closed (鉴权敏感端点 Redis 故障时拒绝)
 *   B3 · withCronLock 单飞行 (无 Redis 单进程直接跑)
 *   B7 · production-guard 多副本强制 REDIS_URL
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAuditLog } from '@/lib/audit/log';
import { failureResult } from '@/lib/infra/rate-limit';
import { withCronLock } from '@/lib/infra/leader';
import { runProductionGuard } from '@/lib/infra/production-guard';

// ───────────────────────────────────────────────────────────────────
// B5 · AuditLog 内存环形缓冲
// ───────────────────────────────────────────────────────────────────
describe('B5 · AuditLog 内存环形缓冲', () => {
  const KEY = 'AUDIT_MEMORY_MAX';
  let original: string | undefined;

  beforeEach(() => {
    original = process.env[KEY];
    process.env[KEY] = '100'; // floor 是 100
  });
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it('超过上限后 list 不会无界增长 (裁剪到最近 N 条)', async () => {
    const log = getAuditLog();
    const tenant = `t_ringbuf_${Date.now()}`;
    for (let i = 0; i < 250; i++) {
      await log.append('system.provider_health_failed', 'tester', { tenantId: tenant });
    }
    const rows = await log.list({ tenantId: tenant });
    // 250 条写入, 上限 100 → 该 tenant 在内存中不超过 100 条
    expect(rows.length).toBeLessThanOrEqual(100);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('裁剪后新 append 的 hash 链仍续得上 (prevHash 来自 tail 而非数组头)', async () => {
    const log = getAuditLog();
    const tenant = `t_chain_${Date.now()}`;
    for (let i = 0; i < 150; i++) {
      await log.append('system.provider_switch', 'tester', { tenantId: tenant });
    }
    const v = await log.verify(tenant);
    expect(v.ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// B6 · rate-limit fail-closed
// ───────────────────────────────────────────────────────────────────
describe('B6 · rate-limit fail-closed 决策', () => {
  const KEY = 'RATE_LIMIT_FORCE_OPEN';
  let original: string | undefined;
  beforeEach(() => {
    original = process.env[KEY];
    delete process.env[KEY];
  });
  afterEach(() => {
    if (original === undefined) delete process.env[KEY];
    else process.env[KEY] = original;
  });

  it('failClosed=true → Redis 故障时拒绝 (allowed=false)', () => {
    const r = failureResult({ key: 'login:x', limit: 5, windowSec: 3600, failClosed: true });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('默认 (fail-open) → Redis 故障时放行 (allowed=true)', () => {
    const r = failureResult({ key: 'api:x', limit: 120, windowSec: 60 });
    expect(r.allowed).toBe(true);
  });

  it('RATE_LIMIT_FORCE_OPEN=1 → 即使 failClosed 也放行 (运维逃生阀)', () => {
    process.env[KEY] = '1';
    const r = failureResult({ key: 'login:x', limit: 5, windowSec: 3600, failClosed: true });
    expect(r.allowed).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────
// B3 · withCronLock 单飞行
// ───────────────────────────────────────────────────────────────────
describe('B3 · withCronLock 单飞行', () => {
  it('无 REDIS_URL (单进程) → 直接执行任务', async () => {
    // vitest.config 已清空 DATABASE_URL/REDIS_URL, getRedis() 返回 null
    let ran = false;
    const res = await withCronLock('test-task', 5000, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(res.ran).toBe(true);
  });

  it('任务抛错向上传播 (不静默吞)', async () => {
    await expect(
      withCronLock('test-throw', 5000, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});

// ───────────────────────────────────────────────────────────────────
// B7 · production-guard 多副本强制 Redis
// ───────────────────────────────────────────────────────────────────
describe('B7 · production-guard 多副本强制 REDIS_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('生产 + 多副本 + 无 Redis → error', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_REPLICAS', '3');
    vi.stubEnv('REDIS_URL', '');
    const r = runProductionGuard();
    expect(r.errors.some((e) => e.includes('REDIS_URL') && e.includes('多副本'))).toBe(true);
  });

  it('生产 + 单副本 + 无 Redis → 仅 warning, 不 error', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_REPLICAS', '1');
    vi.stubEnv('REDIS_URL', '');
    const r = runProductionGuard();
    const redisErr = r.errors.some((e) => e.includes('REDIS_URL') && e.includes('多副本'));
    expect(redisErr).toBe(false);
    expect(r.warnings.some((w) => w.includes('REDIS_URL'))).toBe(true);
  });
});
