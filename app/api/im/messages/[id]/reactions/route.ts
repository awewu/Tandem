import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { getChannelIfMember } from '@/lib/im/service';

/**
 * POST   /api/im/messages/:id/reactions   { emoji }   · 切换 (有则移除, 无则添加)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { emoji?: string };
  if (!body.emoji || body.emoji.length > 8) {
    return NextResponse.json({ error: 'invalid emoji' }, { status: 400 });
  }

  const store = getStore();
  const msg = await store.imMessages.get(params.id);
  if (!msg) return NextResponse.json({ error: 'message not found' }, { status: 404 });
  // 访问控制: 仅消息所在频道成员可表态 (防跨频道/跨租户写).
  const channel = await getChannelIfMember(msg.channelId, auth.userId, auth.tenantId);
  if (!channel) return NextResponse.json({ error: 'message not found' }, { status: 404 });

  const reactions = { ...(msg.reactions ?? {}) };
  const cur = reactions[body.emoji] ?? [];
  const has = cur.includes(auth.userId);
  reactions[body.emoji] = has ? cur.filter((u) => u !== auth.userId) : [...cur, auth.userId];
  if (reactions[body.emoji].length === 0) delete reactions[body.emoji];

  const updated = await store.imMessages.update(params.id, { reactions });
  return NextResponse.json({ message: updated });
}
