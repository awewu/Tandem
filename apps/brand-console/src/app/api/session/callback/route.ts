import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ssoEnabled, ssoExchange, issueSession,
  SESSION_COOKIE, OIDC_STATE_COOKIE,
} from '../../../../lib/brand';

// GET /api/session/callback?code&state — OIDC 回调：校验 state → 换取身份 → 建会话。
export async function GET(req: Request) {
  if (!ssoEnabled()) return NextResponse.redirect(new URL('/?err=sso_disabled', req.url));
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(new URL('/?err=missing_code', req.url));

  const store = await cookies();
  const expected = store.get(OIDC_STATE_COOKIE)?.value;
  if (!expected || expected !== state) {
    return NextResponse.redirect(new URL('/?err=bad_state', req.url));
  }

  let session;
  try {
    session = await ssoExchange(code);
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/?err=sso_exchange`, req.url));
  }
  if (!session) return NextResponse.redirect(new URL('/?err=not_authorized', req.url));

  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(SESSION_COOKIE, issueSession(session), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  });
  res.cookies.set(OIDC_STATE_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
