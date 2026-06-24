/**
 * lib/oidc/store.ts · 授权码 + 刷新令牌持久化 (KvStore)
 *
 * 授权码: 一次性, 60s 时效, 消费即标记 consumed.
 * 刷新令牌: 仅 sha256 入库, 旋转策略 (用旧的换新, 旧的立即吊销).
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { kvStore } from '@/lib/infra/drizzle-schema';
import type { OAuthAuthCode, OAuthRefreshToken, CodeChallengeMethod } from './types';

const CODE_COLL = 'oidc_auth_codes';
const RT_COLL = 'oidc_refresh_tokens';

const AUTH_CODE_TTL_MS = 60 * 1000; // 60s (OIDC 建议 ≤ 10min, 取保守值)
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ---------------------------------------------------------------------------
// 授权码
// ---------------------------------------------------------------------------

export interface IssueAuthCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: CodeChallengeMethod;
  authTime: number;
  tenantId: string;
}

/** 颁发授权码, 返回明文 code (= 主键, 高熵随机) */
export async function issueAuthCode(input: IssueAuthCodeInput): Promise<string> {
  const code = randomBytes(32).toString('base64url');
  const now = Date.now();
  const item: OAuthAuthCode = {
    code,
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scope: input.scope,
    nonce: input.nonce,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    authTime: input.authTime,
    expiresAt: now + AUTH_CODE_TTL_MS,
    consumed: false,
    tenantId: input.tenantId,
    createdAt: new Date(now).toISOString(),
  };
  await db.insert(kvStore).values({
    collection: CODE_COLL,
    id: code,
    data: item as object,
    tenantId: input.tenantId,
  });
  return code;
}

/**
 * 消费授权码 (一次性). 校验存在/未过期/未用过, 成功后标记 consumed.
 * 返回授权码记录, 失败返回 null.
 */
export async function consumeAuthCode(code: string): Promise<OAuthAuthCode | null> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, CODE_COLL), eq(kvStore.id, code)))
    .limit(1);
  const rec = rows[0]?.data as OAuthAuthCode | undefined;
  if (!rec) return null;
  if (rec.consumed || rec.expiresAt < Date.now()) {
    // 重放或过期: 直接删除剩余记录
    await db.delete(kvStore).where(and(eq(kvStore.collection, CODE_COLL), eq(kvStore.id, code)));
    return null;
  }
  // 标记消费 (即删除, 一次性)
  await db.delete(kvStore).where(and(eq(kvStore.collection, CODE_COLL), eq(kvStore.id, code)));
  return rec;
}

/** PKCE 校验: code_verifier 对应 code_challenge */
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: CodeChallengeMethod = 'S256',
): boolean {
  let computed: string;
  if (method === 'S256') {
    computed = createHash('sha256').update(verifier).digest('base64url');
  } else {
    computed = verifier;
  }
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// 刷新令牌
// ---------------------------------------------------------------------------

export interface IssueRefreshInput {
  clientId: string;
  userId: string;
  scope: string;
  tenantId: string;
}

/** 颁发刷新令牌, 返回明文 (sha256 入库) */
export async function issueRefreshToken(input: IssueRefreshInput): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const id = sha256(token);
  const now = Date.now();
  const item: OAuthRefreshToken = {
    id,
    clientId: input.clientId,
    userId: input.userId,
    scope: input.scope,
    expiresAt: now + REFRESH_TTL_MS,
    revoked: false,
    tenantId: input.tenantId,
    createdAt: new Date(now).toISOString(),
  };
  await db.insert(kvStore).values({
    collection: RT_COLL,
    id,
    data: item as object,
    tenantId: input.tenantId,
  });
  return token;
}

/** 校验刷新令牌明文, 返回记录 (未吊销/未过期), 否则 null */
export async function findRefreshToken(token: string): Promise<OAuthRefreshToken | null> {
  const id = sha256(token);
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, RT_COLL), eq(kvStore.id, id)))
    .limit(1);
  const rec = rows[0]?.data as OAuthRefreshToken | undefined;
  if (!rec) return null;
  if (rec.revoked || rec.expiresAt < Date.now()) return null;
  return rec;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const id = sha256(token);
  await db.delete(kvStore).where(and(eq(kvStore.collection, RT_COLL), eq(kvStore.id, id)));
}

/** 吊销某用户在某 client 下的全部刷新令牌 (登出 / 安全事件) */
export async function revokeRefreshTokensForUser(
  userId: string,
  tenantId: string,
  clientId?: string,
): Promise<number> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, RT_COLL), eq(kvStore.tenantId, tenantId)));
  let count = 0;
  for (const r of rows) {
    const rec = r.data as OAuthRefreshToken;
    if (rec.userId !== userId) continue;
    if (clientId && rec.clientId !== clientId) continue;
    await db.delete(kvStore).where(and(eq(kvStore.collection, RT_COLL), eq(kvStore.id, rec.id)));
    count++;
  }
  return count;
}
