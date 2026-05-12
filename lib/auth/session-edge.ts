/**
 * Edge-runtime 兼容的 access token 校验.
 *
 * 与 lib/auth/session.ts 的关系:
 *   - session.ts 用 Node `crypto` (sign + verify, Edge 不可用)
 *   - 本文件用 Web Crypto subtle.verify, Edge 可用
 *   - 二者用同一 SESSION_SECRET, HS256 算法, 输出格式完全兼容
 *
 * 用途: middleware.ts 全局 auth gate 用此函数, 终端 endpoint 仍用 session.ts.
 */

import type { SessionPayload } from './session';

const enc = new TextEncoder();

function base64UrlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64UrlToString(s: string): string {
  return new TextDecoder().decode(base64UrlToBytes(s));
}

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!s) return 'dev-only-secret-do-not-use-in-prod';
  return s;
}

/**
 * Edge-compatible HS256 verify. 与 session.ts 的 verifyAccessToken 输出兼容.
 * 失败返回 null (不抛错, 调用方根据 null 决定是否拦截).
 */
export async function verifyAccessTokenEdge(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = base64UrlToBytes(s);
    const data = enc.encode(`${h}.${b}`);
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      sig as unknown as ArrayBuffer,
      data as unknown as ArrayBuffer,
    );
    if (!ok) return null;

    const payload = JSON.parse(base64UrlToString(b)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
