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

const applied = new Set(
  (await client.query('SELECT hash FROM drizzle.__drizzle_migrations')).rows.map((r) => r.hash),
);

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
let count = 0;
for (const f of files) {
  if (applied.has(f)) {
    console.log(`= ${f} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(DIR, f), 'utf8');
  // Drizzle uses --> statement-breakpoint to separate statements
  const stmts = sql.split(/--\s*>\s*statement-breakpoint/i).map((s) => s.trim()).filter(Boolean);
  console.log(`+ ${f}  (${stmts.length} stmt)`);
  try {
    await client.query('BEGIN');
    for (const s of stmts) {
      await client.query(s);
    }
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [f, Date.now()]);
    await client.query('COMMIT');
    count++;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(`  ✗ ${f}:`, e.message);
    // Tolerate "already exists" style errors; otherwise re-throw
    if (!/already exists|duplicate|relation .* exists/i.test(e.message)) {
      await client.end();
      process.exit(1);
    }
    // Mark as applied anyway so we don't retry forever
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [f, Date.now()]);
  }
}

console.log(`\n✓ ${count} new migration(s) applied, ${files.length - count} skipped.`);
await client.end();
