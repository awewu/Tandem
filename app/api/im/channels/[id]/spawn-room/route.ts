/**
 * POST /api/im/channels/[id]/spawn-room   { title: string, description?: string }
 *
 * §Sprint3 群总结闭环: 把群总结(或其中一条待办)一键开成议事室。
 * 与 messages/[id]/spawn-room 的区别: 无源消息, 从 title/description 直接起。
 * 访问控制: 仅频道成员 (getChannelIfMember)。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getChannelIfMember, spawnDecisionRoomFromText } from '@/lib/im/service';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function POSTApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    const channel = await getChannelIfMember(id, auth.userId, auth.tenantId);
    if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { title?: unknown; description?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const result = await spawnDecisionRoomFromText({
      channelId: id,
      triggeredBy: auth.userId,
      title,
      description: typeof body.description === 'string' ? body.description : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/im/channels/[id]/spawn-room' });
