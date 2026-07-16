/**
 * GET  /api/intranet/posts          — 列出 (支持 ?type=announcement|policy|event|benefit, ?includeArchived=1)
 * POST /api/intranet/posts          — 创建 (内网内容管理角色)
 *
 * P3-10 公告/政策/大事记/福利 CMS.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth, requirePermission } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { IntranetPost, IntranetPostType } from '@/lib/types/intranet-post';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { resolveIntranetPublisherName } from '@/lib/intranet/publisher-name';

const VALID_TYPES: IntranetPostType[] = ['announcement', 'policy', 'event', 'benefit'];

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') as IntranetPostType | null;
    // 草稿/归档仅 steward/champion 可见 (与单条 GET 一致): 普通员工即使带 ?includeDrafts=1
    // 也不能枚举未发布/已归档内容, 防草稿(如未公开通知)泄露。
    const canManage = !(await requirePermission(auth, 'intranet.manage'));
    const includeArchived = canManage && searchParams.get('includeArchived') === '1';
    const includeDrafts = canManage && searchParams.get('includeDrafts') === '1';

    const store = getStore();
    // 租户隔离统一收敛 (§23 P2-A): withTenantScope.list() 经 store 层下推, 不再逐路由手写过滤.
    let posts = await withTenantScope(store.intranetPosts, auth.tenantId).list();
    const users = await store.auth.users.list({ tenantId: auth.tenantId });
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    posts = posts.map((post) => ({
      ...post,
      publishedByName: resolveIntranetPublisherName(post, userNameById),
    }));
    if (typeFilter && VALID_TYPES.includes(typeFilter)) {
      posts = posts.filter((p) => p.type === typeFilter);
    }
    if (!includeArchived) posts = posts.filter((p) => !p.archivedAt);
    if (!includeDrafts) posts = posts.filter((p) => !!p.publishedAt);

    posts.sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bt - at;
    });

    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/intranet/posts' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requirePermission(auth, 'intranet.manage');
  if (forbidden) return forbidden;

  try {
    const body = await req.json();
    const { type, title, body: content } = body;
    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 20) : [];
    if ((typeof content !== 'string' || !content.trim()) && attachments.length === 0) {
      return NextResponse.json({ error: 'body or attachments required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const draft = body.draft === true;
    const store = getStore();
    const publisher = await store.auth.users.findById(auth.userId);
    const post: IntranetPost = {
      id: crypto.randomUUID(),
      type,
      title: title.trim(),
      body: typeof content === 'string' ? content : '',
      summary: typeof body.summary === 'string' ? body.summary.trim().slice(0, 280) : undefined,
      coverImage: normalizeCoverImage(body.coverImage),
      mandatoryRead: body.mandatoryRead === true,
      readBy: [],
      viewedBy: [],
      publishedAt: draft ? null : now,
      publishedBy: auth.userId,
      publishedByName: publisher?.name,
      archivedAt: null,
      attachments,
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
      tenantId: auth.tenantId,
      createdAt: now,
      updatedAt: now,
    };
    await store.intranetPosts.create(post);
    return NextResponse.json({ post });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/intranet/posts' });

function normalizeCoverImage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const cover = value.trim();
  const allowed = cover.startsWith('https://') || cover.startsWith('/') || /^data:image\/(webp|jpeg|png);base64,/.test(cover);
  if (!allowed || cover.length > 2_000_000) return undefined;
  return cover;
}
