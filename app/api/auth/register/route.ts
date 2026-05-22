import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { registerWithInvite, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';

/**
 * POST /api/auth/register
 *
 * Body: { email, password, name, inviteCode }
 *
 * 邀请制注册. 注册即登录, 颁发 access + refresh cookie.
 */
export async function POST(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `register:${ip}`, limit: 10, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'too many attempts', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSec) } },
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
  const name = String(body.name ?? '');
  const inviteCode = String(body.inviteCode ?? '');
  const privacyConsent = body.privacyConsent as { version?: string; consentedAt?: string } | undefined;
  if (!email || !password || !name || !inviteCode) {
    return NextResponse.json(
      { ok: false, error: 'email, password, name, inviteCode 均为必填' },
      { status: 400 }
    );
  }
  // PIPL §13/§14 + GDPR Art 7: 注册必须显式同意隐私政策
  if (!privacyConsent || !privacyConsent.version || !privacyConsent.consentedAt) {
    return NextResponse.json(
      { ok: false, error: '请勾选同意《Tandem 隐私政策》' },
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

    // 记录同意时间戳到审计链 (PIPL §16: 同意可撤回, 但需可证)
    try {
      const { getAuditLog } = await import('@/lib/audit/log');
      const dev = extractDeviceInfo(req);
      await getAuditLog().append('user.privacy_consent', result.userId, {
        targetId: result.userId,
        targetType: 'user',
        metadata: {
          version: privacyConsent.version,
          consentedAt: privacyConsent.consentedAt,
          ip: dev.ip,
          userAgent: dev.userAgent,
        },
      });
    } catch (auditErr) {
      // 审计失败不阻塞注册, 但记录 warning
      // eslint-disable-next-line no-console
      console.warn('[register] privacy consent audit failed:', auditErr);
    }

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
