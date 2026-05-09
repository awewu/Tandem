import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { registerWithInvite, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

/**
 * POST /api/auth/register
 *
 * Body: { email, password, name, inviteCode }
 *
 * 邀请制注册. 注册即登录, 颁发 access + refresh cookie.
 */
export async function POST(req: NextRequest) {
  await boot();
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { email, password, name, inviteCode } = body;
  if (!email || !password || !name || !inviteCode) {
    return NextResponse.json(
      { ok: false, error: 'email, password, name, inviteCode 均为必填' },
      { status: 400 }
    );
  }

  try {
    const result = await registerWithInvite({
      email,
      password,
      name,
      inviteCode,
      deviceInfo: extractDeviceInfo(req),
    });

    const res = NextResponse.json({
      ok: true,
      userId: result.userId,
      requiresMfa: result.requiresMfa,
    });

    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 15 * 60,
    });
    res.cookies.set(COOKIE_REFRESH, result.refreshToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 30 * 24 * 3600,
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ ok: false, code: err.code, error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

function extractDeviceInfo(req: NextRequest) {
  return {
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? undefined,
  };
}
