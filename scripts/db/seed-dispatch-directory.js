#!/usr/bin/env node
/**
 * seed-dispatch-directory.js — 播种「派单路由目录」demo 数据（线索交接层 P1）。
 *
 * 写 rhautt_nexus.dispatch_dealer_directory 的 foundation 行（tenant_id = NULL，跨租户可读）。
 * 仅路由字段（城市/省份/可服务品类/合约等级/容量），无 PII、无成本价。
 * 派单器（event-consumers 消费 lead.captured）读此目录做 地域+品类+负载 打分。
 *
 * 以超级用户（unix socket peer）连接以绕过 FORCE RLS。
 * 前置：先跑 migration 003（node scripts/apply-migrations.js 或等价）。
 *
 * Usage: node scripts/db/seed-dispatch-directory.js
 */
require('dotenv').config({ path: '.env.nestjs' });
const { Client } = require('pg');

// 固定 UUID → 幂等（ON CONFLICT dealer_id 更新）
const DIRECTORY = [
  { dealerId: '11111111-0000-4000-8000-000000000001', name: '成都瑞诺瓦旗舰服务中心', province: '四川', city: '成都', contractLevel: 'S', capacity: 60, categories: ['hot_water', 'heating', 'fresh_air', 'water_quality', 'air', 'smart'] },
  { dealerId: '11111111-0000-4000-8000-000000000002', name: '上海瑞诺瓦舒适家',       province: '上海', city: '上海', contractLevel: 'A', capacity: 50, categories: ['hot_water', 'fresh_air', 'water_quality', 'air', 'smart'] },
  { dealerId: '11111111-0000-4000-8000-000000000003', name: '杭州瑞诺瓦系统集成',     province: '浙江', city: '杭州', contractLevel: 'A', capacity: 40, categories: ['heating', 'fresh_air', 'hot_water'] },
  { dealerId: '11111111-0000-4000-8000-000000000004', name: '北京瑞诺瓦暖通中心',     province: '北京', city: '北京', contractLevel: 'S', capacity: 55, categories: ['heating', 'hot_water', 'fresh_air', 'air'] },
  { dealerId: '11111111-0000-4000-8000-000000000005', name: '南京瑞诺瓦全屋舒适',     province: '江苏', city: '南京', contractLevel: 'B', capacity: 35, categories: ['heating', 'hot_water', 'fresh_air', 'air', 'water_quality'] },
  { dealerId: '11111111-0000-4000-8000-000000000006', name: '深圳瑞诺瓦净水空气',     province: '广东', city: '深圳', contractLevel: 'A', capacity: 45, categories: ['air', 'fresh_air', 'water_quality', 'smart'] },
];

async function main() {
  const client = new Client({
    host: process.env.PGHOST || '/tmp',
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'rhautt_nexus',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || undefined,
  });
  await client.connect();
  let inserted = 0;
  for (const d of DIRECTORY) {
    await client.query(
      `INSERT INTO rhautt_nexus.dispatch_dealer_directory
         (id, tenant_id, dealer_id, dealer_tenant_id, store_id, name, province, city, categories, contract_level, active, active_load, capacity)
       VALUES (gen_random_uuid(), NULL, $1, NULL, NULL, $2, $3, $4, $5, $6, true, 0, $7)
       ON CONFLICT (dealer_id) DO UPDATE SET
         name = EXCLUDED.name, province = EXCLUDED.province, city = EXCLUDED.city,
         categories = EXCLUDED.categories, contract_level = EXCLUDED.contract_level,
         capacity = EXCLUDED.capacity, active = true, updated_at = now()`,
      [d.dealerId, d.name, d.province, d.city, d.categories, d.contractLevel, d.capacity],
    );
    inserted++;
    console.log(`  ✓ ${d.city} · ${d.name} [${d.categories.join(',')}]`);
  }
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM rhautt_nexus.dispatch_dealer_directory WHERE tenant_id IS NULL AND active`,
  );
  console.log(`\n派单目录 foundation 行：${rows[0].n}（本次 upsert ${inserted}）`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
