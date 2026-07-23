#!/usr/bin/env node
/**
 * seed-demo-products.js — 播种经销商工作台「产品目录」demo 数据到 rhautt_nexus.products。
 *
 * products 为 HQ 共享目录（tenant_id 文本哨兵 'rhautt_shared'，不纳入 RLS），
 * 由 /api/v2/product-catalog/devices（ProductCatalogService.list）直读。
 *
 * 映射约定（与前端 apps/dealer-workbench/src/app/products/page.tsx 对齐）：
 *   list_price = 市场指导价(marketPrice)   cost_price = 经销商进货价(dealerPrice)
 *   spec = { text: '关键参数' }            meta = { stock, isNew }
 *
 * Usage: node scripts/db/seed-demo-products.js
 */
require('dotenv').config({ path: '.env.nestjs' });
const { Client } = require('pg');

const TENANT = 'rhautt_shared';
const PRODUCTS = [
  { model:'RP-16kW-INV', category:'heat_pump',    brand:'Rheem', name:'瑞美变频风冷热泵 16kW', spec:'制冷16kW/制热18kW · 变频 · COP4.2', marketPrice:48000, dealerPrice:33600, stock:'in',    isNew:true },
  { model:'RP-12kW-INV', category:'heat_pump',    brand:'Rheem', name:'瑞美变频风冷热泵 12kW', spec:'制冷12kW/制热13kW · 变频 · COP4.0', marketPrice:38000, dealerPrice:26600, stock:'in' },
  { model:'RU-20kW',     category:'heat_pump',    brand:'Ruud',  name:'璐德地源热泵 20kW',     spec:'地源 · 20kW · COP5.1 · 双压缩机',   marketPrice:78000, dealerPrice:54600, stock:'order' },
  { model:'FA-350-HR',   category:'fresh_air',    brand:'瑞合',  name:'全热交换新风机 350m³/h', spec:'350m³/h · 全热交换75% · 三级过滤',  marketPrice:18000, dealerPrice:12600, stock:'in' },
  { model:'FA-500-HR',   category:'fresh_air',    brand:'瑞合',  name:'全热交换新风机 500m³/h', spec:'500m³/h · 全热交换78% · PM2.5净化', marketPrice:25000, dealerPrice:17500, stock:'low',   isNew:true },
  { model:'FH-MANIFOLD-8', category:'floor_heat', brand:'瑞合',  name:'8路分集水器',            spec:'8回路 · 黄铜 · 流量计',            marketPrice:4800,  dealerPrice:3360,  stock:'in' },
  { model:'WT-RO-600G',  category:'water',        brand:'瑞合',  name:'中央净水RO 600G',        spec:'反渗透 · 600加仑/天 · 双出水',      marketPrice:12000, dealerPrice:8400,  stock:'in' },
  { model:'WH-HP-300L',  category:'water_heater', brand:'Rheem', name:'瑞美空气能热水器 300L',  spec:'300L · 空气能 · COP3.8',           marketPrice:16000, dealerPrice:11200, stock:'in' },
  { model:'ECONET-HUB',  category:'control',      brand:'瑞合',  name:'Econet 智控中枢',        spec:'全屋联动 · APP远程 · 能耗监测',     marketPrice:8000,  dealerPrice:5600,  stock:'in',    isNew:true },
  { model:'ECONET-THERMO', category:'control',    brand:'瑞合',  name:'Econet 智能温控器',      spec:'分区控温 · 触屏 · 离线语音',        marketPrice:1200,  dealerPrice:840,   stock:'in' },
];

async function run() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'rhautt',
    password: process.env.POSTGRES_PASSWORD || 'rhautt_dev',
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  });
  await client.connect();
  await client.query(`SET search_path TO rhautt_nexus, public`);

  let created = 0;
  for (const p of PRODUCTS) {
    const res = await client.query(
      `INSERT INTO rhautt_nexus.products
         (id, tenant_id, sku, name, brand, category, spec, list_price, cost_price, currency, status, meta, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'CNY', 'active', $9::jsonb, NOW(), NOW())
       ON CONFLICT (tenant_id, sku) DO UPDATE SET
         name=EXCLUDED.name, brand=EXCLUDED.brand, category=EXCLUDED.category,
         spec=EXCLUDED.spec, list_price=EXCLUDED.list_price, cost_price=EXCLUDED.cost_price,
         meta=EXCLUDED.meta, updated_at=NOW()
       RETURNING (xmax = 0) AS inserted`,
      [TENANT, p.model, p.name, p.brand, p.category,
       JSON.stringify({ text: p.spec }), p.marketPrice, p.dealerPrice,
       JSON.stringify({ stock: p.stock, isNew: !!p.isNew })]
    );
    if (res.rows[0]?.inserted) created++;
  }
  const { rows: [{ count }] } = await client.query(
    `SELECT count(*)::int AS count FROM rhautt_nexus.products WHERE tenant_id=$1`, [TENANT]
  );
  console.log(`✅ products: 新增 ${created} 条，rhautt_shared 目录现有 ${count} 条`);
  await client.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
