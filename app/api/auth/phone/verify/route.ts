/**
 * POST /api/auth/phone/verify
 * Body: { phone, code }
 *
 * 校验验证码 → 找/建用户 → 发 session (设 access/refresh cookie, 复用账户登录同款).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { verifyPhoneCode, PhoneLoginError } from '@/lib/auth/phone-login';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  await boot();

  let body: { phone?: string; code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  try {
    const result = await verifyPhoneCode(body.phone ?? '', body.code ?? '', {
      userAgent: req.headers.get('user-agent') ?? undefined,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
    });

    const res = NextResponse.json({ ok: true, userId: result.userId });
    res.cookies.set(COOKIE_ACCESS, result.accessToken, { ...SESSION_COOKIE_OPTIONS, maxAge: 24 * 60 * 60 });
    if (result.refreshToken) {
      res.cookies.set(COOKIE_REFRESH, result.refreshToken, { ...SESSION_COOKIE_OPTIONS, maxAge: 30 * 24 * 3600 });
    }
    return res;
  } catch (err) {
    if (err instanceof PhoneLoginError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
