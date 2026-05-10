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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
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
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }
    const channel = await updateChannelMeta(id, body.operatorId, {
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
