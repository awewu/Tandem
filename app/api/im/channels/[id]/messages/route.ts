/**
 * GET  /api/im/channels/[id]/messages?before=...&limit=...
 * POST /api/im/channels/[id]/messages   { senderId, body, parentMessageId?, attachments? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getChannelMessages, sendMessage } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';

interface Params {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const before = url.searchParams.get('before') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? '100');
  const messages = await getChannelMessages(params.id, { before, limit });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    if (typeof body.body !== 'string') {
      return NextResponse.json(
        { error: 'body required' },
        { status: 400 }
      );
    }
    const message = await sendMessage({
      channelId: params.id,
      senderId: auth.userId,
      body: body.body,
      parentMessageId: body.parentMessageId,
      attachments: body.attachments,
      senderKind: body.senderKind,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
