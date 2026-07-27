#!/usr/bin/env node
/**
 * Initialize the independent Shouchao database.
 *
 * Target is SHOUCHAO_DATABASE_URL. This script creates only the generic
 * KvStore table used by Shouchao collections and, when pgvector is available,
 * the embeddings table used by Shouchao semantic search.
 */

import fs from 'node:fs';
import pg from 'pg';

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

const dbUrl = process.env.SHOUCHAO_DATABASE_URL ?? process.env.shouchao_DATABASE_URL;
const DIM = Number(process.env.EMBEDDING_DIM ?? '1536');

if (!dbUrl) {
  console.error('[shouchao-db] SHOUCHAO_DATABASE_URL not set');
  process.exit(1);
}
if (!Number.isInteger(DIM) || DIM <= 0 || DIM > 16000) {
  console.error(`[shouchao-db] invalid EMBEDDING_DIM=${process.env.EMBEDDING_DIM}`);
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: dbUrl.split('?')[0] });

async function main() {
  const masked = dbUrl.replace(/:[^:@/]+@/, ':***@');
  console.log(`[shouchao-db] initializing ${masked}`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "KvStore" (
      "collection" text NOT NULL,
      "id" text NOT NULL,
      "data" jsonb NOT NULL,
      "tenantId" text NOT NULL DEFAULT 'default',
      "createdAt" timestamp(3) NOT NULL DEFAULT now(),
      "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
      CONSTRAINT "KvStore_collection_id_pk" PRIMARY KEY ("collection", "id")
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "KvStore_tenant_idx" ON "KvStore" ("tenantId")`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "KvStore_collection_tenant_idx" ON "KvStore" ("collection", "tenantId")`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "KvStore_updatedAt_idx" ON "KvStore" ("updatedAt")`);

  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id           text PRIMARY KEY,
        tenant_id    text NOT NULL,
        owner_id     text,
        entity_type  text NOT NULL,
        entity_id    text NOT NULL,
        model        text NOT NULL,
        dim          int  NOT NULL,
        vec          vector(${DIM}) NOT NULL,
        updated_at   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_type ON embeddings (tenant_id, entity_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_owner ON embeddings (owner_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings (model)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_vec ON embeddings USING hnsw (vec vector_cosine_ops)`);
    console.log('[shouchao-db] embeddings table ready');
  } catch (err) {
    console.warn(`[shouchao-db] pgvector unavailable, semantic search will fall back: ${err.message}`);
  }

  console.log('[shouchao-db] OK');
}

main()
  .catch((err) => {
    console.error('[shouchao-db] FAIL', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
