/**
 * GET  /api/im/channels?userId=...   列出我的频道 (含未读计数)
 * POST /api/im/channels              创建频道 (Q2: 7 种 type)
 *
 * Body for POST:
 *   { type, name, memberIds[], topic?, visibility?, createdBy,
 *     departmentId?, autoCreated?, projectEndsAt? }
 *
 * Q2 (2026-05-10) 7 种 type:
 *   group | announcement | department | team | project | cross_dept
 *   (dm 走 /api/im/dm)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { createChannel, listMyChannels } from '@/lib/im/service';

export async function GET(req: NextRequest) {
  await boot();
  const userId = new URL(req.url).searchParams.get('userId') ?? 'demo-user';
  const channels = await listMyChannels(userId);
  return NextResponse.json({ channels });
}

export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    if (!body.type || !body.createdBy || !Array.isArray(body.memberIds)) {
      return NextResponse.json(
        { error: 'type / createdBy / memberIds required' },
        { status: 400 }
      );
    }
    if (body.type === 'dm') {
      return NextResponse.json(
        { error: 'use POST /api/im/dm for 1:1' },
        { status: 400 }
      );
    }
    const channel = await createChannel({
      type: body.type,
      name: body.name ?? '新频道',
      topic: body.topic,
      visibility: body.visibility,
      memberIds: body.memberIds,
      createdBy: body.createdBy,
      departmentId: body.departmentId,
      autoCreated: body.autoCreated,
      projectEndsAt: body.projectEndsAt,
    });
    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
