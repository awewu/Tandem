import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { issueLiveKitToken, isLiveKitConfigured } from '@/lib/infra/livekit';

/**
 * POST /api/meetings/livekit-token
 * Body: { roomName }
 *
 * 返回 LiveKit 客户端连接所需的 wsUrl + 短 TTL token.
 */
export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isLiveKitConfigured()) {
    return NextResponse.json(
      { error: 'video meeting not configured', hint: 'set LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_WS_URL' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { roomName?: string; displayName?: string };
  if (!body.roomName) {
    return NextResponse.json({ error: 'roomName required' }, { status: 400 });
  }

  try {
    const t = await issueLiveKitToken({
      roomName: body.roomName,
      identity: auth.userId,
      name: body.displayName ?? auth.userId,
    });
    return NextResponse.json(t);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
