/**
 * 一次性: 重置 bootstrap owner 密码到一个简单值 (仅本地测试).
 * 用法:
 *   node scripts/reset-owner-password.mjs <email> <newPassword>
 *   默认: admin@tandem.local / Test1234!!
 *
 * 直接走 PG, 绕过 evaluatePassword 强度校验.
 * 密码格式: scrypt$N$r$p$salt$hash (与 lib/auth/password.ts 完全一致).
 */
import { randomBytes, scryptSync } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import pg from 'pg';

// 手动加载 .env.local
function loadEnv() {
  try {
    const txt = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}
loadEnv();

const email = process.argv[2] ?? 'admin@tandem.local';
const password = process.argv[3] ?? 'Test1234!!';
const N = Number(process.env.SCRYPT_N ?? 16384);

function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 64, { N, r: 8, p: 1 }).toString('hex');
  return `scrypt$${N}$8$1$${salt}$${hash}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const u = await client.query('SELECT id FROM "User" WHERE email = $1 LIMIT 1', [email]);
    if (u.rows.length === 0) {
      console.error(`User ${email} not found in "User" table.`);
      process.exit(1);
    }
    const userId = u.rows[0].id;
    const hash = hashPassword(password);
    const data = JSON.stringify({ id: userId, hash, historyHashes: [] });

    // KvStore upsert (collection='auth_password', id=userId)
    await client.query(
      `INSERT INTO "KvStore" (collection, id, data, "tenantId", "createdAt", "updatedAt")
       VALUES ('auth_password', $1, $2::jsonb, 'default', NOW(), NOW())
       ON CONFLICT (collection, id) DO UPDATE
         SET data = EXCLUDED.data, "updatedAt" = NOW()`,
      [userId, data]
    );

    // 清除锁定 / 失败计数 (auth_user_extras)
    const extras = await client.query(
      `SELECT data FROM "KvStore" WHERE collection = 'auth_user_extras' AND id = $1`,
      [userId]
    );
    const prev = extras.rows[0]?.data ?? { id: userId };
    const cleared = { ...prev, id: userId, failedLoginCount: 0, lockedUntil: null };
    await client.query(
      `INSERT INTO "KvStore" (collection, id, data, "tenantId", "createdAt", "updatedAt")
       VALUES ('auth_user_extras', $1, $2::jsonb, 'default', NOW(), NOW())
       ON CONFLICT (collection, id) DO UPDATE
         SET data = EXCLUDED.data, "updatedAt" = NOW()`,
      [userId, JSON.stringify(cleared)]
    );

    console.log(`OK. ${email} (${userId}) password reset to: ${password}`);
    console.log(`Lock cleared. failedLoginCount=0, lockedUntil=null`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
