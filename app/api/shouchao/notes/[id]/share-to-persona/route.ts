/**
 * 搭子手抄 · 员工本人闸门 (个人笔记 → 工作分身)
 *
 *   POST /api/shouchao/notes/:id/share-to-persona   body: { enabled: boolean }
 *
 * 闸门归员工本人: 默认关, 逐条 opt-in, 可随时撤回. 公司无入口、绝不进公司 Memory/OKR.
 * 全程 audit(actor=本人). 按 ownerId 隔离: 非本人笔记一律 404.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { setSharedToPersona } from '@/lib/shouchao/service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();
  const { id } = params;

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) 必填' }, { status: 400 });
  }

  const note = await setSharedToPersona(auth.userId, id, body.enabled);
  if (!note) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ note });
}
