/**
 * 收入二次密码 (income secondary password) —— 员工收入/薪酬数据的独立解锁闸门
 *
 * 需求: 员工收入必须输入"二次密码"才能查看 (独立于登录密码)。
 *
 * 设计:
 *   - PIN 哈希 (scrypt, 复用 lib/auth/password) 存 KvStore collection 'comp_income_pin'。
 *   - 校验通过 → 签发短时 (15min) HMAC 解锁令牌, 落 HttpOnly cookie。
 *   - 收入类接口校验该 cookie; 未解锁则返回 { locked: true }。
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import { kvStore } from '../infra/drizzle-schema';
import { hashPassword, verifyPassword } from '../auth/password';

const COLLECTION = 'comp_income_pin';
export const COMP_INCOME_COOKIE = 'tandem_income_unlock';
const UNLOCK_TTL_SEC = 15 * 60;

const SECRET = (() => {
  const s = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!s || s === 'change-me-in-prod-use-openssl-rand-base64-32') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET / NEXTAUTH_SECRET 必须在生产环境配置');
    }
    return 'dev-only-secret-do-not-use-in-prod';
  }
  return s;
})();

// ---------------------------------------------------------------------------
// PIN 策略 + 存储
// ---------------------------------------------------------------------------

export function validatePin(pin: string): string | null {
  if (!/^[0-9]{6,12}$/.test(pin)) return '二次密码需为 6-12 位数字';
  if (/^(\d)\1+$/.test(pin)) return '不可全部为相同数字';
  if (['123456', '654321', '000000', '123123'].includes(pin)) return '过于简单, 请更换';
  return null;
}

export async function hasIncomePin(userId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, COLLECTION), eq(kvStore.id, userId)))
    .limit(1);
  return !!(rows[0]?.data as { hash?: string } | undefined)?.hash;
}

export async function setIncomePin(
  userId: string,
  tenantId: string,
  pin: string,
): Promise<void> {
  const hash = hashPassword(pin);
  await db
    .insert(kvStore)
    .values({ collection: COLLECTION, id: userId, data: { id: userId, hash }, tenantId })
    .onConflictDoUpdate({
      target: [kvStore.collection, kvStore.id],
      set: { data: { id: userId, hash }, tenantId, updatedAt: new Date() },
    });
}

export async function verifyIncomePin(userId: string, pin: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(kvStore)
    .where(and(eq(kvStore.collection, COLLECTION), eq(kvStore.id, userId)))
    .limit(1);
  const stored = (rows[0]?.data as { hash?: string } | undefined)?.hash;
  return stored ? verifyPassword(pin, stored) : false;
}

// ---------------------------------------------------------------------------
// 解锁令牌 (HMAC, 15min)
// ---------------------------------------------------------------------------

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function mintUnlockToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SEC;
  const body = Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyUnlockToken(token: string | undefined, userId: string): boolean {
  if (!token) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      sub: string;
      exp: number;
    };
    return sub === userId && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export const UNLOCK_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: UNLOCK_TTL_SEC,
};
