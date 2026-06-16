/**
 * GET    /api/im/channels/[id]/members           列出成员 + 角色 + lastReadAt
 * POST   /api/im/channels/[id]/members           { operatorId, userId } 加成员
 * DELETE /api/im/channels/[id]/members?userId=X&operatorId=Y  移除成员
 * PATCH  /api/im/channels/[id]/members           { operatorId, userId, role } 改角色
 *
 * Day 5-6 (2026-05-10).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import {
  listChannelMembers, addChannelMember, removeChannelMember, setMemberRole, updateMemberSettings,
} from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const { id } = await params;
  const members = await listChannelMembers(id);
  return NextResponse.json({ members });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.operatorId || !body.userId) {
      return NextResponse.json(
        { error: 'operatorId / userId required' },
        { status: 400 }
      );
    }
    const channel = await addChannelMember(id, body.userId, body.operatorId);
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const operatorId = url.searchParams.get('operatorId');
    if (!userId || !operatorId) {
      return NextResponse.json(
        { error: 'userId / operatorId required' },
        { status: 400 }
      );
    }
    const channel = await removeChannelMember(id, userId, operatorId);
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
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
    // settings branch: muted / pinnedChat / markedChat
    if ('muted' in body || 'pinnedChat' in body || 'markedChat' in body) {
      const membership = await updateMemberSettings(id, auth.userId, {
        muted: body.muted,
        pinnedChat: body.pinnedChat,
        markedChat: body.markedChat,
      });
      return NextResponse.json({ membership });
    }
    // role branch
    if (!body.operatorId || !body.userId || !body.role) {
      return NextResponse.json(
        { error: 'operatorId / userId / role required' },
        { status: 400 }
      );
    }
    if (!['owner', 'admin', 'member'].includes(body.role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }
    const membership = await setMemberRole(id, body.userId, body.role, body.operatorId);
    return NextResponse.json({ membership });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
