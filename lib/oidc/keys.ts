/**
 * lib/oidc/keys.ts · OIDC 签名密钥管理 (RS256)
 *
 * ID Token / Access Token 用 RSA 非对称签名, 接入方通过 JWKS 公钥自助验签,
 * 无需共享密钥 — 这是标准 OIDC 与现有自研 HS256 会话 (lib/auth/session.ts) 的关键区别.
 *
 * 私钥来源优先级:
 *   1. 环境变量 OIDC_PRIVATE_KEY (PEM / PKCS8, 生产推荐, 多副本一致)
 *   2. KvStore collection=oidc_keys id=active (首次自动生成并持久化, dev/单机)
 *
 * 无第三方依赖, 全部走 Node 内置 crypto.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  createHash,
  type KeyObject,
} from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { kvStore } from '@/lib/infra/drizzle-schema';

const COLL = 'oidc_keys';
const ACTIVE_ID = 'active';

interface StoredKey {
  privatePem: string;
  createdAt: string;
}

export interface SigningKey {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** key id (公钥 JWK thumbprint), 写入 JWT header.kid 与 JWKS */
  kid: string;
}

type KeyGlobals = { __tandem_oidc_key__?: SigningKey | null };
const _g = globalThis as typeof globalThis & KeyGlobals;

/** RFC 7638 JWK thumbprint (base64url) 作为 kid */
function jwkThumbprint(publicKey: KeyObject): string {
  const jwk = publicKey.export({ format: 'jwk' }) as { e: string; kty: string; n: string };
  // 字段必须按字典序且无空格 (RFC 7638)
  const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
  return createHash('sha256').update(canonical).digest('base64url');
}

function buildSigningKey(privatePem: string): SigningKey {
  const privateKey = createPrivateKey(privatePem);
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, kid: jwkThumbprint(publicKey) };
}

async function loadFromStore(): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(kvStore)
      .where(and(eq(kvStore.collection, COLL), eq(kvStore.id, ACTIVE_ID)))
      .limit(1);
    const data = rows[0]?.data as StoredKey | undefined;
    return data?.privatePem ?? null;
  } catch {
    // DB 不可用 (单元测试 / 无 DATABASE_URL) → 交由上层生成 ephemeral key
    return null;
  }
}

async function persistToStore(privatePem: string): Promise<void> {
  try {
    const item: StoredKey = { privatePem, createdAt: new Date().toISOString() };
    await db
      .insert(kvStore)
      .values({ collection: COLL, id: ACTIVE_ID, data: item as object, tenantId: 'default' })
      .onConflictDoUpdate({
        target: [kvStore.collection, kvStore.id],
        set: { data: item as object, updatedAt: new Date() },
      });
  } catch {
    // 持久化失败不阻塞: ephemeral key 仍可用于本进程 (重启后会重新生成)
  }
}

function generatePem(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
}

/**
 * 获取当前签名密钥 (进程内缓存 + DB 持久化).
 * 首次调用若无 env / DB 私钥则生成并落库 (幂等).
 */
export async function getSigningKey(): Promise<SigningKey> {
  if (_g.__tandem_oidc_key__) return _g.__tandem_oidc_key__;

  const fromEnv = process.env.OIDC_PRIVATE_KEY?.trim();
  if (fromEnv) {
    const key = buildSigningKey(fromEnv.replace(/\\n/g, '\n'));
    _g.__tandem_oidc_key__ = key;
    return key;
  }

  let pem = await loadFromStore();
  if (!pem) {
    if (process.env.NODE_ENV === 'production') {
      // 生产不允许 DB 临时密钥之外的隐式行为, 但若 DB 可写仍允许 (单租户私有化部署).
      // 强烈建议显式配置 OIDC_PRIVATE_KEY.
      // eslint-disable-next-line no-console
      console.warn('[oidc] OIDC_PRIVATE_KEY 未配置, 将生成并持久化到 DB (建议生产显式配置 env)');
    }
    pem = generatePem();
    await persistToStore(pem);
  }
  const key = buildSigningKey(pem);
  _g.__tandem_oidc_key__ = key;
  return key;
}

/** JWKS 公钥集 (供 /.well-known/jwks.json) */
export async function getJwks(): Promise<{ keys: Array<Record<string, string>> }> {
  const { publicKey, kid } = await getSigningKey();
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, string>;
  return {
    keys: [
      {
        ...jwk,
        kid,
        use: 'sig',
        alg: 'RS256',
      },
    ],
  };
}

/** 测试用: 清空进程缓存 */
export function _resetSigningKeyCache(): void {
  _g.__tandem_oidc_key__ = null;
}
