#!/usr/bin/env node
/**
 * Copy existing Shouchao data from Tandem DATABASE_URL to SHOUCHAO_DATABASE_URL.
 *
 * This is intentionally copy-only: it does not delete or mutate the Tandem
 * source database, so the current /shouchao experience remains recoverable
 * during rollout.
 */

import fs from 'node:fs';
import pg from 'pg';

const COLLECTIONS = [
  'shouchao_notes',
  'shouchao_notebooks',
  'shouchao_attachments',
  'shouchao_databases',
  'shouchao_rows',
  'shouchao_distill_candidates',
];

function loadEnv(envFile) {
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*?)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv('.env.local');
loadEnv('.env');
loadEnv('.env.production');

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.SHOUCHAO_DATABASE_URL ?? process.env.shouchao_DATABASE_URL;
const DRY_RUN = process.argv.includes('--dry-run');

if (!sourceUrl) {
  console.error('[shouchao-migrate] DATABASE_URL not set');
  process.exit(1);
}
if (!targetUrl) {
  console.error('[shouchao-migrate] SHOUCHAO_DATABASE_URL not set');
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error('[shouchao-migrate] source and target URLs are identical; refusing to run');
  process.exit(2);
}

const source = new pg.Pool({ connectionString: sourceUrl.split('?')[0] });
const target = new pg.Pool({ connectionString: targetUrl.split('?')[0] });

function masked(url) {
  return url.replace(/:[^:@/]+@/, ':***@');
}

async function copyKvCollection(collection) {
  const rows = await source.query(
    `SELECT "collection", "id", "data", "tenantId", "createdAt", "updatedAt" FROM "KvStore" WHERE "collection" = $1 ORDER BY "updatedAt" ASC`,
    [collection],
  );
  if (DRY_RUN) return rows.rowCount;

  for (const row of rows.rows) {
    await target.query(
      `INSERT INTO "KvStore" ("collection", "id", "data", "tenantId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("collection", "id") DO UPDATE SET
         "data" = EXCLUDED."data",
         "tenantId" = EXCLUDED."tenantId",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [row.collection, row.id, row.data, row.tenantId, row.createdAt, row.updatedAt],
    );
  }
  return rows.rowCount;
}

async function copyEmbeddings() {
  const sourceHas = await source.query(`SELECT to_regclass('public.embeddings') AS t`);
  const targetHas = await target.query(`SELECT to_regclass('public.embeddings') AS t`);
  if (!sourceHas.rows[0].t || !targetHas.rows[0].t) return 0;

  const rows = await source.query(
    `SELECT id, tenant_id, owner_id, entity_type, entity_id, model, dim, vec::text AS vec, updated_at
     FROM embeddings
     WHERE entity_type IN ('shouchao_note', 'shouchao_row')
     ORDER BY updated_at ASC`,
  );
  if (DRY_RUN) return rows.rowCount;

  for (const row of rows.rows) {
    await target.query(
      `INSERT INTO embeddings (id, tenant_id, owner_id, entity_type, entity_id, model, dim, vec, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         owner_id = EXCLUDED.owner_id,
         entity_type = EXCLUDED.entity_type,
         entity_id = EXCLUDED.entity_id,
         model = EXCLUDED.model,
         dim = EXCLUDED.dim,
         vec = EXCLUDED.vec,
         updated_at = EXCLUDED.updated_at`,
      [row.id, row.tenant_id, row.owner_id, row.entity_type, row.entity_id, row.model, row.dim, row.vec, row.updated_at],
    );
  }
  return rows.rowCount;
}

async function main() {
  console.log(`[shouchao-migrate] source=${masked(sourceUrl)}`);
  console.log(`[shouchao-migrate] target=${masked(targetUrl)}${DRY_RUN ? ' (dry-run)' : ''}`);

  for (const collection of COLLECTIONS) {
    const count = await copyKvCollection(collection);
    console.log(`[shouchao-migrate] ${collection}: ${count}`);
  }
  const embeddings = await copyEmbeddings();
  console.log(`[shouchao-migrate] embeddings: ${embeddings}`);
  console.log('[shouchao-migrate] OK');
}

main()
  .catch((err) => {
    console.error('[shouchao-migrate] FAIL', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.end();
    await target.end();
  });
