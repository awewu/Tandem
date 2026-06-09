/**
 * Read-only DB status check.
 *
 * Reports:
 *   - which DATABASE_URL we connect to (password redacted)
 *   - public tables present in the live DB
 *   - applied migrations recorded in drizzle.__drizzle_migrations
 *   - drift vs the .sql files under drizzle/migrations
 *
 * Pure SELECTs — never mutates. Usage:  node scripts/db-status.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';

// Load .env.local then .env (Next.js precedence) without dotenv dep.
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

let url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
try {
  const u = new URL(url);
  if (u.searchParams.has('schema')) u.searchParams.delete('schema');
  url = u.toString();
} catch {}

const redacted = url.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@');
console.log('DATABASE_URL =', redacted);
console.log('REDIS_URL    =', process.env.REDIS_URL ? '(set)' : '(not set)');
console.log('S3_ENDPOINT  =', process.env.S3_ENDPOINT ? '(set)' : '(not set)');
console.log('');

const client = new pg.Client({ connectionString: url });
await client.connect();

const tables = (await client.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
)).rows.map((r) => r.tablename);

let appliedMigrations = [];
try {
  appliedMigrations = (await client.query(
    `SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`,
  )).rows;
} catch {
  console.log('(drizzle.__drizzle_migrations table not found — migrations may never have run)');
}

const kvCollections = tables.includes('KvStore')
  ? (await client.query(`SELECT collection, count(*)::int AS n FROM "KvStore" GROUP BY collection ORDER BY collection`)).rows
  : [];

await client.end();

const migrationFiles = existsSync('drizzle/migrations')
  ? readdirSync('drizzle/migrations').filter((f) => f.endsWith('.sql')).sort()
  : [];

console.log(`── PUBLIC TABLES (${tables.length}) ──`);
console.log(tables.join('\n'));
console.log('');

console.log(`── MIGRATIONS ──`);
console.log(`files on disk: ${migrationFiles.length}`);
console.log(`recorded applied: ${appliedMigrations.length}`);
// drizzle.__drizzle_migrations.hash holds the SHA-256 of the .sql content for
// migrations applied by drizzle-kit, but legacy rows in this DB stored the bare
// filename instead. Match against BOTH so the report is trustworthy.
const appliedSet = new Set(appliedMigrations.map((r) => r.hash));
const sha256 = (p) => createHash('sha256').update(readFileSync(p, 'utf8')).digest('hex');
const isApplied = (f) => appliedSet.has(f) || appliedSet.has(sha256(join('drizzle/migrations', f)));
const pending = migrationFiles.filter((f) => !isApplied(f));
for (const f of migrationFiles) {
  console.log(`${isApplied(f) ? '✓ applied ' : '✗ PENDING '} ${f}`);
}
console.log(pending.length === 0
  ? '\n✓ All migrations applied.'
  : `\n✗ ${pending.length} migration(s) NOT applied: ${pending.join(', ')}`);

if (kvCollections.length) {
  console.log(`\n── KvStore collections (${kvCollections.length}) ──`);
  for (const r of kvCollections) console.log(`${String(r.n).padStart(6)}  ${r.collection}`);
}
