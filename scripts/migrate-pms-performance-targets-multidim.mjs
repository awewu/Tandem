#!/usr/bin/env node
/**
 * PMS · 业绩目标多维扩展 (幂等 DDL)
 *
 * 给 pms_performance_targets 增加多维运营字段:
 *   - dimension       维度轴 (region/channel/product_line/dealer_org/sales_person/org)
 *   - dimensionValue  维度取值 (区域名/渠道/产品线/经销商ID/销售ID/组织ID)
 *   - periodType      周期类型 (monthly/quarterly/yearly)
 *   - targetCount     目标数量 (可选, 计数型指标)
 *   - actualCount     实际数量 (自动汇总回填)
 *   - yoyGrowth       同比增长 %
 *   - momGrowth       环比增长 %
 *
 * 并回填历史行的 dimension/dimensionValue (dealerOrgId 优先, 否则 orgId)。
 * 全部使用 IF NOT EXISTS / WHERE IS NULL 守卫, 可重复执行。
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { loadPmsEnv } from './pms-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) {
    console.error('.env.local not found');
    process.exit(1);
  }
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!key) continue;
    let value = valueParts.join('=').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key.trim()] = value;
  }
}

loadPmsEnv(projectRoot);

const DDL = `
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "dimension" text NOT NULL DEFAULT 'org';
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "dimensionValue" text;
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "periodType" text NOT NULL DEFAULT 'monthly';
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "targetCount" numeric;
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "actualCount" numeric DEFAULT '0';
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "yoyGrowth" numeric;
ALTER TABLE pms_performance_targets ADD COLUMN IF NOT EXISTS "momGrowth" numeric;

-- 回填历史行维度: dealerOrgId 优先, 否则 orgId
UPDATE pms_performance_targets
   SET "dimension" = 'dealer_org', "dimensionValue" = "dealerOrgId"
 WHERE "dimensionValue" IS NULL AND "dealerOrgId" IS NOT NULL;

UPDATE pms_performance_targets
   SET "dimension" = 'org', "dimensionValue" = "orgId"
 WHERE "dimensionValue" IS NULL AND "orgId" IS NOT NULL;

-- 派生周期类型: 含 -Q 视为季度, 长度=4 视为年度, 其余月度
UPDATE pms_performance_targets
   SET "periodType" = CASE
     WHEN "period" LIKE '%-Q%' THEN 'quarterly'
     WHEN char_length("period") = 4 THEN 'yearly'
     ELSE 'monthly'
   END
 WHERE "periodType" = 'monthly' AND ("period" LIKE '%-Q%' OR char_length("period") = 4);

CREATE INDEX IF NOT EXISTS pms_target_dimension_idx
  ON pms_performance_targets ("tenantId", "dimension", "period", "periodType");
`;

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  databaseUrl = databaseUrl.split('?')[0];
  console.log('Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    console.log('Applying pms_performance_targets multi-dimension migration (idempotent)...');
    await sql.unsafe(DDL);
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pms_performance_targets'
       ORDER BY ordinal_position`;
    console.log('OK. Columns now:', cols.map((c) => c.column_name).join(', '));
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
