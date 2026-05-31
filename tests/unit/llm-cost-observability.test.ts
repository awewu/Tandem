/**
 * P0 · LLM 成本观测看板 MVP — 锁住三条最小契约:
 *
 *   1. estimateCostMicroUsd 数学正确, 未知 model 返回 0 (不阻塞写入, 但成本不可见)
 *   2. trackLlm / track 在无 DATABASE_URL 时 fire-and-forget (不抛/不写)
 *   3. /api/admin/usage GET 路由存在且要求 admin/owner 角色 (未登录返回 401)
 *
 * §SELF-USE-FIRST priority #4 (内部成本中心可见, 不是商业化定价)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('estimateCostMicroUsd', () => {
  it('对已知 model 按 in/out token 单价线性计算并四舍五入到 micro-USD', async () => {
    const { estimateCostMicroUsd, LLM_PRICING_USD_PER_M } = await import('@/lib/analytics/track');

    // gpt-4o: in=$2.5/1M, out=$10/1M
    // 1M in + 1M out = 2.5 + 10 = $12.5 = 125_000 micro-USD
    expect(estimateCostMicroUsd('gpt-4o', 1_000_000, 1_000_000)).toBe(125_000);

    // deepseek-chat: in=0.27, out=1.1; 100k in + 50k out
    // = 0.27 * 0.1 + 1.1 * 0.05 = 0.027 + 0.055 = 0.082 USD = 820 micro-USD
    expect(estimateCostMicroUsd('deepseek-chat', 100_000, 50_000)).toBe(820);

    // 0 token = 0 cost
    expect(estimateCostMicroUsd('gpt-4o', 0, 0)).toBe(0);

    // 价格表里至少包含主力 provider 的代表 model (锁住覆盖度)
    expect(LLM_PRICING_USD_PER_M['deepseek-chat']).toBeDefined();
    expect(LLM_PRICING_USD_PER_M['claude-3-5-sonnet']).toBeDefined();
    expect(LLM_PRICING_USD_PER_M['gpt-4o']).toBeDefined();
  });

  it('未知 model 返回 0 (不阻塞业务路径, 但成本会不可见)', async () => {
    const { estimateCostMicroUsd } = await import('@/lib/analytics/track');
    expect(estimateCostMicroUsd('totally-unknown-model-xyz', 1_000_000, 1_000_000)).toBe(0);
  });
});

describe('trackLlm / track · fire-and-forget', () => {
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
    vi.resetModules();
  });

  it('无 DATABASE_URL 时静默跳过, 不抛错 (fire-and-forget)', async () => {
    const { track, trackLlm } = await import('@/lib/analytics/track');

    await expect(
      track({ eventName: 'test.event', userId: 'u1', props: { foo: 'bar' } }),
    ).resolves.toBeUndefined();

    await expect(
      trackLlm({
        scenario: 'test',
        provider: 'deepseek',
        model: 'deepseek-chat',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        userId: 'u1',
      }),
    ).resolves.toBeUndefined();
  });

  it('缺失关键字段时直接返回, 不尝试写库', async () => {
    const { track, trackLlm } = await import('@/lib/analytics/track');
    // eventName 为空 → 立刻返回
    await expect(track({ eventName: '' })).resolves.toBeUndefined();
    // scenario/provider/model 任一缺失 → 立刻返回
    await expect(
      trackLlm({ scenario: '', provider: 'p', model: 'm' } as never),
    ).resolves.toBeUndefined();
  });
});

describe('/api/admin/usage 路由', () => {
  const originalDemo = process.env.ALLOW_DEMO_AUTH;

  beforeEach(() => {
    process.env.ALLOW_DEMO_AUTH = '0';
    vi.resetModules();
  });
  afterEach(() => {
    if (originalDemo === undefined) delete process.env.ALLOW_DEMO_AUTH;
    else process.env.ALLOW_DEMO_AUTH = originalDemo;
    vi.resetModules();
  });

  it('暴露 GET handler 且未登录请求被 requireAuth 拦截 (401)', async () => {
    const mod = await import('@/app/api/admin/usage/route');
    expect(typeof mod.GET).toBe('function');
    expect(mod.dynamic).toBe('force-dynamic');

    const { NextRequest } = await import('next/server');
    const req = new NextRequest('http://localhost/api/admin/usage?days=7');
    const res = await mod.GET(req);
    expect(res.status).toBe(401);
  });
});
