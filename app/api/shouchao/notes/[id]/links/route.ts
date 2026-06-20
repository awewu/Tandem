/**
 * 搭字手抄 · 笔记链接关系 (双向链接)
 *
 *   GET /api/shouchao/notes/:id/links
 *     → { outgoing: LinkRef[], backlinks: NoteSummary[] }
 *       outgoing  : 本笔记正文里 [[标题]] 引用的其它笔记 (含 unresolved 未创建项)
 *       backlinks : 哪些笔记引用了本笔记 (反向链接)
 *
 * 全部 ownerId 隔离: 非本人笔记 404。只在本人笔记之间连边。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getNote, getOutgoingLinks, getBacklinks } from '@/lib/shouchao/service';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  const { id } = params;
  const note = await getNote(auth.userId, id);
  if (!note) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [outgoing, backlinkNotes] = await Promise.all([
    getOutgoingLinks(auth.userId, id),
    getBacklinks(auth.userId, id),
  ]);

  const backlinks = backlinkNotes.map((n) => ({
    id: n.id,
    title: n.title,
    updatedAt: n.updatedAt,
  }));

  return NextResponse.json({ outgoing, backlinks });
}
