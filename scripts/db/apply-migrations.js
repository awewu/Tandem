#!/usr/bin/env node
/**
 * Idempotent PostgreSQL migration runner for the Rhautt Nexus target ledger.
 *
 * Applies database/postgres/migrations/*.sql in filename order, tracking applied
 * migrations in public.schema_migrations (filename + sha256). This is the
 * production-grade alternative to TypeORM `synchronize` — the curated SQL files
 * are the single source of truth and are SHA-pinned by the platform guards.
 *
 * Connection (first match wins):
 *   DATABASE_URL  or  POSTGRES_URI            full connection string
 *   POSTGRES_HOST/PORT/USER/PASSWORD/DB       discrete parts
 *
 * Usage:
 *   node scripts/db/apply-migrations.js            # apply pending migrations
 *   node scripts/db/apply-migrations.js --status   # list applied/pending, no writes
 *   node scripts/db/apply-migrations.js --dry-run  # show what would apply, no writes
 *
 * Safety:
 *   - Each migration runs in its own transaction (BEGIN/COMMIT, ROLLBACK on error).
 *   - A migration whose file content changed after being applied is a hard error
 *     (drift protection) — never silently re-applied or ignored.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const dotenv = require('dotenv');

const ROOT = path.join(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'postgres', 'migrations');

dotenv.config({ path: path.join(ROOT, '.env.nestjs'), quiet: true });

const args = new Set(process.argv.slice(2));
const STATUS_ONLY = args.has('--status');
const DRY_RUN = args.has('--dry-run');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      return { filename, sql, sha256: sha256(sql) };
    });
}

function buildClientConfig() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (url) return { connectionString: url };
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.USER,
    password: process.env.POSTGRES_PASSWORD || undefined,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  };
}

async function ensureTrackingTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename   text PRIMARY KEY,
      sha256     text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT filename, sha256, applied_at FROM public.schema_migrations');
  const map = new Map();
  for (const row of rows) map.set(row.filename, row);
  return map;
}

async function main() {
  const migrations = listMigrations();
  const client = new Client(buildClientConfig());
  await client.connect();
  try {
    await ensureTrackingTable(client);
    const applied = await getApplied(client);

    // Drift protection: a previously-applied file must not have changed content.
    for (const m of migrations) {
      const prev = applied.get(m.filename);
      if (prev && prev.sha256 !== m.sha256) {
        throw new Error(
          `migration drift: ${m.filename} was applied with sha ${prev.sha256} but file now hashes ${m.sha256}. ` +
            'Curated migrations are immutable once applied — add a new migration instead.',
        );
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.filename));

    if (STATUS_ONLY) {
      console.log('Applied migrations:');
      for (const m of migrations) {
        const prev = applied.get(m.filename);
        console.log(`  ${prev ? '[x]' : '[ ]'} ${m.filename}${prev ? `  (${prev.applied_at.toISOString?.() ?? prev.applied_at})` : ''}`);
      }
      console.log(`\n${applied.size} applied, ${pending.length} pending.`);
      return;
    }

    if (pending.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      return;
    }

    for (const m of pending) {
      if (DRY_RUN) {
        console.log(`[dry-run] would apply ${m.filename} (${m.sha256.slice(0, 12)}…)`);
        continue;
      }
      process.stdout.write(`Applying ${m.filename} … `);
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO public.schema_migrations (filename, sha256) VALUES ($1, $2)', [m.filename, m.sha256]);
        await client.query('COMMIT');
        console.log('ok');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.log('FAILED');
        throw err;
      }
    }
    console.log(`\nApplied ${DRY_RUN ? 0 : pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`migration runner error: ${err.message}`);
  process.exit(1);
});
