/**
 * 搭子手抄 · 单条笔记
 *
 *   GET    /api/shouchao/notes/:id   读取
 *   PATCH  /api/shouchao/notes/:id   更新 (标题/正文/标签/摘要/置顶/归档)
 *   DELETE /api/shouchao/notes/:id   删除
 *
 * 全部按 ownerId 隔离: 非本人笔记一律 404.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getNote, updateNote, deleteNote } from '@/lib/shouchao/service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { id } = params;
  const note = await getNote(auth.userId, id);
  if (!note) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ note });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { id } = params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const note = await updateNote(auth.userId, id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    content: typeof body.content === 'string' ? body.content : undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
    summary: typeof body.summary === 'string' ? body.summary : undefined,
    pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
    archived: typeof body.archived === 'boolean' ? body.archived : undefined,
  });
  if (!note) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { id } = params;
  const ok = await deleteNote(auth.userId, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
