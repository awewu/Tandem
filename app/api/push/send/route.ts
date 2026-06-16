/**
 * POST /api/push/send — 服务端向指定用户发送 Web Push 通知
 * 权限: owner / admin（或内部服务调用）
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { sendPushTo } from '@/lib/infra/web-push';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }
  let body: { userId?: string; title?: string; body?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.userId || !body.title) {
    return NextResponse.json({ error: 'userId and title required' }, { status: 400 });
  }
  const result = await sendPushTo(body.userId, {
    title: body.title,
    body: body.body ?? '',
    url: body.url,
  });
  return NextResponse.json({ ok: true, ...result });
}
