import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { refreshSession, AuthError } from '@/lib/auth/native';
import {
  COOKIE_ACCESS,
  COOKIE_REFRESH,
  SESSION_COOKIE_OPTIONS,
  DESKTOP_SESSION_TTL_SEC,
} from '@/lib/auth/session';

/**
 * POST /api/auth/refresh
 *
 * §desktop 长会话滑动续期端点.
 *   - 仅桌面端 (header x-tandem-client: desktop) 可用 → web 端维持 24h 现状, 无自动续期.
 *   - 凭 tandem_rt cookie 续期: 轮换 refresh + 顺延 7 天, 重发 access.
 *   - 续期失败 (会话过期 / 已撤销 / 手动退出) → 清 cookie + 401, 客户端跳登录页.
 *
 * 此路由在 middleware PUBLIC_PREFIXES (/api/auth/) 白名单内, 不需要有效 access token 即可访问.
 */
export async function POST(req: NextRequest) {
  await boot();

  // 仅桌面端长会话. web 端没有 keep-alive 调用方, 直接拒绝以维持 24h 策略.
  if (req.headers.get('x-tandem-client') !== 'desktop') {
    return NextResponse.json({ ok: false, error: 'desktop_only' }, { status: 403 });
  }

  const refreshToken = req.cookies.get(COOKIE_REFRESH)?.value;
  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: 'no_refresh_token' }, { status: 401 });
  }

  try {
    const result = await refreshSession(refreshToken, {
      userAgent: req.headers.get('user-agent') ?? undefined,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_ACCESS, result.accessToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: DESKTOP_SESSION_TTL_SEC,
    });
    res.cookies.set(COOKIE_REFRESH, result.refreshToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: DESKTOP_SESSION_TTL_SEC,
    });
    return res;
  } catch (err) {
    // 续期失败 → 清 cookie 让用户重新登录
    const status = err instanceof AuthError ? err.httpStatus : 401;
    const code = err instanceof AuthError ? err.code : 'refresh_failed';
    const res = NextResponse.json({ ok: false, code }, { status });
    res.cookies.delete(COOKIE_ACCESS);
    res.cookies.delete(COOKIE_REFRESH);
    return res;
  }
}
