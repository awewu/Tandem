/**
 * 搭子手抄 · 笔记集合
 *
 *   GET  /api/shouchao/notes?q=&archived=1   列出当前用户笔记 (可搜索)
 *   POST /api/shouchao/notes                 新建笔记
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listNotes, createNote } from '@/lib/shouchao/service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const includeArchived = url.searchParams.get('archived') === '1';

  const notes = await listNotes(auth.userId, { q, includeArchived });
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: {
    title?: string;
    content?: string;
    tags?: string[];
    sourceUrl?: string;
    summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const note = await createNote({
    ownerId: auth.userId,
    tenantId: auth.tenantId,
    title: body.title,
    content: body.content,
    tags: Array.isArray(body.tags) ? body.tags : [],
    sourceUrl: body.sourceUrl,
    summary: body.summary,
  });
  return NextResponse.json({ note }, { status: 201 });
}
