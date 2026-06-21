/**
 * POST /api/im/messages/[id]/spawn-room
 *
 * 差异化 #1: 把一条 IM 消息一键转成议事室.
 * 自动: 创建 DecisionCard / 议事室 / 在原频道发系统消息回链.
 *
 * Body: { triggeredBy: string, title?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { spawnDecisionRoomFromMessage, getChannelIfMember } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json().catch(() => ({}));
    // 访问控制: triggeredBy 取自登录身份, 且必须是消息所在频道成员.
    const msg = await getStore().imMessages.get(params.id);
    if (!msg) return NextResponse.json({ error: 'message not found' }, { status: 404 });
    const channel = await getChannelIfMember(msg.channelId, auth.userId, auth.tenantId);
    if (!channel) return NextResponse.json({ error: 'message not found' }, { status: 404 });
    const result = await spawnDecisionRoomFromMessage({
      messageId: params.id,
      triggeredBy: auth.userId,
      title: body.title,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
