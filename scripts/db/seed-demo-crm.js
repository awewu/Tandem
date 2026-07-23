#!/usr/bin/env node
/**
 * seed-demo-crm.js — 播种经销商工作台「CRM 漏斗」demo 数据。
 *
 * 走真实 API（非裸 SQL），完整复用后端链路：
 *   1) POST /api/v2/crm/leads      → createLead（客户+商机+生命周期+outbox 事件，PIPL 哈希由服务处理）
 *   2) GET  /api/v2/crm/pipeline   → 取回 customerId→opportunityId 映射
 *   3) PUT  /api/v2/crm/opportunities/:id → 设 stage/estimatedValue/probability/nextActionAt
 *
 * createLead 以 phoneHash 去重 → 可重复运行（幂等）。
 * 阶段键与 apps/dealer-workbench/src/lib/crm-data.ts::STAGES 对齐：
 *   lead / contacted / survey / design / quoted / won / delivery / review
 *
 * Usage: node scripts/db/seed-demo-crm.js
 */
const BASE = process.env.NESTJS_URL || 'http://localhost:5500';
const PHONE = '13900000001', PASS = 'Dealer@2026';
const day = 86400000;
const relISO = (d) => new Date(Date.now() + d * day).toISOString();

// 基于前端 DEMO_OPPS 的 16 位客户（补齐去重手机号）
const LEADS = [
  { phone:'13811110001', name:'刘建国', city:'上海', source:'rysnova_diagnosis', stage:'won',      value:220000,  prob:1.00, next:0,  systems:['hot_water','floor_heat','fresh_air'] },
  { phone:'13811110002', name:'陈美玲', city:'杭州', source:'rysnova_diagnosis', stage:'delivery', value:580000,  prob:1.00, next:20, systems:['hot_water','heating','air','fresh_air','smart_control','ro_water'] },
  { phone:'13811110003', name:'王庆华', city:'成都', source:'rysnova_diagnosis', stage:'design',   value:1280000, prob:1.00, next:14, systems:['hot_water','heating','air','fresh_air','smart_control','ro_water'] },
  { phone:'13811110004', name:'张建国', city:'上海', source:'rysnova_diagnosis', stage:'lead',     value:280000,  prob:0.10, next:1,  systems:['hot_water','air','fresh_air'] },
  { phone:'13811110005', name:'陈小燕', city:'杭州', source:'rysnova_diagnosis', stage:'lead',     value:420000,  prob:0.10, next:0,  systems:['heating','air','fresh_air','smart_control'] },
  { phone:'13811110006', name:'王磊',   city:'南京', source:'展厅',               stage:'contacted',value:195000,  prob:0.25, next:3,  systems:['hot_water','floor_heat'] },
  { phone:'13811110007', name:'李媛媛', city:'上海', source:'转介绍',             stage:'contacted',value:550000,  prob:0.30, next:2,  systems:['hot_water','heating','air','fresh_air','smart_control'] },
  { phone:'13811110008', name:'刘志伟', city:'苏州', source:'rysnova_diagnosis', stage:'survey',   value:320000,  prob:0.40, next:4,  systems:['heating','air','fresh_air'] },
  { phone:'13811110009', name:'赵欣',   city:'上海', source:'官网',               stage:'survey',   value:280000,  prob:0.40, next:5,  systems:['hot_water','air'] },
  { phone:'13811110010', name:'周浩然', city:'杭州', source:'转介绍',             stage:'design',   value:480000,  prob:0.55, next:6,  systems:['hot_water','heating','air','fresh_air','smart_control'] },
  { phone:'13811110011', name:'孙建华', city:'上海', source:'rysnova_diagnosis', stage:'quoted',   value:380000,  prob:0.65, next:2,  systems:['hot_water','heating','air','smart_control'] },
  { phone:'13811110012', name:'郑丽华', city:'南京', source:'展厅',               stage:'quoted',   value:160000,  prob:0.70, next:-1, systems:['hot_water','air'] },
  { phone:'13811110013', name:'黄金山', city:'上海', source:'转介绍',             stage:'won',      value:520000,  prob:1.00, next:10, systems:['hot_water','heating','air','fresh_air','smart_control'] },
  { phone:'13811110014', name:'马俊辉', city:'杭州', source:'展厅',               stage:'delivery', value:680000,  prob:1.00, next:15, systems:['hot_water','heating','air','fresh_air','smart_control'] },
  { phone:'13811110015', name:'曹志远', city:'宁波', source:'rysnova_diagnosis', stage:'review',   value:395000,  prob:1.00, next:-3, systems:['hot_water','heating','air','smart_control'] },
  { phone:'13811110016', name:'杨帆',   city:'上海', source:'官网',               stage:'review',   value:285000,  prob:1.00, next:-5, systems:['heating','air','fresh_air'] },
];

async function jf(path, opts, token) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  return json.data ?? json;
}

async function run() {
  const { token } = await jf('/api/v2/auth/login', { method: 'POST', body: JSON.stringify({ phone: PHONE, password: PASS }) });
  if (!token) throw new Error('登录失败');

  // 1) 建线索（幂等：服务按 phoneHash 去重）
  const byName = new Map(); // name → customerId
  for (const l of LEADS) {
    const r = await jf('/api/v2/crm/leads', { method: 'POST', body: JSON.stringify({
      phone: l.phone, name: l.name, city: l.city, source: l.source,
      // 项目地址（每条线索唯一，name 去重）→ 组成 (phone_hash + address_normalized) 项目唯一键
      address: l.addr || `${l.city}市${l.name}宅（示范）`,
      profile: { area: undefined, systems: l.systems },
    }) }, token);
    const cid = r.customer?.id ?? r.customerId;
    if (cid) byName.set(l.name, cid);
  }

  // 2) 取 pipeline，建 customerId → opportunityId
  const { items } = await jf('/api/v2/crm/pipeline', {}, token);
  const oppByCustomer = new Map(items.map((o) => [o.customerId, o.id]));

  // 3) 逐个设阶段/金额/概率/下一步
  let updated = 0;
  for (const l of LEADS) {
    const cid = byName.get(l.name);
    const oppId = cid && oppByCustomer.get(cid);
    if (!oppId) continue;
    await jf(`/api/v2/crm/opportunities/${oppId}`, { method: 'PUT', body: JSON.stringify({
      stage: l.stage, estimatedValue: l.value, probability: l.prob, nextActionAt: relISO(l.next),
    }) }, token);
    updated++;
  }

  const { items: after } = await jf('/api/v2/crm/pipeline', {}, token);
  const byStage = after.reduce((m, o) => (m[o.stage] = (m[o.stage] || 0) + 1, m), {});
  console.log(`✅ CRM: 线索 ${byName.size}，商机更新 ${updated}，pipeline 共 ${after.length} 条`);
  console.log('   阶段分布:', JSON.stringify(byStage));
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
