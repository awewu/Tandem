#!/usr/bin/env node
/**
 * Seed demo users for cross-role demo / dev verification.
 *
 * Idempotent: skips emails that already exist.
 *
 * Creates 3 fixed accounts (in addition to the bootstrap owner):
 *   - employee@tandem.local  (role: employee)        — 张伟
 *   - manager@tandem.local   (role: manager)         — 王主管
 *   - hr@tandem.local        (role: steward)         — 李 HR
 *
 * All share the same password: Demo1234!@#  (passes the lib/auth/password.ts policy)
 *
 * Usage:
 *   node scripts/seed-demo-users.mjs
 */

import pg from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 简易 .env loader (.env then .env.local override) ----------
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local')); // override

if (!process.env.DATABASE_URL) {
  console.error('[seed] FATAL: DATABASE_URL not set');
  process.exit(1);
}

// ---------- 复刻 lib/auth/password.ts 的 hashPassword ----------
function hashPassword(password) {
  const N = Number(process.env.SCRYPT_N ?? 16384);
  const r = 8;
  const p = 1;
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N, r, p }).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

function genId(prefix) {
  return `${prefix}_${randomBytes(10).toString('hex')}`;
}

// ---------- 用户清单 ----------
const PASSWORD = 'Demo1234!@#'; // 满足 lib/auth/password.ts 策略 (10+ chars, 大小写+数字+符号)

const USERS = [
  { email: 'employee@tandem.local', name: '张伟 (员工)',     roles: ['employee'] },
  { email: 'manager@tandem.local',  name: '王主管 (部门经理)', roles: ['employee', 'manager'] },
  { email: 'hr@tandem.local',       name: '李 HR (Steward)',   roles: ['employee', 'steward'] },
];

// ---------- main ----------
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  console.log(`[seed] connected to ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

  for (const u of USERS) {
    const email = u.email.toLowerCase();
    const exists = await client.query('SELECT id, name, roles FROM "User" WHERE email = $1', [email]);
    if (exists.rowCount > 0) {
      const row = exists.rows[0];
      console.log(`[seed] SKIP ${email} (already exists, id=${row.id}, roles=${row.roles?.join(',') ?? '-'})`);
      continue;
    }

    const id = genId('user');
    const now = new Date();

    await client.query(
      `INSERT INTO "User" (id, email, name, roles, "tenantId", disabled, "emailVerifiedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::text[], 'default', false, $5, $5, $5)`,
      [id, email, u.name, u.roles, now],
    );

    const pwdHash = hashPassword(PASSWORD);
    await client.query(
      `INSERT INTO "KvStore" (collection, id, data, "tenantId", "createdAt", "updatedAt")
       VALUES ('auth_password', $1, $2::jsonb, 'default', $3, $3)`,
      [id, JSON.stringify({ id, hash: pwdHash }), now],
    );

    console.log(`[seed] CREATED ${email}  (id=${id}, roles=${u.roles.join(',')})`);
  }

  console.log('');
  console.log('=== Login credentials ===');
  console.log(`  Password (all 3 demo users): ${PASSWORD}`);
  for (const u of USERS) console.log(`  ${u.email.padEnd(28)}  ${u.name}`);
  console.log('');
  console.log('Open http://localhost:3005/login and try them.');
} catch (err) {
  console.error('[seed] ERROR:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
