/**
 * 搭子手抄 · 单个知识库
 *
 *   PATCH  /api/shouchao/notebooks/:id   重命名 / 改图标 { name?, icon? }
 *   DELETE /api/shouchao/notebooks/:id   删除 (软删 + 其下笔记回到未分组)
 *
 * 全部按 ownerId 隔离: 非本人知识库一律 404.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { updateNotebook, deleteNotebook } from '@/lib/shouchao/service';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { id } = params;

  let body: { name?: string; icon?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const notebook = await updateNotebook(auth.userId, id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    icon: typeof body.icon === 'string' ? body.icon : undefined,
  });
  if (!notebook) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ notebook });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { id } = params;
  const ok = await deleteNotebook(auth.userId, id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
