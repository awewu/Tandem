#!/usr/bin/env node
/**
 * A3 · pgvector 统一向量检索层 — 幂等迁移 (非 drizzle push)
 *
 * 建 embeddings 表 + HNSW cosine 索引, 供 memory / 手抄 note / 手抄 row 语义检索共用。
 * 全程 CREATE ... IF NOT EXISTS, 可重复跑。绝不改动/删除既有列 (承 megaplan C2)。
 *
 * 维度: 物理列 vector(DIM), DIM 取 EMBEDDING_DIM (默认 1536 = text-embedding-3-small)。
 *   换不同维度模型 → 改 EMBEDDING_DIM 后需 DROP TABLE embeddings 重建 + 重跑回填。
 *
 * 用法:
 *   node scripts/apply-pgvector-migration.mjs           # 应用 (幂等)
 *   node scripts/apply-pgvector-migration.mjs --check   # 只探测, 不改
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

const dbUrl = process.env.DATABASE_URL || 'postgresql://tandem:tandem@localhost:5432/tandem';
const DIM = Number(process.env.EMBEDDING_DIM ?? '1536');
const CHECK_ONLY = process.argv.includes('--check');

if (!Number.isInteger(DIM) || DIM <= 0 || DIM > 16000) {
  console.error(`[pgvector] 非法 EMBEDDING_DIM=${process.env.EMBEDDING_DIM}`);
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: dbUrl.split('?')[0] });

async function main() {
  const masked = dbUrl.replace(/:[^:@/]+@/, ':***@');
  if (CHECK_ONLY) {
    const ext = await pool.query(`SELECT 1 FROM pg_extension WHERE extname='vector'`);
    const tbl = await pool.query(`SELECT to_regclass('public.embeddings') AS t`);
    const cnt = tbl.rows[0].t ? (await pool.query(`SELECT count(*)::int AS c FROM embeddings`)).rows[0].c : 0;
    console.log(`[pgvector] db=${masked}`);
    console.log(`[pgvector] extension vector: ${ext.rows.length ? 'INSTALLED' : 'MISSING'}`);
    console.log(`[pgvector] table embeddings: ${tbl.rows[0].t ? 'PRESENT' : 'MISSING'} (rows=${cnt})`);
    return;
  }

  console.log(`[pgvector] applying → ${masked} (DIM=${DIM})`);

  // 1. 扩展 (需超级用户/有权限; 已装则跳过)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  // 2. 表 (幂等)
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

  // 3. 过滤索引
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_type ON embeddings (tenant_id, entity_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_owner ON embeddings (owner_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings (model)`);

  // 4. ANN 索引 (cosine)。HNSW 需固定维度列, 已由 vector(${DIM}) 保证。
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_embeddings_vec ON embeddings USING hnsw (vec vector_cosine_ops)`,
  );

  // 5. 抽查
  const tbl = await pool.query(`SELECT to_regclass('public.embeddings') AS t`);
  const idx = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE tablename='embeddings' ORDER BY indexname`,
  );
  console.log(`[pgvector] OK · table=${tbl.rows[0].t} · indexes=${idx.rows.map((r) => r.indexname).join(', ')}`);
}

main()
  .catch((e) => {
    console.error('[pgvector] FAIL', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
