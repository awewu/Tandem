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
import { spawnDecisionRoomFromMessage } from '@/lib/im/service';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.triggeredBy) {
      return NextResponse.json(
        { error: 'triggeredBy required' },
        { status: 400 }
      );
    }
    const result = await spawnDecisionRoomFromMessage({
      messageId: params.id,
      triggeredBy: body.triggeredBy,
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
