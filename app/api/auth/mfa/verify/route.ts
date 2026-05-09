import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { completeMfa, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

/**
 * POST /api/auth/mfa/verify
 * Body: { pendingSessionId, totpCode? | recoveryCode? }
 *
 * 登录第二阶段, 提交 TOTP 或恢复码.
 */
export async function POST(req: NextRequest) {
  await boot();
  const body = (await req.json().catch(() => ({}))) as {
    pendingSessionId?: string;
    totpCode?: string;
    recoveryCode?: string;
  };
  if (!body.pendingSessionId) {
    return NextResponse.json({ ok: false, error: 'pendingSessionId required' }, { status: 400 });
  }
  if (!body.totpCode && !body.recoveryCode) {
    return NextResponse.json({ ok: false, error: 'totpCode or recoveryCode required' }, { status: 400 });
  }

  try {
    const result = await completeMfa({
      pendingSessionId: body.pendingSessionId,
      totpCode: body.totpCode,
      recoveryCode: body.recoveryCode,
      deviceInfo: {
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
      },
    });

    const res = NextResponse.json({ ok: true, userId: result.userId });
    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 15 * 60,
    });
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
