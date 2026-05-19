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
import { updateChannelMeta } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const store = getStore();
  const channel = await store.imChannels.get(id);
  if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ channel });
}

export async function PATCH(
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
