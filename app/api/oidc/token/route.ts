/**
 * POST /api/oidc/token — OIDC 令牌端点
 *
 * 支持:
 *   - grant_type=authorization_code (+ PKCE code_verifier)
 *   - grant_type=refresh_token (旋转: 旧令牌立即吊销, 颁发新令牌)
 *
 * Client 认证:
 *   - confidential: client_secret_basic (Authorization: Basic) 或 client_secret_post (body)
 *   - public:       仅 client_id + PKCE
 *
 * 返回: { access_token, token_type, expires_in, id_token?, refresh_token?, scope }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { resolveIssuer } from '@/lib/oidc/discovery';
import { getClient, verifySecret } from '@/lib/oidc/clients';
import {
  consumeAuthCode,
  verifyPkce,
  issueRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} from '@/lib/oidc/store';
import { signIdToken, signAccessToken, ACCESS_TOKEN_TTL_SEC } from '@/lib/oidc/tokens';
import { buildClaimsForUserId } from '@/lib/oidc/claims';
import { rateLimit, getClientIp } from '@/lib/infra/rate-limit';
import type { OAuthClient } from '@/lib/oidc/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json({ error, error_description: description }, { status });
}

/** 从 Basic header 或 body 解析 client 凭据 */
function extractClientCreds(
  req: NextRequest,
  body: URLSearchParams,
): { clientId: string | null; clientSecret: string | null } {
  const authz = req.headers.get('authorization');
  if (authz?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authz.slice(6), 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      if (idx >= 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, idx)),
          clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
        };
      }
    } catch {
      /* fallthrough */
    }
  }
  return {
    clientId: body.get('client_id'),
    clientSecret: body.get('client_secret'),
  };
}

/** confidential client 必须验密; public client 不验密 */
function authenticateClient(client: OAuthClient, clientSecret: string | null): boolean {
  if (client.type === 'public') return true;
  if (!client.secretHash || !clientSecret) return false;
  return verifySecret(clientSecret, client.secretHash);
}

export async function POST(req: NextRequest) {
  await boot();
  const ip = getClientIp(req.headers);
  const rl = await rateLimit({ key: `oidc-token:${ip}`, limit: 60, windowSec: 60, failClosed: true });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'temporarily_unavailable', error_description: 'rate limited' },
      { status: 429, headers: { 'Retry-After': String(rl.resetSec) } },
    );
  }

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/x-www-form-urlencoded')) {
    return err('invalid_request', 'content-type must be application/x-www-form-urlencoded');
  }
  const raw = await req.text();
  const body = new URLSearchParams(raw);
  const grantType = body.get('grant_type') ?? '';

  const { clientId, clientSecret } = extractClientCreds(req, body);
  if (!clientId) return err('invalid_client', 'client_id required', 401);
  const client = await getClient(clientId);
  if (!client || client.disabled) return err('invalid_client', 'unknown or disabled client', 401);
  if (!authenticateClient(client, clientSecret)) {
    return err('invalid_client', 'client authentication failed', 401);
  }
  if (!client.grantTypes.includes(grantType as OAuthClient['grantTypes'][number])) {
    return err('unauthorized_client', `grant_type ${grantType} not allowed`);
  }

  const issuer = resolveIssuer(req.headers);

  // -------------------------------------------------------------------------
  // authorization_code
  // -------------------------------------------------------------------------
  if (grantType === 'authorization_code') {
    const code = body.get('code') ?? '';
    const redirectUri = body.get('redirect_uri') ?? '';
    const codeVerifier = body.get('code_verifier') ?? '';
    if (!code) return err('invalid_request', 'code required');

    const rec = await consumeAuthCode(code);
    if (!rec) return err('invalid_grant', 'code invalid, expired or already used');
    if (rec.clientId !== client.id) return err('invalid_grant', 'code/client mismatch');
    if (rec.redirectUri !== redirectUri) return err('invalid_grant', 'redirect_uri mismatch');

    // PKCE
    if (rec.codeChallenge) {
      if (!codeVerifier) return err('invalid_grant', 'code_verifier required');
      if (!verifyPkce(codeVerifier, rec.codeChallenge, rec.codeChallengeMethod ?? 'S256')) {
        return err('invalid_grant', 'PKCE verification failed');
      }
    }

    const scopes = rec.scope.split(/\s+/).filter(Boolean);
    const claims = await buildClaimsForUserId(rec.userId, scopes);
    if (!claims) return err('invalid_grant', 'user no longer exists');

    const accessToken = await signAccessToken({
      issuer,
      clientId: client.id,
      userId: rec.userId,
      scope: rec.scope,
      tenantId: rec.tenantId,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      roles: Array.isArray(claims.roles) ? claims.roles.filter((r): r is string => typeof r === 'string') : [],
      mfaVerified: false,
    });
    const idToken = await signIdToken({
      issuer,
      clientId: client.id,
      claims,
      nonce: rec.nonce,
      authTime: rec.authTime,
    });

    let refreshToken: string | undefined;
    if (scopes.includes('offline_access') && client.grantTypes.includes('refresh_token')) {
      refreshToken = await issueRefreshToken({
        clientId: client.id,
        userId: rec.userId,
        scope: rec.scope,
        tenantId: rec.tenantId,
      });
    }

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SEC,
        id_token: idToken,
        ...(refreshToken ? { refresh_token: refreshToken } : {}),
        scope: rec.scope,
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  }

  // -------------------------------------------------------------------------
  // refresh_token
  // -------------------------------------------------------------------------
  if (grantType === 'refresh_token') {
    const presented = body.get('refresh_token') ?? '';
    if (!presented) return err('invalid_request', 'refresh_token required');
    const rec = await findRefreshToken(presented);
    if (!rec) return err('invalid_grant', 'refresh_token invalid, expired or revoked');
    if (rec.clientId !== client.id) return err('invalid_grant', 'refresh_token/client mismatch');

    // scope 收窄 (可选): 不能扩大
    const requestedScope = body.get('scope');
    let scope = rec.scope;
    if (requestedScope) {
      const orig = new Set(rec.scope.split(/\s+/).filter(Boolean));
      const narrowed = requestedScope.split(/\s+/).filter((s) => orig.has(s));
      if (!narrowed.includes('openid')) narrowed.unshift('openid');
      scope = narrowed.join(' ');
    }

    const claims = await buildClaimsForUserId(rec.userId, scope.split(/\s+/).filter(Boolean));
    if (!claims) return err('invalid_grant', 'user no longer exists');

    // 旋转: 吊销旧, 发新
    await revokeRefreshToken(presented);
    const newRefresh = await issueRefreshToken({
      clientId: client.id,
      userId: rec.userId,
      scope,
      tenantId: rec.tenantId,
    });

    const accessToken = await signAccessToken({
      issuer,
      clientId: client.id,
      userId: rec.userId,
      scope,
      tenantId: rec.tenantId,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      roles: Array.isArray(claims.roles) ? claims.roles.filter((r): r is string => typeof r === 'string') : [],
      mfaVerified: false,
    });
    const idToken = await signIdToken({
      issuer,
      clientId: client.id,
      claims,
      authTime: Math.floor(Date.now() / 1000),
    });

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SEC,
        id_token: idToken,
        refresh_token: newRefresh,
        scope,
      },
      { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } },
    );
  }

  return err('unsupported_grant_type', `grant_type ${grantType} not supported`);
}
