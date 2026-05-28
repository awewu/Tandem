// 应用单个 .sql migration 文件到 DATABASE_URL 对应的 PG.
// 用法: node scripts/apply-migration.mjs drizzle/migrations/0003_usage_and_llm_log.sql
//
// 不替代 drizzle-kit migrate 的元表跟踪 — 这个是"手动应用单文件"的简化工具.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/apply-migration.mjs <path-to-sql>');
  process.exit(2);
}

// 简易 .env 读取 (不依赖 dotenv 包)
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
const sql = fs.readFileSync(path.resolve(file), 'utf8');

const pool = new pg.Pool({ connectionString: dbUrl });
try {
  console.log(`[migrate] applying ${file} → ${dbUrl.replace(/:[^:@/]+@/, ':***@')}`);
  await pool.query(sql);
  console.log('[migrate] OK');
  // 抽查 UsageEvent / LlmUsageLog (本次 migration 引入的两表)
  const r = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('UsageEvent','LlmUsageLog') ORDER BY table_name`
  );
  if (r.rows.length > 0) {
    console.log('[migrate] tables present:', r.rows.map((x) => x.table_name).join(', '));
  }
} catch (e) {
  console.error('[migrate] FAIL', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
