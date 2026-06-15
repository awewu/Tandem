import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { changePassword, AuthError } from '@/lib/auth/native';
import { requireAuth } from '@/lib/auth/require-auth';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/auth/session';
import { rateLimit, POLICIES, getClientIp } from '@/lib/infra/rate-limit';
import { logger } from '@/lib/infra/logger';

/**
 * POST /api/auth/change-password
 * Body: { oldPassword, newPassword }
 *
 * 自助改密 (密码轮换体系入口):
 *   - 需登录 (requireAuth)
 *   - 验旧密 + 新密强度 + 历史复用 (lib/auth/native.changePassword)
 *   - 成功后撤销全部会话 → 清 cookie, 客户端需重新登录
 *   - per-IP 限流复用 login 策略, 防爆破
 */
export async function POST(req: NextRequest) {
  await boot();

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `change-password:${ip}`, ...POLICIES.login() });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'too many attempts, please retry later', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSec) } },
    );
  }

  let body: Record<string, string> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  if (!body.oldPassword || !body.newPassword) {
    return NextResponse.json(
      { ok: false, error: 'oldPassword + newPassword required' },
      { status: 400 },
    );
  }

  try {
    await changePassword({
      userId: auth.userId,
      oldPassword: body.oldPassword,
      newPassword: body.newPassword,
      deviceInfo: {
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
      },
    });

    // 全部会话已撤销 → 清 cookie, 强制重新登录
    const res = NextResponse.json({ ok: true, reauth: true });
    res.cookies.delete(COOKIE_ACCESS);
    res.cookies.delete(COOKIE_REFRESH);
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, error: err.message },
        { status: err.httpStatus },
      );
    }
    logger.error({ err: (err as Error).message }, '[auth] change-password failed');
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
