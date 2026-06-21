/**
 * POST /api/im/dm  { meId, otherId }
 * 查找或创建 1:1 私聊频道 (幂等)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getOrCreateDm } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(req: NextRequest) {
  await boot();
  // meId 始终取自登录身份, 禁止客户端冒充他人发起私聊.
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    if (!body.otherId) {
      return NextResponse.json(
        { error: 'otherId required' },
        { status: 400 }
      );
    }
    if (auth.userId === body.otherId) {
      return NextResponse.json(
        { error: 'cannot DM yourself' },
        { status: 400 }
      );
    }
    const channel = await getOrCreateDm(auth.userId, body.otherId);
    return NextResponse.json({ channel });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
