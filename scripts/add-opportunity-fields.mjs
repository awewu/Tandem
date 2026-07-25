#!/usr/bin/env node
/**
 * PMS 迁移 · pms_opportunities 补充销售关键字段 (幂等 DDL)
 *   contactName / contactTitle : 联系人姓名+职务 (原仅有电话)
 *   leadSource                 : 线索来源
 *   competitors                : 竞争对手 (jsonb 字符串数组)
 *   customerIndustry           : 客户行业类型
 *
 * 直连本地 Postgres (localhost:5432 via .env.local). 严禁 db:push.
 * 用法: node scripts/add-opportunity-fields.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const p = join(projectRoot, '.env.local');
  if (!existsSync(p)) { console.error('❌ .env.local not found'); process.exit(1); }
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (!k) continue;
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[k.trim()] = val;
  }
}
loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('❌ DATABASE_URL missing'); process.exit(1); }
  const sql = postgres(url.split('?')[0], { max: 1 });
  try {
    await sql`ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "contactName" text`;
    await sql`ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "contactTitle" text`;
    await sql`ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "leadSource" text`;
    await sql`ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "competitors" jsonb`;
    await sql`ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "customerIndustry" text`;
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'pms_opportunities'
        AND column_name IN ('contactName','contactTitle','leadSource','competitors','customerIndustry')
      ORDER BY column_name`;
    console.log('✅ 迁移完成, 现有新列:', cols.map((c) => c.column_name).join(', '));
    await sql.end();
  } catch (e) {
    console.error('FAIL:', e.message);
    await sql.end();
    process.exit(1);
  }
}
main();
