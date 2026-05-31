/**
 * GET /api/auth/wechat/poll?ticket=...
 *
 * 轮询扫码状态. confirmed 时找/建用户并设 session cookie; 其余返回 status.
 * 未配置 → 501 not_configured.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { pollWechatScan, WechatLoginError } from '@/lib/auth/wechat-login';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await boot();
  const ticket = new URL(req.url).searchParams.get('ticket') ?? '';

  try {
    const r = await pollWechatScan(ticket, {
      userAgent: req.headers.get('user-agent') ?? undefined,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
    });

    if (r.session) {
      const res = NextResponse.json({ ok: true, status: 'confirmed', userId: r.session.userId });
      res.cookies.set(COOKIE_ACCESS, r.session.accessToken, { ...SESSION_COOKIE_OPTIONS, maxAge: 15 * 60 });
      if (r.session.refreshToken) {
        res.cookies.set(COOKIE_REFRESH, r.session.refreshToken, { ...SESSION_COOKIE_OPTIONS, maxAge: 30 * 24 * 3600 });
      }
      return res;
    }
    return NextResponse.json({ ok: true, status: r.state.status });
  } catch (err) {
    if (err instanceof WechatLoginError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
