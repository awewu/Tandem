#!/usr/bin/env node
/**
 * seed-demo-everhot-positioning.js — 为 everhot 住宅类产品播种 demo「产品定位」数据。
 *
 * 背景：D2 产品事实基座的 positioning（卖给谁/渠道/画像/市场/卖点/痛点/场景）
 * 按蓝图应由总部 product_manager 在 D2 录入；本脚本仅供开发/演示环境快速铺底，
 * 让问诊 recommend、品牌站「为谁而生」等消费面有数据可跑。
 *
 * 写主纪律（重要）：**只填 positioning 当前为空（'{}'）的产品**，
 * 绝不覆盖 D2 已录入的定位 —— 与 guard:product-authoring「重复 seed 不覆盖录入」一致。
 * 因此本脚本幂等：换库/重建后可重跑，已录入数据安全。
 *
 * tenant：everhot 品牌运营库（EVERHOT_TENANT_ID，默认见下）。
 *
 * Usage: node scripts/db/seed-demo-everhot-positioning.js
 */
require('dotenv').config({ path: '.env.nestjs' });
require('dotenv').config(); // 叠加 .env（EVERHOT_TENANT_ID 常在此）
const { Client } = require('pg');

const TENANT = process.env.EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001';

// sku → positioning（受控标签取值须与 product-taxonomy.ts 词表一致）
const POSITIONING = {
  'everflow-z16': {
    targetSegments: ['home'], channels: ['dealer', 'ecommerce'],
    userPersonas: ['essential', 'new_build'], markets: ['tier1_city', 'south_humid'],
    valueProposition: '零冷水即开即热，告别等待与忽冷忽热',
    painPoints: ['热水不稳定', '忽冷忽热', '制热慢'], scenarios: ['生活热水', '即热淋浴'],
  },
  'everelec-80': {
    targetSegments: ['home'], channels: ['dealer', 'ecommerce'],
    userPersonas: ['essential', 'retrofit'], markets: ['south_humid'],
    valueProposition: '速热大水量，小户型友好',
    painPoints: ['热水不稳定', '制热慢'], scenarios: ['生活热水'],
  },
  'everduo-x12': {
    targetSegments: ['home'], channels: ['dealer'],
    userPersonas: ['retrofit', 'essential'], markets: ['north_heating'],
    valueProposition: '采暖+热水一体，省空间省心',
    painPoints: ['能耗高', '热水不稳定', '采暖不均'], scenarios: ['采暖', '生活热水'],
  },
  'everwarm-c26': {
    targetSegments: ['home', 'villa'], channels: ['dealer'],
    userPersonas: ['premium_upgrade', 'retrofit'], markets: ['north_heating'],
    valueProposition: '冷凝技术高效采暖+生活热水，节能又舒适',
    painPoints: ['采暖不均', '能耗高', '忽冷忽热'], scenarios: ['冬季采暖', '生活热水'],
  },
  'everfloor': {
    targetSegments: ['villa', 'home'], channels: ['dealer', 'project'],
    userPersonas: ['premium_upgrade', 'new_build'], markets: ['north_heating', 'east_villa'],
    valueProposition: '地暖均匀采暖，脚暖头凉更舒适',
    painPoints: ['采暖不均', '制热慢'], scenarios: ['冬季采暖'],
  },
  'evergeo': {
    targetSegments: ['villa'], channels: ['dealer', 'project'],
    userPersonas: ['premium_upgrade', 'new_build'], markets: ['east_villa', 'north_heating'],
    valueProposition: '地源热泵超低能耗，冬暖夏凉全年恒温',
    painPoints: ['能耗高', '采暖不均', '噪音大'], scenarios: ['别墅冷暖', '全年恒温'],
  },
  'evercool-multi': {
    targetSegments: ['home', 'villa'], channels: ['dealer'],
    userPersonas: ['premium_upgrade'], markets: ['south_humid', 'tier1_city'],
    valueProposition: '全屋恒温静音，舒适不干燥',
    painPoints: ['噪音大', '温度不均', '能耗高'], scenarios: ['夏季制冷', '冬季制热'],
  },
  'everfresh': {
    targetSegments: ['home', 'villa'], channels: ['dealer'],
    userPersonas: ['premium_upgrade'], markets: ['tier1_city'],
    valueProposition: '24小时洁净新风，PM2.5 高效过滤',
    painPoints: ['空气差', '空气干燥', '异味'], scenarios: ['室内空气净化'],
  },
};

async function run() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'rhautt',
    password: process.env.POSTGRES_PASSWORD || 'rhautt_dev',
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  });
  await client.connect();
  await client.query('SET search_path TO rhautt_nexus, public');

  let filled = 0, skipped = 0, missing = 0;
  for (const [sku, positioning] of Object.entries(POSITIONING)) {
    // 只填 positioning 为空的行：不覆盖 D2 已录入定位（幂等 + 写主纪律）
    const res = await client.query(
      `UPDATE rhautt_nexus.products
         SET positioning = $3::jsonb, updated_at = NOW()
       WHERE tenant_id = $1 AND sku = $2
         AND (positioning IS NULL OR positioning = '{}'::jsonb)
       RETURNING sku`,
      [TENANT, sku, JSON.stringify(positioning)]
    );
    if (res.rowCount > 0) { filled++; continue; }

    // 区分「已有定位（跳过）」与「产品不存在（缺失）」
    const { rows } = await client.query(
      'SELECT 1 FROM rhautt_nexus.products WHERE tenant_id=$1 AND sku=$2', [TENANT, sku]
    );
    if (rows.length) skipped++; else { missing++; console.warn(`  ⚠ 未找到产品 sku=${sku}（先跑品牌同步 seed）`); }
  }

  console.log(`✅ everhot positioning：填充 ${filled} · 已有跳过 ${skipped} · 缺失 ${missing}（tenant=${TENANT}）`);
  await client.end();
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
