/**
 * GET    /api/intranet/posts/[id]   — 读取单条 (门户详情页; 已发布非归档对全员可见)
 * PATCH  /api/intranet/posts/[id]   — 更新 / 发布草稿 / archive
 * DELETE /api/intranet/posts/[id]   — 软删 (archivedAt = now)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import type { IntranetPost } from '@/lib/types/intranet-post';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const post = await withTenantScope(store.intranetPosts, auth.tenantId).get(params.id);
    // 跨租户经 withTenantScope 视同不存在; 普通门户仅看已发布且未归档 (草稿/归档走管理后台)
    if (!post || !post.publishedAt || post.archivedAt) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ post, read: post.readBy.includes(auth.userId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function loadAndAuthorize(
  req: NextRequest,
  postId: string,
): Promise<
  | { error: NextResponse }
  | { post: IntranetPost; tenantId: string; userId: string }
> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return { error: auth };
  const forbidden = requireRole(auth, [...DATA_STEWARD_ROLES, 'champion']);
  if (forbidden) return { error: forbidden };
  const store = getStore();
  const post = await withTenantScope(store.intranetPosts, auth.tenantId).get(postId);
  if (!post) {
    return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  return { post, tenantId: auth.tenantId, userId: auth.userId };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const r = await loadAndAuthorize(req, params.id);
  if ('error' in r) return r.error;
  try {
    const body = await req.json();
    const allowed = ['title', 'body', 'summary', 'mandatoryRead', 'attachments', 'tags'];
    const patch: Partial<IntranetPost> = { updatedAt: new Date().toISOString() };
    for (const k of allowed) if (k in body) (patch as Record<string, unknown>)[k] = body[k];

    // 发布草稿
    if (body.publish === true && !r.post.publishedAt) {
      patch.publishedAt = new Date().toISOString();
    }
    // 取消发布 → 重回草稿
    if (body.unpublish === true) {
      patch.publishedAt = null;
    }
    // archive / unarchive
    if (body.archive === true) {
      patch.archivedAt = new Date().toISOString();
    } else if (body.unarchive === true) {
      patch.archivedAt = null;
    }

    const store = getStore();
    const updated = await withTenantScope(store.intranetPosts, r.tenantId).update(params.id, patch);
    return NextResponse.json({ post: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const r = await loadAndAuthorize(req, params.id);
  if ('error' in r) return r.error;
  try {
    const store = getStore();
    await withTenantScope(store.intranetPosts, r.tenantId).update(params.id, {
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
