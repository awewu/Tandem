/**
 * IM 访问控制 · 对抗性回归锁 (宪章 §23 铁律 #2: 安全 P0 零容忍)
 *
 * 锁死本轮修复的 IM IDOR / 越权 / 伪造漏洞:
 *   - 非成员不可读频道消息历史 / 成员名单 (跨频道+跨租户 IDOR)
 *   - 实时消息流必须登录 (此前完全未鉴权, userId 走 query param)
 *   - 客户端不能伪造 senderKind=system/persona, 也不能借此绕过成员校验
 *   - 成员管理 operator 取自登录身份, 普通成员不能冒充 owner 提权
 *   - dm meId 取自登录身份, 不能冒充他人发起私聊
 *
 * 攻击模型: 登录用户 (demo / tenant=default / userId='demo-user') 试图访问/操作
 * 自己不是成员的频道, 或借 body 注入冒充他人。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getRouter: vi.fn(() => ({})),
    getStore: repo.getStore,
  };
});

function req(url: string, body?: unknown, method = 'GET'): NextRequest {
  const r = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return new NextRequest(r);
}

async function seedChannel(memberIds: string[], tenantId = 'default') {
  const { createChannel } = await import('@/lib/im/service');
  return createChannel({
    type: 'team',
    name: 't',
    memberIds,
    createdBy: memberIds[0],
    tenantId,
  });
}

beforeEach(() => {
  setStore(createInMemoryStore());
  process.env.ALLOW_DEMO_AUTH = '1'; // requireAuth → demo (userId='demo-user', tenant='default')
});

afterEach(() => {
  vi.clearAllMocks();
  process.env.ALLOW_DEMO_AUTH = '1';
});

describe('IM IDOR · 非成员不可读频道数据', () => {
  it('GET messages: 非成员频道返回 404 (不泄露存在性)', async () => {
    const ch = await seedChannel(['other-user']); // demo-user 不是成员
    const { GET } = await import('@/app/api/im/channels/[id]/messages/route');
    const res = await GET(req(`http://t/api/im/channels/${ch.id}/messages`), {
      params: { id: ch.id },
    });
    expect(res.status).toBe(404);
  });

  it('GET messages: 成员可读 (200)', async () => {
    const ch = await seedChannel(['demo-user']);
    const { GET } = await import('@/app/api/im/channels/[id]/messages/route');
    const res = await GET(req(`http://t/api/im/channels/${ch.id}/messages`), {
      params: { id: ch.id },
    });
    expect(res.status).toBe(200);
  });

  it('GET members: 非成员频道返回 404', async () => {
    const ch = await seedChannel(['other-user']);
    const { GET } = await import('@/app/api/im/channels/[id]/members/route');
    const res = await GET(req(`http://t/api/im/channels/${ch.id}/members`), {
      params: Promise.resolve({ id: ch.id }),
    });
    expect(res.status).toBe(404);
  });

  it('跨租户: 他租户频道对 demo-user 不可读 (404)', async () => {
    const ch = await seedChannel(['demo-user'], 'other-tenant'); // 成员但租户不同
    const { GET } = await import('@/app/api/im/channels/[id]/messages/route');
    const res = await GET(req(`http://t/api/im/channels/${ch.id}/messages`), {
      params: { id: ch.id },
    });
    expect(res.status).toBe(404);
  });
});

describe('IM 实时流 · 必须登录', () => {
  it('未登录 + ALLOW_DEMO_AUTH=0 → 401, 不开流', async () => {
    process.env.ALLOW_DEMO_AUTH = '0';
    const { GET } = await import('@/app/api/im/channels/[id]/stream/route');
    const res = await GET(req('http://t/api/im/channels/x/stream?userId=victim'), {
      params: { id: 'x' },
    });
    expect(res.status).toBe(401);
  });
});

describe('IM 消息发送 · 禁止伪造 senderKind', () => {
  it('客户端传 senderKind=system 被强制改为 user', async () => {
    const ch = await seedChannel(['demo-user']);
    const { POST } = await import('@/app/api/im/channels/[id]/messages/route');
    const res = await POST(
      req(
        `http://t/api/im/channels/${ch.id}/messages`,
        { body: 'hi', senderKind: 'system' },
        'POST',
      ),
      { params: { id: ch.id } },
    );
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j.message.senderKind).toBe('user');
    expect(j.message.senderId).toBe('demo-user');
  });
});

describe('IM 成员管理 · operator 取自登录身份防提权', () => {
  it('普通成员冒充 owner 改角色被拒 (operatorId 注入无效)', async () => {
    // owner=other-user, demo-user 仅 member
    const ch = await seedChannel(['other-user', 'demo-user']);
    const { PATCH } = await import('@/app/api/im/channels/[id]/members/route');
    const res = await PATCH(
      req(
        `http://t/api/im/channels/${ch.id}/members`,
        // 攻击载荷: 声称自己是 owner (other-user) 把自己提成 owner
        { operatorId: 'other-user', userId: 'demo-user', role: 'owner' },
        'PATCH',
      ),
      { params: Promise.resolve({ id: ch.id }) },
    );
    // operator 实际取 demo-user(member) → 服务层 'only owner can set roles' → 400
    expect(res.status).toBe(400);
    const store = getStore();
    const { membershipKey } = await import('@/lib/types/im');
    const m = await store.imMemberships.get(membershipKey(ch.id, 'demo-user'));
    expect(m?.role).toBe('member'); // 未被提权
  });
});

describe('IM dm · meId 取自登录身份防冒充', () => {
  it('body.meId 被忽略, 私聊以 demo-user 身份发起', async () => {
    const { POST } = await import('@/app/api/im/dm/route');
    const res = await POST(
      req('http://t/api/im/dm', { meId: 'victim-user', otherId: 'someone' }, 'POST'),
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.channel.memberIds).toContain('demo-user');
    expect(j.channel.memberIds).not.toContain('victim-user');
  });
});
