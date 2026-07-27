import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { completeMfa, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, SESSION_COOKIE_OPTIONS, DESKTOP_SESSION_TTL_SEC } from '@/lib/auth/session';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';
import { withApiLog } from '@/lib/api-log/with-api-log';

/**
 * POST /api/auth/mfa/verify
 * Body: { pendingSessionId, totpCode? | recoveryCode?, rememberMe? }
 *
 * 登录第二阶段, 提交 TOTP 或恢复码.
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `mfa-verify:${ip}`, limit: 10, windowSec: 3600, failClosed: true });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'too many MFA attempts', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSec) } },
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    pendingSessionId?: string;
    totpCode?: string;
    recoveryCode?: string;
    rememberMe?: boolean;
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
      longSession: body.rememberMe === true,
      deviceInfo: {
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
      },
    });

    const res = NextResponse.json({ ok: true, userId: result.userId });
    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: body.rememberMe === true ? DESKTOP_SESSION_TTL_SEC : 24 * 60 * 60,
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

export const POST = withApiLog(POSTApiHandler, { route: '/api/auth/mfa/verify' });
