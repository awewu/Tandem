/**
 * POST /api/im/channels/[id]/pins   { messageId, operatorId }  toggle pin/unpin
 * Day 7 (2026-05-10).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { togglePinMessage } from '@/lib/im/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.messageId || !body.operatorId) {
      return NextResponse.json(
        { error: 'messageId / operatorId required' },
        { status: 400 }
      );
    }
    const channel = await togglePinMessage(id, body.messageId, body.operatorId);
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
