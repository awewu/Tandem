import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { ssoEnabled, ssoAuthorizeUrl, OIDC_STATE_COOKIE } from '../../../../lib/brand';

// GET /api/session/sso — 发起 OIDC 登录：置 CSRF state cookie，重定向到共享 IdP。
export async function GET() {
  if (!ssoEnabled()) {
    return NextResponse.json({ error: '未启用 SSO（缺少 SSO_ISSUER/SSO_CLIENT_ID）' }, { status: 400 });
  }
  const state = randomBytes(16).toString('hex');
  let url: string;
  try {
    url = await ssoAuthorizeUrl(state);
  } catch (e: any) {
    return NextResponse.json({ error: `SSO 发现失败：${e.message}` }, { status: 502 });
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(OIDC_STATE_COOKIE, state, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
