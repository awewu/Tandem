/**
 * 租户隔离 · 对抗性回归锁 (宪章 §23 铁律 #2: 安全 P0 零容忍, 必须有对抗性测试守护)
 *
 * 覆盖逆向审计 REVERSE-ENGINEERING-AUDIT-2026-06-12 的 P0-A / P0-B 修复:
 *   P0-A · 跨租户写注入: 写接口 tenantId/身份字段一律取 auth 上下文, 拒绝 body 注入
 *   P0-B · 跨租户读泄露: 读接口必按 auth.tenantId 过滤, 他租户记录不可见
 *
 * 这些修复已在审计后落地, 本测试把它们"锁死"防回归 —— 没有对抗性测试,
 * 绿色门禁不作数 (§23)。攻击模型: 登录用户 (demo / tenant=default) 试图
 * 通过 body 注入跨租户写, 或读到他租户 (other-tenant) 的数据。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';

// boot() 真调会触发 drizzle 连接 → stub 成 no-op; getStore 委托给真实 repository 单例
// (tti 路由从 @/lib/boot 取 getStore, approvals 从 @/lib/storage/repository 取, 二者同一单例)。
vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getRouter: vi.fn(() => ({})),
    getStore: repo.getStore,
  };
});

// cycle-activate 会 emit 域事件 → realignPersonaToOkr 等订阅者 (需 LLM/store);
// 测试只关心租户写隔离, stub eventBus 隔离副作用。
vi.mock('@/lib/events/bus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

function jsonReq(url: string, body?: unknown, method = 'POST'): NextRequest {
  const req = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return new NextRequest(req);
}

beforeEach(() => {
  setStore(createInMemoryStore());
  process.env.ALLOW_DEMO_AUTH = '1'; // requireAuth → demo (userId='demo-user', tenant='default')
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('P0-A · 写接口拒绝 body 跨租户/身份注入 (/api/approvals)', () => {
  it('body.tenantId / body.requester / body.status 被忽略, 取鉴权上下文', async () => {
    const { POST } = await import('@/app/api/approvals/route');
    const res = await POST(
      jsonReq('http://test.local/api/approvals', {
        title: '采购申请',
        approver: 'boss',
        // 攻击载荷: 跨租户写 + 伪造申请人 + 伪造已批准状态 + 伪造 id
        tenantId: 'other-tenant',
        requester: 'victim-user',
        status: 'approved',
        id: 'forged-id',
      }),
    );
    expect(res.status).toBe(201);
    const apv = await res.json();
    // 租户/身份/状态必须来自鉴权上下文与服务端默认, 不是 body 注入值
    expect(apv.tenantId).toBe('default');
    expect(apv.tenantId).not.toBe('other-tenant');
    expect(apv.requester).toBe('demo-user');
    expect(apv.requester).not.toBe('victim-user');
    expect(apv.status).toBe('pending');
    expect(apv.id).not.toBe('forged-id');
  });

  it('未登录 + ALLOW_DEMO_AUTH=0 → 401, 不写入', async () => {
    process.env.ALLOW_DEMO_AUTH = '0';
    const { POST } = await import('@/app/api/approvals/route');
    const res = await POST(
      jsonReq('http://test.local/api/approvals', { title: 'x', approver: 'y' }),
    );
    expect(res.status).toBe(401);
    process.env.ALLOW_DEMO_AUTH = '1';
  });
});

describe('P0-B · 读接口按 auth.tenantId 过滤, 他租户记录不可见', () => {
  it('/api/approvals 只返回本租户审批单', async () => {
    const store = getStore();
    // 直接种入两条不同租户的审批单
    await store.approvals.create({
      title: '本租户单',
      type: 'generic',
      approver: 'boss',
      requester: 'demo-user',
      status: 'pending',
      createdAt: new Date().toISOString(),
      tenantId: 'default',
    } as never);
    await store.approvals.create({
      title: '他租户单',
      type: 'generic',
      approver: 'attacker-boss',
      requester: 'attacker',
      status: 'pending',
      createdAt: new Date().toISOString(),
      tenantId: 'other-tenant',
    } as never);

    const { GET } = await import('@/app/api/approvals/route');
    const res = await GET(jsonReq('http://test.local/api/approvals', undefined, 'GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const tenants = new Set(
      json.approvals.map((a: { tenantId?: string }) => a.tenantId ?? 'default'),
    );
    expect(tenants.has('other-tenant')).toBe(false);
    const titles = json.approvals.map((a: { title: string }) => a.title);
    expect(titles).toContain('本租户单');
    expect(titles).not.toContain('他租户单');
  });

  it('/api/tti 只返回本租户 TTI', async () => {
    const store = getStore();
    await store.ttis.create({
      cycleId: 'c1',
      ownerId: 'demo-user',
      title: '本租户 TTI',
      tenantId: 'default',
    } as never);
    await store.ttis.create({
      cycleId: 'c1',
      ownerId: 'attacker',
      title: '他租户 TTI',
      tenantId: 'other-tenant',
    } as never);

    const { GET } = await import('@/app/api/tti/route');
    const res = await GET(jsonReq('http://test.local/api/tti', undefined, 'GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const tenants = new Set(
      json.ttis.map((t: { tenantId?: string }) => t.tenantId ?? 'default'),
    );
    expect(tenants.has('other-tenant')).toBe(false);
    const titles = json.ttis.map((t: { title: string }) => t.title);
    expect(titles).toContain('本租户 TTI');
    expect(titles).not.toContain('他租户 TTI');
  });

  it('/api/okr/checkins 只返回本租户 check-in', async () => {
    const store = getStore();
    const now = new Date().toISOString();
    await store.checkIns.create({
      scope: 'kr',
      scopeId: 'kr-mine',
      authorId: 'demo-user',
      progressBefore: 0,
      progressAfter: 10,
      createdAt: now,
      tenantId: 'default',
    } as never);
    await store.checkIns.create({
      scope: 'kr',
      scopeId: 'kr-theirs',
      authorId: 'attacker',
      progressBefore: 0,
      progressAfter: 99,
      createdAt: now,
      tenantId: 'other-tenant',
    } as never);

    const { GET } = await import('@/app/api/okr/checkins/route');
    const res = await GET(jsonReq('http://test.local/api/okr/checkins', undefined, 'GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    const tenants = new Set(
      json.checkIns.map((c: { tenantId?: string }) => c.tenantId ?? 'default'),
    );
    expect(tenants.has('other-tenant')).toBe(false);
    const scopeIds = json.checkIns.map((c: { scopeId: string }) => c.scopeId);
    expect(scopeIds).toContain('kr-mine');
    expect(scopeIds).not.toContain('kr-theirs');
  });
});

describe('P0 · cycle-activate 跨租户写隔离 (回归: 激活不得误停他租户 active 周期)', () => {
  it('激活本租户周期时, 他租户 active 周期保持不变', async () => {
    const store = getStore();
    await store.cycles.create({ id: 'cyc-default-old', name: 'D-old', isActive: true, tenantId: 'default' } as never);
    await store.cycles.create({ id: 'cyc-default-new', name: 'D-new', isActive: false, tenantId: 'default' } as never);
    // 他租户的 active 周期 —— 修复前会被一并停用 (跨租户写 bug)
    await store.cycles.create({ id: 'cyc-other', name: 'O-active', isActive: true, tenantId: 'other-tenant' } as never);

    const { POST } = await import('@/app/api/okr/cycles/[id]/activate/route');
    const res = await POST(
      jsonReq('http://test.local/api/okr/cycles/cyc-default-new/activate', undefined, 'POST'),
      { params: { id: 'cyc-default-new' } },
    );
    expect(res.status).toBe(200);

    // 他租户 active 周期未被误停用
    expect((await store.cycles.get('cyc-other'))?.isActive).toBe(true);
    // 本租户: 旧 active 停用, 新的激活
    expect((await store.cycles.get('cyc-default-old'))?.isActive).toBe(false);
    expect((await store.cycles.get('cyc-default-new'))?.isActive).toBe(true);
  });

  it('激活他租户周期 → 404 (scoped get 视同不存在)', async () => {
    const store = getStore();
    await store.cycles.create({ id: 'cyc-foreign', name: 'F', isActive: false, tenantId: 'other-tenant' } as never);
    const { POST } = await import('@/app/api/okr/cycles/[id]/activate/route');
    const res = await POST(
      jsonReq('http://test.local/api/okr/cycles/cyc-foreign/activate', undefined, 'POST'),
      { params: { id: 'cyc-foreign' } },
    );
    expect(res.status).toBe(404);
    expect((await store.cycles.get('cyc-foreign'))?.isActive).toBe(false);
  });
});

describe('P0-B · [id] 写路由跨租户访问视同不存在 (404, 不泄露/不篡改)', () => {
  it('/api/tandem-okr/[id] PATCH 他租户 objective → 404 且未被篡改', async () => {
    const store = getStore();
    await store.objectives.create({
      id: 'obj-other', title: 'theirs', ownerId: 'attacker', tenantId: 'other-tenant',
    } as never);

    const { PATCH } = await import('@/app/api/tandem-okr/[id]/route');
    const res = await PATCH(
      jsonReq('http://test.local/api/tandem-okr/obj-other', { title: 'hacked' }, 'PATCH'),
      { params: { id: 'obj-other' } },
    );
    expect(res.status).toBe(404);
    expect((await store.objectives.get('obj-other'))?.title).toBe('theirs');
  });
});
