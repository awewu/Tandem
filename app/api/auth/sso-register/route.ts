import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { registerWithSso, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';

/**
 * POST /api/auth/sso-register
 *
 * 内部员工自助注册（无需邀请码）
 * Body: { email, password, name, employeeId? }
 *
 * 校验: 邮箱域名必须在 INTERNAL_EMAIL_DOMAINS 白名单中
 * 成功: 自动分配 ['employee'] 角色，注册即登录
 */
export async function POST(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `sso-register:${ip}`, limit: 20, windowSec: 3600, failClosed: true });
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
  const employeeId = body.employeeId ? String(body.employeeId) : undefined;

  if (!email || !password || !name) {
    return NextResponse.json(
      { ok: false, error: 'email, password, name 均为必填' },
      { status: 400 },
    );
  }

  try {
    const result = await registerWithSso({
      email,
      password,
      name,
      employeeId,
      deviceInfo: {
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
      },
    });

    const res = NextResponse.json({
      ok: true,
      userId: result.userId,
      requiresMfa: result.requiresMfa,
    });

    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 24 * 60 * 60,
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
