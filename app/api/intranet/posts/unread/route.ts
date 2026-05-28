/**
 * GET /api/intranet/posts/unread   — 当前用户未读的强制已读 posts (用于全局 banner)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const store = getStore();
    const posts = (await store.intranetPosts.list()).filter(
      (p) =>
        p.tenantId === auth.tenantId &&
        p.mandatoryRead &&
        !!p.publishedAt &&
        !p.archivedAt &&
        !p.readBy.includes(auth.userId),
    );
    posts.sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
