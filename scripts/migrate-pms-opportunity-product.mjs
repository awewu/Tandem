#!/usr/bin/env node
/**
 * PMS · 商机报备产品结构化 (幂等 DDL)
 *
 * 给 pms_opportunities 增加结构化产品选型字段, 引用 pms_product_catalog:
 *   - productSeries      产品系列名 (对齐 catalog.series)
 *   - productSeriesCode  系列编码 (对齐 catalog.seriesCode)
 *   - productModel       型号名 (对齐 catalog.model)
 *   - productModelCode   型号编码 (对齐 catalog.modelCode)
 *   - productCatalogId   选中的目录条目 id (可空, 软引用)
 *   - productCategory    品类 (对齐 catalog.category, 用于分析维度)
 *   - productAttributes  选项快照 JSON (对齐 catalog.attributes, 报备当下留痕)
 *
 * 保留旧 productLine 文本不动 (向后兼容)。
 * 全部 IF NOT EXISTS 守卫, 可重复执行。
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

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

loadEnv();

const DDL = `
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productSeries" text;
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productSeriesCode" text;
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productModel" text;
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productModelCode" text;
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productCatalogId" text;
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productCategory" text;
ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "productAttributes" jsonb;

CREATE INDEX IF NOT EXISTS pms_opp_product_idx
  ON pms_opportunities ("tenantId", "productSeriesCode", "productModelCode");
CREATE INDEX IF NOT EXISTS pms_opp_product_cat_idx
  ON pms_opportunities ("tenantId", "productCategory", "createdAt");
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
    console.log('Applying pms_opportunities product-selection migration (idempotent)...');
    await sql.unsafe(DDL);
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pms_opportunities' AND column_name LIKE 'product%'
       ORDER BY ordinal_position`;
    console.log('OK. product* columns:', cols.map((c) => c.column_name).join(', '));
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
