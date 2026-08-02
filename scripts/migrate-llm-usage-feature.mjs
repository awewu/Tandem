#!/usr/bin/env node
/**
 * 幂等迁移: LlmUsageLog 加 feature 列 (P0-8 · call-site 级成本归因).
 *
 * 为什么用脚本而非 drizzle-kit push:
 *   本库 User 表保留 Prisma 时代物理列, drizzle push 会误判 DATA LOSS (见 02-database-env)。
 *   故新列一律用 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 幂等 DDL。
 *
 * 运行: node scripts/migrate-llm-usage-feature.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL 未配置 (.env.local)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  console.log('[migrate] connected:', url.replace(/:[^:@]+@/, ':***@'));

  await client.query(`ALTER TABLE "LlmUsageLog" ADD COLUMN IF NOT EXISTS "feature" text;`);
  console.log('[migrate] column "feature" ensured');

  await client.query(
    `CREATE INDEX IF NOT EXISTS "LlmUsageLog_feature_idx" ON "LlmUsageLog" ("feature");`,
  );
  console.log('[migrate] index "LlmUsageLog_feature_idx" ensured');

  console.log('[migrate] done ✓');
}

main()
  .catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
