import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { refreshSession, AuthError } from '@/lib/auth/native';
import { COOKIE_ACCESS, COOKIE_REFRESH, SESSION_COOKIE_OPTIONS } from '@/lib/auth/session';

/**
 * POST /api/auth/refresh
 *
 * 用 httpOnly refresh cookie (tandem_rt) 换发新的 15 分钟 access token (tandem_at),
 * 并轮转 refresh token (滑动 30 天). 客户端在 access token 过期 / 401 时静默调用.
 *
 * 失败 (refresh 无效 / 过期 / 撤销) → 清两枚 cookie + 401, 客户端据此跳登录.
 */
export async function POST(req: NextRequest) {
  await boot();

  const refreshToken = req.cookies.get(COOKIE_REFRESH)?.value;
  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: 'no refresh token' }, { status: 401 });
  }

  try {
    const result = await refreshSession(refreshToken, {
      userAgent: req.headers.get('user-agent') ?? undefined,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
    });

    const res = NextResponse.json({
      ok: true,
      userId: result.userId,
      mfaEnrollmentRequired: result.mfaEnrollmentRequired ?? false,
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
    const res =
      err instanceof AuthError
        ? NextResponse.json(
            { ok: false, code: err.code, error: err.message },
            { status: err.httpStatus },
          )
        : NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
    // refresh 失效 → 清除两枚 cookie, 强制重新登录
    res.cookies.delete(COOKIE_ACCESS);
    res.cookies.delete(COOKIE_REFRESH);
    return res;
  }
}
