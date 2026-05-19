import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { YJS_WS_URL, isYjsConfigured } from '@/lib/infra/yjs-doc';

/**
 * GET /api/documents/:id/yjs-info
 *
 * 返回客户端连 Yjs ws server 所需的信息 (room name + ws url).
 * 客户端拿到后用 y-websocket provider 直连.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!isYjsConfigured()) {
    return NextResponse.json(
      { error: 'realtime collaboration not configured', hint: 'set YJS_WS_URL' },
      { status: 503 },
    );
  }
  return NextResponse.json({
    wsUrl: YJS_WS_URL,
    room: `doc-${params.id}`,
    identity: auth.userId,
  });
}
