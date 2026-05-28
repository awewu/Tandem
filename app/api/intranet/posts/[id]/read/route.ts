/**
 * POST /api/intranet/posts/[id]/read   — 标记当前用户已读 (强制已读用)
 * GET  /api/intranet/posts/[id]/read   — 返回 { read: boolean }
 *
 * P3-10 强制已读追踪.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const post = await store.intranetPosts.get(params.id);
    if (!post || post.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    if (!post.readBy.includes(auth.userId)) {
      const readBy = [...post.readBy, auth.userId];
      await store.intranetPosts.update(params.id, { readBy, updatedAt: new Date().toISOString() });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const post = await store.intranetPosts.get(params.id);
    if (!post || post.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ read: post.readBy.includes(auth.userId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
