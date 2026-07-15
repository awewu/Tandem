import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { markChannelRead } from '@/lib/im/service';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';

interface Params {
  params: { id: string };
}

async function POSTApiHandler(req: NextRequest, { params }: Params) {
  await boot();
  // userId 始终取自登录身份, 禁止客户端代他人标记已读.
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await markChannelRead(params.id, auth.userId);
  return NextResponse.json({ ok: true });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/im/channels/[id]/read' });
