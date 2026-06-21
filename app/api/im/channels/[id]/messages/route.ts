/**
 * GET  /api/im/channels/[id]/messages?before=...&limit=...
 * POST /api/im/channels/[id]/messages   { senderId, body, parentMessageId?, attachments? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getChannelMessages, sendMessage, getChannelIfMember } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit, POLICIES } from '@/lib/infra/rate-limit';
import { deferAudit } from '@/lib/audit/defer';

interface Params {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const before = url.searchParams.get('before') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? '100');
  // 访问控制: 仅频道成员可读消息历史 (防跨频道/跨租户 IDOR). 404 不泄露存在性.
  const channel = await getChannelIfMember(params.id, auth.userId, auth.tenantId);
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const messages = await getChannelMessages(params.id, { before, limit });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: Params) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // §限流: 防普通用户 / 失控客户端刷消息 (200 人级 spam guard)
  // 复用 api 通用预算 (默认 120/min, env RATE_LIMIT_API_PER_MINUTE 可调)
  const rl = await rateLimit({ key: `im:msg:${auth.userId}`, ...POLICIES.api() });
  if (!rl.allowed) {
    deferAudit('im.rate_limited', auth.userId, {
      targetType: 'im_channel',
      targetId: params.id,
      metadata: { window: 'minute', limit: rl.totalHits },
      tenantId: auth.tenantId,
    });
    return NextResponse.json(
      { error: 'rate_limited', hint: `请慢一点 · 每分钟最多 ${POLICIES.api().limit} 条消息` },
      { status: 429 },
    );
  }
  try {
    const body = await req.json();
    if (typeof body.body !== 'string') {
      return NextResponse.json(
        { error: 'body required' },
        { status: 400 }
      );
    }
    // senderKind 固定为 'user': 禁止客户端伪造 system/persona 消息或借此绕过成员校验.
    // system/persona 消息只由服务层内部 (议事室/Memory 升级/分身代行) 创建.
    const message = await sendMessage({
      channelId: params.id,
      senderId: auth.userId,
      body: body.body,
      parentMessageId: body.parentMessageId,
      attachments: body.attachments,
      senderKind: 'user',
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
