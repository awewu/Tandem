/**
 * GET /api/auth/sso/callback
 *
 * SSO OAuth 回调:
 *   1. 校验 state
 *   2. 用 code 换 access_token
 *   3. 查用户信息
 *   4. 查/创 User
 *   5. 创建 Session，Set-Cookie
 *   6. 302 跳回首页
 */

import { NextRequest } from 'next/server';
import { handleSsoCallback, getSsoState } from '@/lib/auth/sso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`SSO error: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  const stored = getSsoState(state);
  if (!stored) {
    return new Response('Invalid or expired state', { status: 400 });
  }

  try {
    const { accessToken, refreshToken } = await handleSsoCallback(
      stored.provider,
      code,
      state,
      state // stored state 就是原始 state
    );

    const cookie = [
      `tandem_session=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      `tandem_refresh=${refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
    ].join('; ');

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': cookie,
      },
    });
  } catch (err: any) {
    return new Response(`SSO callback failed: ${err.message}`, { status: 500 });
  }
}
