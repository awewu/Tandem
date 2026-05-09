import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { login, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function POST(req: NextRequest) {
  await boot();
  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ ok: false, error: 'email + password required' }, { status: 400 });
  }

  try {
    const result = await login({
      email: body.email,
      password: body.password,
      deviceInfo: {
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
      },
    });

    const res = NextResponse.json({
      ok: true,
      userId: result.userId,
      requiresMfa: result.requiresMfa,
      pendingSessionId: result.pendingSessionId,
    });

    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 15 * 60,
    });
    if (result.refreshToken) {
      res.cookies.set(COOKIE_REFRESH, result.refreshToken, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: 30 * 24 * 3600,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus }
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
