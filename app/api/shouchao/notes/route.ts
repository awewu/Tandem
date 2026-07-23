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
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? undefined;
  const includeArchived = url.searchParams.get('archived') === '1';
  const notebookId = url.searchParams.get('notebook') ?? undefined;

  const notes = await listNotes(auth.userId, { q, includeArchived, notebookId });
  return NextResponse.json({ notes });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/notes' });

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  let body: {
    title?: string;
    content?: string;
    tags?: string[];
    notebookId?: string;
    sourceUrl?: string;
    summary?: string;
    parentId?: string;
    icon?: string;
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
    notebookId: typeof body.notebookId === 'string' ? body.notebookId : undefined,
    sourceUrl: body.sourceUrl,
    summary: body.summary,
    parentId: typeof body.parentId === 'string' ? body.parentId : undefined,
    icon: typeof body.icon === 'string' ? body.icon : undefined,
  });
  return NextResponse.json({ note }, { status: 201 });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/notes' });
