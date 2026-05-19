/**
 * PATCH /api/im/messages/[id]   { action: 'recall', userId }
 * Day 4 (2026-05-10) 撤回消息.
 * - 普通成员: 仅本人 + 2 分钟内
 * - owner/admin: 任何时候
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { recallMessage } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.action !== 'recall') {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
    const message = await recallMessage(id, auth.userId);
    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
