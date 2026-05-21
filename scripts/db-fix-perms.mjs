/**
 * One-time fixup: run as postgres superuser to grant the app role full
 * privileges on the public schema and apply pending migrations.
 *
 * Default tries postgres/postgres@localhost:5432/<same-db>.  Override with:
 *   $env:SUPER_DATABASE_URL = 'postgresql://postgres:xxx@host:5432/tandem'
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const appUrlRaw = process.env.DATABASE_URL;
if (!appUrlRaw) { console.error('DATABASE_URL missing'); process.exit(1); }
const appUrl = new URL(appUrlRaw);
appUrl.searchParams.delete('schema');
const appUser = appUrl.username;
const dbName = appUrl.pathname.replace(/^\//, '');

const superUrl = new URL(
  process.env.SUPER_DATABASE_URL ??
    `postgresql://postgres:postgres@${appUrl.hostname}:${appUrl.port || 5432}/${dbName}`,
);

console.log(`Connecting as superuser ${superUrl.username}@${superUrl.hostname}:${superUrl.port}/${dbName}`);
const c = new pg.Client({ connectionString: superUrl.toString() });
await c.connect();

// Step 1: grant
console.log(`Granting full perms on schema public to "${appUser}" ...`);
await c.query(`GRANT ALL ON SCHEMA public TO "${appUser}"`);
await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${appUser}"`);
await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${appUser}"`);
console.log('  ✓ granted');

// Step 2: ensure drizzle migration tracker
await c.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
await c.query(`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`);
await c.query(`GRANT ALL ON SCHEMA drizzle TO "${appUser}"`);
await c.query(`GRANT ALL ON ALL TABLES IN SCHEMA drizzle TO "${appUser}"`);
await c.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA drizzle TO "${appUser}"`);

// Step 3: apply pending SQL migrations
const DIR = 'drizzle/migrations';
const applied = new Set(
  (await c.query('SELECT hash FROM drizzle.__drizzle_migrations')).rows.map((r) => r.hash),
);
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
let count = 0;
for (const f of files) {
  if (applied.has(f)) {
    console.log(`= ${f} (already recorded)`);
    continue;
  }
  const sql = readFileSync(join(DIR, f), 'utf8');
  const stmts = sql.split(/--\s*>\s*statement-breakpoint/i).map((s) => s.trim()).filter(Boolean);
  console.log(`+ ${f}  (${stmts.length} stmt)`);
  let okCount = 0;
  let skipCount = 0;
  for (const s of stmts) {
    try {
      await c.query(s);
      okCount++;
    } catch (e) {
      // Tolerate "already exists" by SQLSTATE (locale-independent):
      //   42P07 duplicate_table, 42710 duplicate_object, 42701 duplicate_column,
      //   42P06 duplicate_schema, 42723 duplicate_function, 42P16 invalid_table_definition
      const dup = ['42P07', '42710', '42701', '42P06', '42723'];
      if (dup.includes(e.code)) {
        skipCount++;
      } else {
        console.error(`  ✗ stmt failed:`, e.message);
        console.error('  SQL:', s.slice(0, 200));
        await c.end();
        process.exit(1);
      }
    }
  }
  await c.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [f, Date.now()]);
  console.log(`  → ${okCount} applied, ${skipCount} already present`);
  count++;
}

// Step 4: re-grant on freshly created tables
console.log('Re-granting privileges on all tables (post-migration) ...');
await c.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO "${appUser}"`);
await c.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "${appUser}"`);
console.log(`\n✓ done. ${count} migration file(s) processed.`);
await c.end();
