/**
 * POST /api/intranet/posts/[id]/read   — 标记当前用户已读 (强制已读用)
 * GET  /api/intranet/posts/[id]/read   — 返回 { read: boolean }
 *
 * P3-10 强制已读追踪.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function POSTApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const posts = withTenantScope(store.intranetPosts, auth.tenantId);
    const post = await posts.get(params.id);
    if (!post) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    if (!post.readBy.includes(auth.userId)) {
      const readBy = [...post.readBy, auth.userId];
      await posts.update(params.id, { readBy, updatedAt: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/intranet/posts/[id]/read' });

async function GETApiHandler(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const post = await withTenantScope(store.intranetPosts, auth.tenantId).get(params.id);
    if (!post) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ read: post.readBy.includes(auth.userId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/intranet/posts/[id]/read' });
