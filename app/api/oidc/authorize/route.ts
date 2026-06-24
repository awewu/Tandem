/**
 * GET /api/oidc/authorize — OIDC 授权端点 (Authorization Code + PKCE)
 *
 * 流程:
 *   1. 校验 client_id / redirect_uri (精确匹配, 防开放重定向) / response_type / scope
 *   2. 读取 Tandem 现有会话 cookie (tandem_at):
 *        - 未登录 → 302 跳 /login?next=<本授权 URL>, 登录后回跳继续
 *        - 已登录 → 颁发一次性 authorization code, 302 回 redirect_uri?code=&state=
 *   3. 受信内部 client (skipConsent=true) 跳过授权同意页
 *
 * 错误处理: 在 redirect_uri 校验通过前的错误直接 400 (不可信任 uri);
 *           之后的错误按 OAuth2 规范 302 回 redirect_uri?error=...
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken as verifySessionToken } from '@/lib/auth/session';
import { getClient, isRedirectUriAllowed } from '@/lib/oidc/clients';
import { issueAuthCode } from '@/lib/oidc/store';
import { SUPPORTED_SCOPES } from '@/lib/oidc/types';
import { resolveIssuer } from '@/lib/oidc/discovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectError(
  redirectUri: string,
  error: string,
  state: string | null,
  description?: string,
): NextResponse {
  const u = new URL(redirectUri);
  u.searchParams.set('error', error);
  if (description) u.searchParams.set('error_description', description);
  if (state) u.searchParams.set('state', state);
  return NextResponse.redirect(u.toString());
}

export async function GET(req: NextRequest) {
  await boot();
  const { searchParams } = new URL(req.url);

  const clientId = searchParams.get('client_id') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const responseType = searchParams.get('response_type') ?? '';
  const scopeParam = searchParams.get('scope') ?? '';
  const state = searchParams.get('state');
  const nonce = searchParams.get('nonce') ?? undefined;
  const codeChallenge = searchParams.get('code_challenge') ?? undefined;
  const codeChallengeMethodRaw = searchParams.get('code_challenge_method') ?? undefined;

  if (!clientId) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'client_id required' }, { status: 400 });
  }
  const client = await getClient(clientId);
  if (!client || client.disabled) {
    return NextResponse.json({ error: 'unauthorized_client', error_description: 'unknown or disabled client' }, { status: 400 });
  }
  if (!redirectUri || !isRedirectUriAllowed(client, redirectUri)) {
    // 不可信任的 redirect_uri → 不可回跳, 直接报错
    return NextResponse.json({ error: 'invalid_request', error_description: 'redirect_uri mismatch' }, { status: 400 });
  }

  // 以下错误均可安全回跳 redirect_uri
  if (responseType !== 'code') {
    return redirectError(redirectUri, 'unsupported_response_type', state, 'only code is supported');
  }
  if (!client.grantTypes.includes('authorization_code')) {
    return redirectError(redirectUri, 'unauthorized_client', state, 'authorization_code not allowed');
  }

  // scope 解析: 必须含 openid, 子集 ⊆ client.allowedScopes ∩ SUPPORTED_SCOPES
  const requested = scopeParam.split(/\s+/).filter(Boolean);
  const supported = new Set<string>(SUPPORTED_SCOPES as readonly string[]);
  const allowed = new Set(client.allowedScopes);
  const grantedScopes = requested.filter((s) => supported.has(s) && allowed.has(s));
  if (!grantedScopes.includes('openid')) {
    if (allowed.has('openid')) grantedScopes.unshift('openid');
    else return redirectError(redirectUri, 'invalid_scope', state, 'openid scope required');
  }

  // PKCE: public client 强制; method 默认 S256
  let codeChallengeMethod: 'S256' | 'plain' | undefined;
  if (codeChallenge) {
    codeChallengeMethod = codeChallengeMethodRaw === 'plain' ? 'plain' : 'S256';
  } else if (client.type === 'public') {
    return redirectError(redirectUri, 'invalid_request', state, 'PKCE code_challenge required for public client');
  }

  // 会话检查
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const session = at ? verifySessionToken(at) : null;
  // 对外公网基址: 反代后 req.url 的 origin 是内部监听地址 (0.0.0.0:3000),
  // 必须用 resolveIssuer (OIDC_ISSUER > X-Forwarded-Proto/Host) 拼对外跳转 URL.
  const publicBase = resolveIssuer(req.headers);
  const selfUrl = new URL(req.url);
  const nextPath = selfUrl.pathname + selfUrl.search;
  if (!session) {
    // 未登录 → 回跳登录页, 登录后原样回到本授权 URL
    const loginUrl = new URL('/login', publicBase);
    loginUrl.searchParams.set('next', nextPath);
    return NextResponse.redirect(loginUrl.toString());
  }

  // pendingMfaEnroll 用户不应能完成 SSO 授权
  if (session.pendingMfaEnroll) {
    const enrollUrl = new URL('/settings/security', publicBase);
    enrollUrl.searchParams.set('enrollMfa', '1');
    enrollUrl.searchParams.set('next', nextPath);
    return NextResponse.redirect(enrollUrl.toString());
  }

  // (受信内部 client 默认 skipConsent; 同意页留待后续, 当前默认放行)
  const code = await issueAuthCode({
    clientId: client.id,
    userId: session.sub,
    redirectUri,
    scope: grantedScopes.join(' '),
    nonce,
    codeChallenge,
    codeChallengeMethod,
    authTime: session.iat,
    tenantId: client.tenantId,
  });

  const out = new URL(redirectUri);
  out.searchParams.set('code', code);
  if (state) out.searchParams.set('state', state);
  return NextResponse.redirect(out.toString());
}
