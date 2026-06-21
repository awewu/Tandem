/**
 * POST /api/im/messages/[id]/promote-to-memory
 *
 * 把一条 IM 消息沉淀为 Memory 升级提议 (差异化 §2.2 第 3 条).
 *
 * Body:
 *   {
 *     triggeredBy: string;      必填 — 提议人
 *     proposedType?: string;    sop|case|redline|value|lesson, 默认 lesson
 *     proposedTitle?: string;   默认从消息正文截前 50 字
 *     level?: string;           team|dept|company, 默认 team
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { promoteImMessageToMemory, getChannelIfMember } from '@/lib/im/service';
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
    const result = await promoteImMessageToMemory({
      messageId: params.id,
      triggeredBy: auth.userId,
      proposedType: body.proposedType,
      proposedTitle: body.proposedTitle,
      level: body.level,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
