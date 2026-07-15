/**
 * GET    /api/im/channels/[id]              获取频道详情
 * PATCH  /api/im/channels/[id]              { operatorId, name?, topic?, announcement? }
 *                                           编辑频道元数据 (owner/admin)
 *
 * Day 5-7 (2026-05-10).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { updateChannelMeta, dissolveChannel, transferOwner } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const store = getStore();
  const channel = await store.imChannels.get(id);
  // 访问控制: 同租户 + (成员 或 公开频道可被发现). 否则 404 不泄露存在性.
  if (!channel || (channel.tenantId ?? 'default') !== auth.tenantId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const isMember = channel.memberIds.includes(auth.userId);
  if (!isMember && channel.visibility !== 'public') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ channel });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/im/channels/[id]' });

async function PATCHApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    const channel = await updateChannelMeta(id, auth.userId, {
      name: body.name,
      topic: body.topic,
      announcement: body.announcement,
    });
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/im/channels/[id]' });

/** DELETE /api/im/channels/:id   解散群 (owner only) */
async function DELETEApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    await dissolveChannel(id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/im/channels/[id]' });

/** PUT /api/im/channels/:id   { newOwnerId } 转让群主 (owner only) */
async function PUTApiHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.newOwnerId) return NextResponse.json({ error: 'newOwnerId required' }, { status: 400 });
    await transferOwner(id, body.newOwnerId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/im/channels/[id]' });
