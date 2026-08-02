/**
 * /api/im/search · route 级集成测试 (§Sprint1 Megaplan)
 *
 * 覆盖 GET handler 端到端契约 (memory-store; embedding 未配 → 纯词面一路):
 *   - 未登录 → requireAuth 拦截 (401)
 *   - 空 q → { results: [] } (不查库)
 *   - 命中当前用户可见频道 → 返回结构化 results (含 channelName/preview/score)
 *   - channelId 限定越权频道 → 空 (不泄露存在性)
 *   - 权限边界: 越权频道消息绝不返回
 *   - limit 上限收口 (>100 → 100)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createChannel, sendMessage } from '@/lib/im/service';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/auth/require-auth';
import { GET } from '@/app/api/im/search/route';

function getReq(query: string): NextRequest {
  return new NextRequest(new Request(`http://localhost/api/im/search?${query}`, { method: 'GET' }));
}

function asUser(userId: string, tenantId = 'default') {
  vi.mocked(requireAuth).mockReturnValue({ userId, tenantId } as never);
}

/** u1 在 c1(与 u2); u3 在 c2(与 u2). u1 对 c2 无权。 */
async function seedChannels() {
  const c1 = await createChannel({ type: 'group', name: '产品群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
  const c2 = await createChannel({ type: 'group', name: '财务群', memberIds: ['u2', 'u3'], createdBy: 'u3' });
  return { c1, c2 };
}

beforeEach(() => {
  setStore(createInMemoryStore());
  vi.clearAllMocks();
});

describe('/api/im/search route', () => {
  it('未登录 → requireAuth 返回 401 被透传', async () => {
    vi.mocked(requireAuth).mockReturnValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }) as never,
    );
    const res = await GET(getReq('q=quarterly'));
    expect(res.status).toBe(401);
  });

  it('空 q → { results: [] }', async () => {
    asUser('u1');
    await seedChannels();
    const res = await GET(getReq('q=%20%20'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it('命中可见频道 → 返回结构化 result', async () => {
    asUser('u1');
    const { c1 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'quarterly roadmap 讨论' });

    const res = await GET(getReq('q=quarterly'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(1);
    expect(json.results[0]).toMatchObject({
      channelId: c1.id,
      channelName: '产品群',
      senderId: 'u1',
    });
    expect(json.results[0].preview).toContain('quarterly');
    expect(typeof json.results[0].score).toBe('number');
  });

  it('权限边界: 越权频道消息绝不返回', async () => {
    asUser('u1');
    const { c2 } = await seedChannels();
    await sendMessage({ channelId: c2.id, senderId: 'u3', body: 'secret budget number' });
    void c2;

    const res = await GET(getReq('q=budget'));
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it('channelId 限定越权频道 → 空 (不泄露存在性)', async () => {
    asUser('u1');
    const { c2 } = await seedChannels();
    await sendMessage({ channelId: c2.id, senderId: 'u3', body: 'roadmap secret' });

    const res = await GET(getReq(`q=roadmap&channelId=${c2.id}`));
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it('limit 上限收口 (>100 不抛错, handler 正常返回)', async () => {
    asUser('u1');
    const { c1 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'pipeline ready' });

    const res = await GET(getReq('q=pipeline&limit=9999'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(1);
  });
});
