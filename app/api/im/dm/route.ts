/**
 * POST /api/im/dm  { meId, otherId }
 * �?�?1:1 私聊频道 (幂等)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getOrCreateDm } from '@/lib/im/service';

export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    if (!body.meId || !body.otherId) {
      return NextResponse.json(
        { error: 'meId / otherId required' },
        { status: 400 }
      );
    }
    if (body.meId === body.otherId) {
      return NextResponse.json(
        { error: 'cannot DM yourself' },
        { status: 400 }
      );
    }
    const channel = await getOrCreateDm(body.meId, body.otherId);
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
