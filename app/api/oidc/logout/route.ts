/**
 * GET /api/oidc/logout — RP-Initiated Logout (end_session_endpoint)
 *
 * 清除 Tandem IdP 自身会话 cookie, 并按 post_logout_redirect_uri (白名单校验) 回跳。
 * 参数: id_token_hint? (含 aud=client_id), post_logout_redirect_uri?, state?, client_id?
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '@/lib/auth/session';
import { getClient, isPostLogoutRedirectAllowed } from '@/lib/oidc/clients';
import { verifyRs256 } from '@/lib/oidc/tokens';
import { resolveIssuer } from '@/lib/oidc/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await boot();
  const { searchParams } = new URL(req.url);
  // 反代后 req.url 的 origin 是内部监听地址 (0.0.0.0:3000); 用对外公网基址.
  const publicBase = resolveIssuer(req.headers);
  const postLogoutRedirectUri = searchParams.get('post_logout_redirect_uri');
  const state = searchParams.get('state');
  const idTokenHint = searchParams.get('id_token_hint');
  let clientId = searchParams.get('client_id') ?? undefined;

  // 从 id_token_hint 解析 client_id (aud)
  if (!clientId && idTokenHint) {
    const payload = await verifyRs256(idTokenHint);
    if (payload?.aud) clientId = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  }

  // 默认回跳: 登录页
  let target = `${publicBase}/login`;
  if (postLogoutRedirectUri && clientId) {
    const client = await getClient(clientId);
    if (client && isPostLogoutRedirectAllowed(client, postLogoutRedirectUri)) {
      const u = new URL(postLogoutRedirectUri);
      if (state) u.searchParams.set('state', state);
      target = u.toString();
    }
  }

  const res = NextResponse.redirect(target);
  res.cookies.delete(COOKIE_ACCESS);
  res.cookies.delete(COOKIE_REFRESH);
  return res;
}
