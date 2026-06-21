/**
 * 内网门户 · 草稿/归档可见性回归锁
 *
 * 锁死修复: 列表 GET (/api/intranet/posts) 的 ?includeDrafts / ?includeArchived
 * 仅 steward/champion 可用; 普通员工即使携带该参数也不能枚举未发布草稿
 * (此前与单条 GET 行为不一致 → 草稿如未公开通知会泄露给全员)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { AuthContext } from '@/lib/auth/require-auth';

let currentAuth: AuthContext;

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getRouter: vi.fn(() => ({})),
    getStore: repo.getStore,
  };
});

// 部分 mock: 只替换 requireAuth (按测试切换角色), 保留真实 requireRole 逻辑
vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return { ...actual, requireAuth: vi.fn(() => currentAuth) };
});

function ctx(roles: string[]): AuthContext {
  return {
    userId: 'u-' + roles.join('-'),
    email: 'x@t.local',
    tenantId: 'default',
    roles,
    mfaVerified: true,
    demo: false,
  };
}

function req(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

async function seed() {
  const store = getStore();
  const base = {
    type: 'announcement' as const,
    body: 'x',
    mandatoryRead: false,
    readBy: [] as string[],
    publishedBy: 'admin',
    archivedAt: null,
    attachments: [],
    tags: [],
    tenantId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  await store.intranetPosts.create({
    ...base, id: 'pub-1', title: '已发布', publishedAt: '2026-01-02T00:00:00.000Z',
  } as never);
  await store.intranetPosts.create({
    ...base, id: 'draft-1', title: '草稿(未公开通知)', publishedAt: null,
  } as never);
}

beforeEach(async () => {
  setStore(createInMemoryStore());
  await seed();
});
afterEach(() => vi.clearAllMocks());

describe('内网草稿可见性', () => {
  it('普通员工 + ?includeDrafts=1 → 仍只见已发布 (草稿被过滤)', async () => {
    currentAuth = ctx(['employee']);
    const { GET } = await import('@/app/api/intranet/posts/route');
    const res = await GET(req('http://t/api/intranet/posts?includeDrafts=1&includeArchived=1'));
    const j = await res.json();
    const ids = j.posts.map((p: { id: string }) => p.id);
    expect(ids).toContain('pub-1');
    expect(ids).not.toContain('draft-1');
  });

  it('steward (admin) + ?includeDrafts=1 → 可见草稿', async () => {
    currentAuth = ctx(['admin']);
    const { GET } = await import('@/app/api/intranet/posts/route');
    const res = await GET(req('http://t/api/intranet/posts?includeDrafts=1'));
    const j = await res.json();
    const ids = j.posts.map((p: { id: string }) => p.id);
    expect(ids).toContain('pub-1');
    expect(ids).toContain('draft-1');
  });

  it('默认 (无参数) 任何角色都只见已发布', async () => {
    currentAuth = ctx(['admin']);
    const { GET } = await import('@/app/api/intranet/posts/route');
    const res = await GET(req('http://t/api/intranet/posts'));
    const j = await res.json();
    const ids = j.posts.map((p: { id: string }) => p.id);
    expect(ids).toContain('pub-1');
    expect(ids).not.toContain('draft-1');
  });
});
