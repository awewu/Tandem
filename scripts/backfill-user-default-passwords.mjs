/**
 * Backfill login password hashes for existing imported users.
 *
 * Default is dry-run. Apply with:
 *   $env:TANDEM_IMPORTED_USER_DEFAULT_PASSWORD="..."
 *   node scripts/backfill-user-default-passwords.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const TENANT_ID = process.env.TENANT_ID || 'default';
const PASSWORD_COLLECTION = 'auth_password_hashes';
const EXTRAS_COLLECTION = 'auth_user_extras';
const PROTECTED_EMAILS = new Set([
  'admin@rhenext.com',
  'admin@tandem.local',
  'steve.li@rhautt.com',
  'steve.li@hautt.com',
]);
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const INCLUDE_DISABLED = args.includes('--include-disabled');
const INCLUDE_PROTECTED = args.includes('--include-protected');
const emails = args
  .filter((arg) => arg.startsWith('--email='))
  .map((arg) => arg.slice('--email='.length).trim().toLowerCase())
  .filter(Boolean);

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve('.env.local'));
loadEnvFile(path.resolve('.env'));

const DEFAULT_PASSWORD = args.find((arg) => arg.startsWith('--password='))?.slice('--password='.length)
  ?? process.env.TANDEM_IMPORTED_USER_DEFAULT_PASSWORD
  ?? process.env.DEFAULT_USER_PASSWORD
  ?? '';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

function mergeExtras(existing, userId) {
  return {
    ...(existing ?? {}),
    id: userId,
    failedLoginCount: 0,
    lockedUntil: null,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (APPLY && !DEFAULT_PASSWORD) {
    throw new Error('Set TANDEM_IMPORTED_USER_DEFAULT_PASSWORD or pass --password=... before --apply');
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  await client.connect();
  try {
    await client.query('BEGIN');

    const usersResult = await client.query(
      `
        SELECT u.id, u.email, u.name, u.disabled, e.data AS extras
        FROM "User" u
        LEFT JOIN "KvStore" p
          ON p.collection = $2 AND p.id = u.id AND p."tenantId" = u."tenantId"
        LEFT JOIN "KvStore" e
          ON e.collection = $3 AND e.id = u.id AND e."tenantId" = u."tenantId"
        WHERE u."tenantId" = $1
          AND u."deletedAt" IS NULL
          AND p.id IS NULL
          AND ($4::boolean OR u.disabled = false)
          AND ($5::text[] IS NULL OR lower(u.email) = ANY($5::text[]))
          AND ($6::boolean OR lower(u.email) <> ALL($7::text[]))
        ORDER BY u.email
      `,
      [
        TENANT_ID,
        PASSWORD_COLLECTION,
        EXTRAS_COLLECTION,
        INCLUDE_DISABLED,
        emails.length ? emails : null,
        INCLUDE_PROTECTED,
        Array.from(PROTECTED_EMAILS),
      ],
    );

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      tenantId: TENANT_ID,
      includeDisabled: INCLUDE_DISABLED,
      includeProtected: INCLUDE_PROTECTED,
      emailFilterCount: emails.length,
      missingPasswordUsers: usersResult.rowCount,
      users: usersResult.rows.map((u) => ({ email: u.email, name: u.name, disabled: u.disabled })),
    }, null, 2));

    if (!APPLY) {
      await client.query('ROLLBACK');
      return;
    }

    for (const user of usersResult.rows) {
      await client.query(
        'INSERT INTO "KvStore" (collection,id,data,"tenantId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (collection,id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW()',
        [PASSWORD_COLLECTION, user.id, { id: user.id, hash: hashPassword(DEFAULT_PASSWORD), historyHashes: [] }, TENANT_ID],
      );
      await client.query(
        'INSERT INTO "KvStore" (collection,id,data,"tenantId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (collection,id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW()',
        [EXTRAS_COLLECTION, user.id, mergeExtras(user.extras, user.id), TENANT_ID],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
