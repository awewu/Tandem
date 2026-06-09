/**
 * 权限/治理专项加固 · 回归锁 (P0)
 *
 * 覆盖两个已确认漏洞的修复:
 *   P0-A · /api/tandem-skills/execute 身份冒充
 *     - 调用身份必须取自鉴权上下文, 不接受 body.userId / body.tenantId 注入
 *   P0-B · /api/audit 租户隔离
 *     - 必须按 entry.tenantId (顶层) 过滤, 非本租户的审计条目不可见
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// boot() 在测试环境会触发 drizzle-client 模块级连接 → 抛错; 统一 mock 成 no-op。
vi.mock('@/lib/boot', () => ({
  boot: vi.fn(async () => {}),
  getRouter: vi.fn(() => ({})),
}));

function jsonReq(url: string, body: unknown, method = 'POST'): NextRequest {
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return new NextRequest(req);
}

describe('P0-A · /api/tandem-skills/execute 身份取自鉴权, 拒绝 body 注入', () => {
  beforeEach(() => {
    process.env.ALLOW_DEMO_AUTH = '1'; // requireAuth 走 demo fallback (userId='demo-user', tenant='default')
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('body.userId / body.tenantId 被忽略, skill 收到的 ctx 是鉴权身份', async () => {
    // 注册一个回显 ctx 的探针 skill (green · 无副作用)
    const { skillRegistry } = await import('@/lib/taf/skills');
    skillRegistry.register({
      id: 'test.echo_ctx',
      description: 'echo caller identity (test probe)',
      tags: ['test'],
      zone: 'green',
      proxyAllowed: true,
      estimatedTokens: 1,
      schema: { type: 'function', function: { name: 'test_echo_ctx', description: 'probe', parameters: { type: 'object', properties: {} } } },
      execute: async (_args, ctx) => ({ ok: true, data: { userId: ctx.userId, tenantId: ctx.tenantId } }),
    });

    const { POST } = await import('@/app/api/tandem-skills/execute/route');
    const res = await POST(
      jsonReq('http://test.local/api/tandem-skills/execute', {
        skillId: 'test.echo_ctx',
        args: {},
        // 攻击载荷: 试图冒充他人 + 跨租户
        userId: 'victim-user',
        tenantId: 'other-tenant',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    // 身份必须是鉴权上下文 (demo-user / default), 而不是 body 注入的值
    expect(json.data.userId).toBe('demo-user');
    expect(json.data.tenantId).toBe('default');
    expect(json.data.userId).not.toBe('victim-user');
    expect(json.data.tenantId).not.toBe('other-tenant');

    skillRegistry.unregister('test.echo_ctx');
  });

  it('未登录 + ALLOW_DEMO_AUTH=0 → 401, 不执行', async () => {
    process.env.ALLOW_DEMO_AUTH = '0';
    const { POST } = await import('@/app/api/tandem-skills/execute/route');
    const res = await POST(
      jsonReq('http://test.local/api/tandem-skills/execute', { skillId: 'test.echo_ctx' }),
    );
    expect(res.status).toBe(401);
    process.env.ALLOW_DEMO_AUTH = '1';
  });
});

describe('P0-B · /api/audit 租户隔离按顶层 tenantId 过滤', () => {
  beforeEach(() => {
    process.env.ALLOW_DEMO_AUTH = '1'; // demo → tenant 'default'
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('只返回本租户 (default) 审计, 他租户条目不可见', async () => {
    const { getAuditLog } = await import('@/lib/audit/log');
    const log = getAuditLog();
    // 写两条不同租户的审计
    await log.append('skill.executed', 'demo-user', { tenantId: 'default', targetId: 'mine' });
    await log.append('skill.executed', 'attacker', { tenantId: 'other-tenant', targetId: 'theirs' });

    const { GET } = await import('@/app/api/audit/route');
    const res = await GET(jsonReq('http://test.local/api/audit', undefined, 'GET'));
    expect(res.status).toBe(200);
    const json = await res.json();

    const tenants = new Set(json.entries.map((e: { tenantId?: string }) => e.tenantId ?? 'default'));
    expect(tenants.has('other-tenant')).toBe(false);
    // 本租户条目可见
    const targetIds = json.entries.map((e: { targetId?: string }) => e.targetId);
    expect(targetIds).toContain('mine');
    expect(targetIds).not.toContain('theirs');
  });
});
