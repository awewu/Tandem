#!/usr/bin/env node
/**
 * PMS 报备审核关卡 — 幂等加列 (非 drizzle push)
 *
 * 为 pms_opportunities 增补:
 *   reviewStatus text NOT NULL DEFAULT 'approved'   (存量数据视为已通过, 不影响现有漏斗)
 *   reviewedBy   text
 *   reviewedAt   timestamp(3)
 *   reviewNote   text
 *
 * 全程 ADD COLUMN IF NOT EXISTS, 可重复跑; 绝不改动/删除既有列。
 *
 * 用法:  node scripts/add-pms-review-status.mjs
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

const client = new pg.Client({ connectionString: dbUrl });

const DDL = [
  `ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "reviewStatus" text NOT NULL DEFAULT 'approved'`,
  `ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "reviewedBy" text`,
  `ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "reviewedAt" timestamp(3)`,
  `ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "reviewNote" text`,
  `CREATE INDEX IF NOT EXISTS pms_opp_review_idx ON pms_opportunities ("tenantId", "reviewStatus")`,
];

(async () => {
  await client.connect();
  try {
    for (const sql of DDL) {
      await client.query(sql);
      console.log('OK:', sql.slice(0, 72));
    }
    const { rows } = await client.query(
      `SELECT "reviewStatus", count(*)::int AS n FROM pms_opportunities GROUP BY "reviewStatus"`
    );
    console.log('reviewStatus 分布:', JSON.stringify(rows));
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
