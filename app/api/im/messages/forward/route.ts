/**
 * POST /api/im/messages/forward
 *
 * §Sprint2 · 转发 / 合并转发消息到目标频道。
 * body: { fromMessageIds: string[]; toChannelId: string; merge?: boolean }
 * 权限: operator = 登录身份, 必须为目标频道成员且对每条源消息可见 (service 校验)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { forwardMessages } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: { fromMessageIds?: unknown; toChannelId?: unknown; merge?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const fromMessageIds = Array.isArray(body.fromMessageIds)
    ? body.fromMessageIds.filter((x): x is string => typeof x === 'string')
    : [];
  const toChannelId = typeof body.toChannelId === 'string' ? body.toChannelId : '';
  const merge = body.merge === true;

  if (fromMessageIds.length === 0 || !toChannelId) {
    return NextResponse.json({ error: 'fromMessageIds and toChannelId required' }, { status: 400 });
  }

  try {
    const messages = await forwardMessages({
      fromMessageIds,
      toChannelId,
      operatorId: auth.userId,
      tenantId: auth.tenantId,
      merge,
    });
    return NextResponse.json({ messages });
  } catch (err) {
    const msg = (err as Error).message ?? 'forward failed';
    const status = msg.startsWith('forbidden') ? 403 : msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/im/messages/forward' });
