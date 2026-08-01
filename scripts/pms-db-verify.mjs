#!/usr/bin/env node
/**
 * PMS 建表校验 (只读)
 * 对比 schema 期望的 28 张 pms_* 表与真实库现状, 输出缺失清单与列数。
 * 用法: node scripts/pms-db-verify.mjs
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
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (!k) continue;
    let val = v.join('=').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[k.trim()] = val;
  }
}

const EXPECTED = [
  'pms_opportunities', 'pms_follow_ups', 'pms_duplicate_checks', 'pms_duplicate_appeals',
  'pms_public_pool', 'pms_approvals', 'pms_price_applications', 'pms_contracts',
  'pms_delivery_orders', 'pms_delivery_tasks', 'pms_equipment_sns', 'pms_maintenance_records',
  'pms_dealer_org_profiles', 'pms_dealer_qualifications', 'pms_product_catalog', 'pms_customer_accounts',
  'pms_alerts', 'pms_notification_rules', 'pms_rebate_policies', 'pms_rebate_accruals',
  'pms_dealer_orders', 'pms_dealer_health_scores', 'pms_performance_targets', 'pms_demand_gen_leads',
  'pms_key_product_campaigns', 'pms_equipment_telemetry', 'pms_customer_feedback', 'pms_quote_recommendations',
];

loadPmsEnv(projectRoot);

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  if (!url) { console.error('DATABASE_URL not found'); process.exit(1); }
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`
      SELECT table_name, COUNT(*) AS col_count
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name LIKE 'pms_%'
      GROUP BY table_name
      ORDER BY table_name`;
    const present = new Map(rows.map((r) => [r.table_name, Number(r.col_count)]));

    console.log(`\n真实库 pms_* 表: ${present.size} 张 (期望 ${EXPECTED.length})\n`);
    const missing = [];
    for (const t of EXPECTED) {
      if (present.has(t)) {
        console.log(`  [OK]      ${t}  (${present.get(t)} cols)`);
      } else {
        console.log(`  [MISSING] ${t}`);
        missing.push(t);
      }
    }
    const extra = [...present.keys()].filter((t) => !EXPECTED.includes(t));
    if (extra.length) console.log(`\n额外(非期望)表: ${extra.join(', ')}`);

    console.log(`\n结果: ${EXPECTED.length - missing.length}/${EXPECTED.length} 就绪` + (missing.length ? `; 缺失 ${missing.length}: ${missing.join(', ')}` : ' — 全部就绪 ✅'));
    process.exit(missing.length ? 2 : 0);
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
