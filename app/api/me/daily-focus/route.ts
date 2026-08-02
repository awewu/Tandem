/**
 * GET /api/me/daily-focus
 *
 * 中央 AI 个人日级聚焦简报 (对标 WorkBoard Daily Focus)。
 * userId 锁定为 session 主体; demo 模式允许 ?userId= 覆盖 (方便单机看不同身份)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { generateDailyFocus } from '@/lib/persona/daily-focus';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const queryUserId = new URL(req.url).searchParams.get('userId');
  const userId = auth.demo && queryUserId ? queryUserId : auth.userId;

  const focus = await generateDailyFocus({ userId });
  return NextResponse.json({ ok: true, focus });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/me/daily-focus' });
