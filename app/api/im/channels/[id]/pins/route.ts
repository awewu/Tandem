/**
 * POST /api/im/channels/[id]/pins   { messageId, operatorId }  toggle pin/unpin
 * Day 7 (2026-05-10).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { togglePinMessage } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.messageId) {
      return NextResponse.json(
        { error: 'messageId required' },
        { status: 400 }
      );
    }
    // operator 始终取自登录身份, 禁止客户端声明他人为 operator 提权.
    const channel = await togglePinMessage(id, body.messageId, auth.userId);
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
