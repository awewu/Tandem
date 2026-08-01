import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { login, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS, DESKTOP_SESSION_TTL_SEC } from '@/lib/auth/session';
import { rateLimit, POLICIES, getClientIp } from '@/lib/infra/rate-limit';
import { logger } from '@/lib/infra/logger';
import { withApiLog } from '@/lib/api-log/with-api-log';

/**
 * POST /api/auth/login
 * Body: { email, password, rememberMe? }
 *
 * §T10 防暴力: per-IP sliding window 限流 (默认 5/h, env 可调)
 */
async function POSTApiHandler(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `login:${ip}`, ...POLICIES.login() });
  if (!rl.allowed) {
    logger.warn({ ip, totalHits: rl.totalHits }, '[auth] login rate-limited');
    return NextResponse.json(
      { ok: false, error: 'too many attempts, please retry later', code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetSec),
          'X-RateLimit-Limit': String(POLICIES.login().limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const email = String(body.email ?? '');
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'email + password required' }, { status: 400 });
  }

  // §desktop / §mobile: 桌面端 (Tauri) 或移动端 (Capacitor) 在登录请求上携带此 header → 7 天滑动长会话.
  //   web 端勾选 rememberMe 时也给 7 天登录态, 避免浏览器不保存密码时频繁重登.
  const clientKind = req.headers.get('x-tandem-client');
  const rememberMe = body.rememberMe === true;
  const longSession = clientKind === 'desktop' || clientKind === 'mobile' || rememberMe;

  try {
    const result = await login({
      email,
      password,
      longSession,
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
      // P0-4: 客户端见此字段为 true 应强跳 /settings/security 启用 MFA 才能继续业务路由
      mfaEnrollmentRequired: result.mfaEnrollmentRequired ?? false,
    });

    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: longSession ? DESKTOP_SESSION_TTL_SEC : 24 * 60 * 60,
    });
    if (result.refreshToken) {
      res.cookies.set(COOKIE_REFRESH, result.refreshToken, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: longSession ? DESKTOP_SESSION_TTL_SEC : 30 * 24 * 3600,
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

export const POST = withApiLog(POSTApiHandler, { route: '/api/auth/login' });
