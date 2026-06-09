/**
 * Apply all SQL files under drizzle/migrations in lexical order.
 *
 * Idempotent: every statement is wrapped in `IF NOT EXISTS` style by drizzle-kit
 * codegen, so re-runs are safe. Skips files whose name is recorded in
 * `__drizzle_migrations` (Drizzle Kit's tracker).
 *
 * Usage:  node scripts/apply-migrations.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';

const DIR = 'drizzle/migrations';

// Load .env / .env.local manually (no dotenv dep needed)
// Match Next.js precedence: .env.local overrides .env
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

let url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
// Strip Prisma-style ?schema=...
try {
  const u = new URL(url);
  // Drop Prisma-style ?schema=... (postgres default search_path already includes 'public').
  if (u.searchParams.has('schema')) u.searchParams.delete('schema');
  url = u.toString();
} catch {}

const client = new pg.Client({ connectionString: url });
await client.connect();
// Force public schema for the rest of the session.
await client.query('CREATE SCHEMA IF NOT EXISTS public');
await client.query('SET search_path = public');
console.log('search_path =', (await client.query('SHOW search_path')).rows[0].search_path);

await client.query(`
  CREATE SCHEMA IF NOT EXISTS drizzle;
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  );
`);

// The ledger may store either the SHA-256 of the .sql content (drizzle-kit's
// convention) or, for legacy rows in this DB, the bare filename. Match BOTH so
// already-applied migrations recorded by hash (e.g. 0002/0003) are not re-run.
const applied = new Set(
  (await client.query('SELECT hash FROM drizzle.__drizzle_migrations')).rows.map((r) => r.hash),
);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/**
 * Whether a statement error is a tolerable idempotent no-op (re-runnable).
 *
 * NB: Postgres localizes error text — match BOTH English and zh-CN messages,
 * else the idempotency safety net silently breaks on a Chinese-locale server
 * (e.g. "索引 … 不存在" / "… 已存在"), aborting the whole migration chain.
 * Covers: already-exists (re-create) AND does-not-exist (idempotent DROP/cleanup).
 */
const isTolerable = (msg) =>
  /already exists|duplicate|relation .* exists|does not exist/i.test(msg) ||
  /已存在|不存在|重复/.test(msg);

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
let count = 0;
for (const f of files) {
  const sql = readFileSync(join(DIR, f), 'utf8');
  const fileHash = sha256(sql);
  if (applied.has(f) || applied.has(fileHash)) {
    console.log(`= ${f} (already applied)`);
    continue;
  }
  // Drizzle uses --> statement-breakpoint to separate statements
  const stmts = sql.split(/--\s*>\s*statement-breakpoint/i).map((s) => s.trim()).filter(Boolean);
  console.log(`+ ${f}  (${stmts.length} stmt)`);
  try {
    await client.query('BEGIN');
    // Per-statement SAVEPOINT: a tolerable no-op (e.g. idempotent DROP on a
    // Chinese-locale server) rolls back ONLY that statement so the rest of the
    // file still commits. A genuine error propagates → whole-file ROLLBACK + exit.
    // This avoids the previous footgun where one tolerated error rolled back the
    // entire file yet marked it "applied" (silent gap of all good statements).
    for (const s of stmts) {
      await client.query('SAVEPOINT stmt_sp');
      try {
        await client.query(s);
        await client.query('RELEASE SAVEPOINT stmt_sp');
      } catch (se) {
        if (!isTolerable(se.message)) throw se;
        await client.query('ROLLBACK TO SAVEPOINT stmt_sp');
        console.warn(`    ~ tolerated no-op: ${se.message}`);
      }
    }
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [fileHash, Date.now()]);
    await client.query('COMMIT');
    count++;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`  ✗ ${f}:`, e.message);
    await client.end();
    process.exit(1);
  }
}

console.log(`\n✓ ${count} new migration(s) applied, ${files.length - count} skipped.`);
await client.end();
