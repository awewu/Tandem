/**
 * POST /api/im/channels/[id]/typing
 *
 * §Sprint2 · 广播"正在输入" (transient, 不落库)。
 * 仅频道成员可触发; 前端 debounce (~3s) 调用。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { emitTyping, getChannelIfMember } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

interface Params {
  params: { id: string };
}

async function POSTApiHandler(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 仅成员可广播 typing (防跨频道/未鉴权刷事件)。
  const channel = await getChannelIfMember(params.id, auth.userId, auth.tenantId);
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });
  emitTyping(params.id, auth.userId);
  return NextResponse.json({ ok: true });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/im/channels/[id]/typing' });
