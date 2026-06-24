/**
 * lib/oidc/tokens.ts · OIDC JWT 签发与验签 (RS256, 无第三方依赖)
 *
 * id_token / access_token 均为 RS256 JWT, header 带 kid (对应 JWKS).
 * 接入方资源服务器可用公钥离线验签, 无需回查 IdP.
 */

import { createSign, createVerify } from 'crypto';
import { getSigningKey } from './keys';

export const ID_TOKEN_TTL_SEC = 60 * 60;        // 1h
export const ACCESS_TOKEN_TTL_SEC = 60 * 60;    // 1h

function b64u(s: string | Buffer): string {
  return Buffer.from(s).toString('base64url');
}

interface JwtHeader {
  alg: 'RS256';
  typ: string;
  kid: string;
}

export interface BaseJwtPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  iat: number;
  exp: number;
  [key: string]: unknown;
}

async function signRs256(payload: Record<string, unknown>, typ = 'JWT'): Promise<string> {
  const { privateKey, kid } = await getSigningKey();
  const header: JwtHeader = { alg: 'RS256', typ, kid };
  const headerB64 = b64u(JSON.stringify(header));
  const payloadB64 = b64u(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${sig}`;
}

/** 验签并返回 payload (校验 RS256 + exp). 失败返回 null. */
export async function verifyRs256<T extends BaseJwtPayload = BaseJwtPayload>(
  token: string,
): Promise<T | null> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const { publicKey } = await getSigningKey();
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    verifier.end();
    const ok = verifier.verify(publicKey, Buffer.from(s, 'base64url'));
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as T;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ID Token
// ---------------------------------------------------------------------------

export interface SignIdTokenInput {
  issuer: string;
  clientId: string;
  /** sub + 按 scope 解析出的 claims (来自 buildClaimsForUser) */
  claims: Record<string, unknown> & { sub: string };
  nonce?: string;
  authTime: number;
}

export async function signIdToken(input: SignIdTokenInput): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    ...input.claims,
    iss: input.issuer,
    aud: input.clientId,
    iat: now,
    exp: now + ID_TOKEN_TTL_SEC,
    auth_time: input.authTime,
  };
  if (input.nonce) payload.nonce = input.nonce;
  return signRs256(payload);
}

// ---------------------------------------------------------------------------
// Access Token (JWT, 供 userinfo / 接入方资源服务器校验)
// ---------------------------------------------------------------------------

export interface AccessTokenPayload extends BaseJwtPayload {
  client_id: string;
  scope: string;
  tenant: string;
  token_use: 'access';
}

export interface SignAccessTokenInput {
  issuer: string;
  clientId: string;
  userId: string;
  scope: string;
  tenantId: string;
}

export async function signAccessToken(input: SignAccessTokenInput): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    iss: input.issuer,
    sub: input.userId,
    aud: `${input.issuer}/api/oidc/userinfo`,
    client_id: input.clientId,
    scope: input.scope,
    tenant: input.tenantId,
    token_use: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SEC,
  };
  return signRs256(payload, 'at+jwt');
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  const payload = await verifyRs256<AccessTokenPayload>(token);
  if (!payload || payload.token_use !== 'access') return null;
  return payload;
}
