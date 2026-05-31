/**
 * Identity Store · 手机 OTP + 第三方身份绑定 (留好数据库)
 *
 * 落 KvStore 通用表 (collection/id/data), 无需迁移. 三个 collection:
 *   - auth_phone_otp      : 手机验证码 (id=phone, 存 codeHash + 过期 + 尝试次数)
 *   - auth_phone_binding  : 手机号 → userId 绑定 (id=phone)
 *   - auth_wechat_binding : 微信 unionid/openid → userId 绑定 (id=unionid)
 *
 * DATABASE_URL 存在 → 落 PG KvStore; 否则模块级 Map (dev/e2e).
 * OTP 只存 hash, 绝不明文落库 (安全).
 */

import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

const COLL_OTP = 'auth_phone_otp';
const COLL_PHONE = 'auth_phone_binding';
const COLL_WECHAT = 'auth_wechat_binding';

const OTP_SALT = process.env.NEXTAUTH_SECRET ?? 'tandem-otp-dev-salt';

// ---------------------------------------------------------------------------
// 通用 KV 读写 (DB 优先, 无 DB 走内存 Map). 镜像 DrizzleKvRepository 模式.
// ---------------------------------------------------------------------------

const mem = new Map<string, unknown>();
const memKey = (collection: string, id: string) => `${collection}:${id}`;
const isDbBacked = () => !!process.env.DATABASE_URL;

async function kvGet<T>(collection: string, id: string): Promise<T | null> {
  if (isDbBacked()) {
    const { db } = await import('@/lib/infra/drizzle-client');
    const { kvStore } = await import('@/lib/infra/drizzle-schema');
    const rows = await db
      .select()
      .from(kvStore)
      .where(and(eq(kvStore.collection, collection), eq(kvStore.id, id)))
      .limit(1);
    return rows[0] ? (rows[0].data as T) : null;
  }
  return (mem.get(memKey(collection, id)) as T) ?? null;
}

async function kvSet<T extends object>(collection: string, id: string, data: T): Promise<void> {
  if (isDbBacked()) {
    const { db } = await import('@/lib/infra/drizzle-client');
    const { kvStore } = await import('@/lib/infra/drizzle-schema');
    await db
      .insert(kvStore)
      .values({ collection, id, data: data as object })
      .onConflictDoUpdate({
        target: [kvStore.collection, kvStore.id],
        set: { data: data as object, updatedAt: new Date() },
      });
    return;
  }
  mem.set(memKey(collection, id), data);
}

async function kvDel(collection: string, id: string): Promise<void> {
  if (isDbBacked()) {
    const { db } = await import('@/lib/infra/drizzle-client');
    const { kvStore } = await import('@/lib/infra/drizzle-schema');
    await db.delete(kvStore).where(and(eq(kvStore.collection, collection), eq(kvStore.id, id)));
    return;
  }
  mem.delete(memKey(collection, id));
}

// ---------------------------------------------------------------------------
// 手机验证码 (OTP)
// ---------------------------------------------------------------------------

export interface PhoneOtpRecord {
  id: string; // = phone
  codeHash: string;
  expiresAt: number; // ms
  attempts: number;
  createdAt: number;
}

export function hashOtp(phone: string, code: string): string {
  return createHmac('sha256', OTP_SALT).update(`${phone}:${code}`).digest('hex');
}

export async function saveOtp(phone: string, code: string, ttlMs: number): Promise<void> {
  const rec: PhoneOtpRecord = {
    id: phone,
    codeHash: hashOtp(phone, code),
    expiresAt: Date.now() + ttlMs,
    attempts: 0,
    createdAt: Date.now(),
  };
  await kvSet(COLL_OTP, phone, rec);
}

export async function getOtp(phone: string): Promise<PhoneOtpRecord | null> {
  return kvGet<PhoneOtpRecord>(COLL_OTP, phone);
}

export async function bumpOtpAttempts(phone: string, rec: PhoneOtpRecord): Promise<void> {
  await kvSet(COLL_OTP, phone, { ...rec, attempts: rec.attempts + 1 });
}

export async function clearOtp(phone: string): Promise<void> {
  await kvDel(COLL_OTP, phone);
}

// ---------------------------------------------------------------------------
// 身份绑定 (手机 / 微信 → userId)
// ---------------------------------------------------------------------------

export interface IdentityBinding {
  id: string; // phone 或 unionid
  userId: string;
  boundAt: number;
}

export async function getPhoneBinding(phone: string): Promise<IdentityBinding | null> {
  return kvGet<IdentityBinding>(COLL_PHONE, phone);
}

export async function setPhoneBinding(phone: string, userId: string): Promise<void> {
  await kvSet(COLL_PHONE, phone, { id: phone, userId, boundAt: Date.now() } satisfies IdentityBinding);
}

export async function getWechatBinding(unionId: string): Promise<IdentityBinding | null> {
  return kvGet<IdentityBinding>(COLL_WECHAT, unionId);
}

export async function setWechatBinding(unionId: string, userId: string): Promise<void> {
  await kvSet(COLL_WECHAT, unionId, { id: unionId, userId, boundAt: Date.now() } satisfies IdentityBinding);
}
