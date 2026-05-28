/**
 * GET  /api/intranet/posts          — 列出 (支持 ?type=announcement|policy|event|benefit, ?includeArchived=1)
 * POST /api/intranet/posts          — 创建 (admin/champion/hr)
 *
 * P3-10 公告/政策/大事记/福利 CMS.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { requireRole } from '@/lib/auth/require-auth';
import type { IntranetPost, IntranetPostType } from '@/lib/types/intranet-post';

const VALID_TYPES: IntranetPostType[] = ['announcement', 'policy', 'event', 'benefit'];

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') as IntranetPostType | null;
    const includeArchived = searchParams.get('includeArchived') === '1';
    const includeDrafts = searchParams.get('includeDrafts') === '1';

    const store = getStore();
    let posts = (await store.intranetPosts.list()).filter(
      (p) => p.tenantId === auth.tenantId,
    );
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

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ['admin', 'champion', 'hr']);
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
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'body required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const draft = body.draft === true;
    const post: IntranetPost = {
      id: crypto.randomUUID(),
      type,
      title: title.trim(),
      body: content,
      summary: typeof body.summary === 'string' ? body.summary.trim().slice(0, 280) : undefined,
      mandatoryRead: body.mandatoryRead === true,
      readBy: [],
      publishedAt: draft ? null : now,
      publishedBy: auth.userId,
      archivedAt: null,
      attachments: Array.isArray(body.attachments) ? body.attachments.slice(0, 20) : [],
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 10) : [],
      tenantId: auth.tenantId,
      createdAt: now,
      updatedAt: now,
    };
    const store = getStore();
    await store.intranetPosts.create(post);
    return NextResponse.json({ post });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
