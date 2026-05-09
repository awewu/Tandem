import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { markChannelRead } from '@/lib/im/service';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  const body = await req.json().catch(() => ({}));
  const userId = body.userId ?? new URL(req.url).searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  await markChannelRead(params.id, userId);
  return NextResponse.json({ ok: true });
}
