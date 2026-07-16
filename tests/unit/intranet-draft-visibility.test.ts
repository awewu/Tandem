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
import { resolveIntranetPublisherName } from '@/lib/intranet/publisher-name';

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
  const publisher = await store.auth.users.create({
    email: 'admin@t.local',
    name: '内容管理员',
    tenantId: 'default',
    roles: ['admin'],
  });
  const base = {
    type: 'announcement' as const,
    body: 'x',
    mandatoryRead: false,
    readBy: [] as string[],
    publishedBy: publisher.id,
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

  it('内网内容编辑 + ?includeDrafts=1 → 可见草稿', async () => {
    currentAuth = ctx(['intranet_editor']);
    const { GET } = await import('@/app/api/intranet/posts/route');
    const res = await GET(req('http://t/api/intranet/posts?includeDrafts=1'));
    const j = await res.json();
    expect(j.posts.map((p: { id: string }) => p.id)).toContain('draft-1');
  });

  it('默认 (无参数) 任何角色都只见已发布', async () => {
    currentAuth = ctx(['admin']);
    const { GET } = await import('@/app/api/intranet/posts/route');
    const res = await GET(req('http://t/api/intranet/posts'));
    const j = await res.json();
    const ids = j.posts.map((p: { id: string }) => p.id);
    expect(ids).toContain('pub-1');
    expect(ids).not.toContain('draft-1');
    expect(j.posts.find((p: { id: string }) => p.id === 'pub-1').publishedByName).toBe('内容管理员');
  });
});

describe('内网文件正文', () => {
  it('内网内容编辑可申请 PDF 上传地址', async () => {
    currentAuth = ctx(['intranet_editor']);
    const { POST } = await import('@/app/api/intranet/assets/route');
    const request = new NextRequest(new Request('http://t/api/intranet/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: '员工手册.pdf', contentType: 'application/pdf', size: 2048 }),
    }));
    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.uploadUrl).toContain('/api/intranet/assets?key=');
    expect(json.attachment.mimeType).toBe('application/pdf');
  });

  it('允许仅上传 PDF、无文字正文时创建文章', async () => {
    currentAuth = ctx(['intranet_editor']);
    const { POST } = await import('@/app/api/intranet/posts/route');
    const request = new NextRequest(new Request('http://t/api/intranet/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'policy',
        title: 'PDF 制度',
        body: '',
        attachments: [{
          id: 'a.pdf',
          name: '制度.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: '/api/intranet/assets?key=intranet%2Fdefault%2Fa.pdf',
        }],
      }),
    }));
    const response = await POST(request);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.post.body).toBe('');
    expect(json.post.attachments).toHaveLength(1);
  });

  it('无文字正文且无附件时拒绝创建', async () => {
    currentAuth = ctx(['admin']);
    const { POST } = await import('@/app/api/intranet/posts/route');
    const request = new NextRequest(new Request('http://t/api/intranet/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'announcement', title: '空内容', body: '', attachments: [] }),
    }));
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('内网阅读统计', () => {
  it('打开文章只计一次阅读，强制确认单独计数', async () => {
    currentAuth = ctx(['employee']);
    const { POST } = await import('@/app/api/intranet/posts/[id]/read/route');
    const viewRequest = () => new NextRequest(new Request('http://t/api/intranet/posts/pub-1/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'view' }),
    }));
    await POST(viewRequest(), { params: { id: 'pub-1' } });
    await POST(viewRequest(), { params: { id: 'pub-1' } });

    let post = await getStore().intranetPosts.get('pub-1');
    expect(post?.viewedBy).toEqual([currentAuth.userId]);
    expect(post?.readBy).toEqual([]);

    const ackRequest = new NextRequest(new Request('http://t/api/intranet/posts/pub-1/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'ack' }),
    }));
    await POST(ackRequest, { params: { id: 'pub-1' } });
    post = await getStore().intranetPosts.get('pub-1');
    expect(post?.viewedBy).toEqual([currentAuth.userId]);
    expect(post?.readBy).toEqual([currentAuth.userId]);
  });
});

describe('内网发布人姓名', () => {
  it('历史示例账号失效后仍显示发布时姓名', () => {
    expect(resolveIntranetPublisherName({
      title: '里程碑: 第 100 家经销商签约',
      publishedBy: 'deleted-user-id',
    }, new Map())).toBe('李伟');
  });
});
