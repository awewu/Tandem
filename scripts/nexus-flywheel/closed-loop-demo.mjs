#!/usr/bin/env node
/**
 * Nexus 经销商成功飞轮 · 闭环案例跑通（walking skeleton）
 *
 * 目的：用真实代码跑通 A→B→C→驾驶舱→回A 的事件闭环，验证 MegaPlan 的架构闭环成立，
 * 且所用事件全部在 contracts/events/growth-crm-geo-events.json 中声明（无游离事件）。
 * 不依赖 DB/NestJS：in-memory 复刻 mdm/EventBusService 的 publish/subscribe(outbox) 语义。
 *
 * 运行：node scripts/nexus-flywheel/closed-loop-demo.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(
  readFileSync(resolve(__dirname, '../../contracts/events/growth-crm-geo-events.json'), 'utf8'),
);
const DECLARED = new Set(CONTRACT.events.map((e) => e.eventType));

// ── in-memory EventBus（复刻 outbox: publish→dispatch→subscriber，至少一次）──
const trace = [];
const subscribers = new Map();
function subscribe(type, handler) {
  if (!subscribers.has(type)) subscribers.set(type, []);
  subscribers.get(type).push(handler);
}
function publish(type, payload) {
  if (!DECLARED.has(type)) throw new Error(`❌ 事件 ${type} 未在事件契约中声明（游离事件）`);
  trace.push(type);
  for (const h of subscribers.get(type) ?? []) h(payload);
}

// ── 领域状态（单写多读，按租户）──
const db = {
  leads: [], opportunities: [], deals: [], deliveries: [],
  lifecycleBindings: [], referrals: [],
  dealerSuccess: new Map(), // dealerId -> {gmv, profitProxy, active}
  cockpit: { northStar_activeProfitableDealers: 0, networkGmv: 0, brandHealth: { aiVisibility: 0, sov: 0 } },
};
const MARGIN = 0.28; // 品类毛利率（混合口径的代理系数，§7-1）

// ── 接线（严格按事件契约的 producer→consumers）──
// A/campaign → B①AI问诊
subscribe('growth.lead.attributed', (p) => {
  db.leads.push(p);
  db.opportunities.push({ opportunityId: 'opp-' + p.leadId, dealerId: p.dealerId, leadId: p.leadId, stage: 'diagnosed' });
  log(`  B① AI问诊承接线索 ${p.leadId} → 创建商机 opp-${p.leadId}`);
});
// B/crm 成交 → C/analytics + A/cockpit + B/delivery
// 幂等：inbox 以 eventId 去重（镜像 growth_dealer_deal_inbox 唯一约束），至少一次投递重投不重复计 GMV。
const dealInbox = new Set();
subscribe('crm.deal.signed', (p) => {
  if (dealInbox.has(p.eventId)) { log(`  C/analytics 幂等跳过重投事件 ${p.eventId}（GMV 不重复计）`); return; }
  dealInbox.add(p.eventId);
  db.deals.push(p);
  const s = db.dealerSuccess.get(p.dealerId) ?? { gmv: 0, profitProxy: 0, active: true };
  s.gmv += p.amount; s.profitProxy = Math.round(s.gmv * MARGIN); s.active = true;
  db.dealerSuccess.set(p.dealerId, s);
  log(`  C/analytics 重算经销商成功度 ${p.dealerId}: gmv=${s.gmv} profitProxy=${s.profitProxy}`);
  publish('dealer.success.recomputed', {
    dealerId: p.dealerId, active: s.active, profitProxy: s.profitProxy, profitActual: null, gmv: s.gmv, period: '2026-07',
  });
});
// C/analytics → A/cockpit（北极星）
subscribe('dealer.success.recomputed', (p) => {
  const profitable = p.active && p.profitProxy > 0;
  db.cockpit.networkGmv = p.gmv;
  db.cockpit.northStar_activeProfitableDealers = profitable ? 1 : 0; // 单经销商 demo
  log(`  A/cockpit 北极星更新: 活跃盈利经销商=${db.cockpit.northStar_activeProfitableDealers} 网络GMV=${db.cockpit.networkGmv}`);
});
// B/delivery → B/lifecycle（终身IoT绑定，保全资产）
subscribe('delivery.handover.completed', (p) => {
  db.lifecycleBindings.push({ customerId: p.customerId, projectId: p.projectId, warranty: true, servicePlan: true, bindingStatus: 'bound' });
  log(`  B③ 交付完成→终身IoT绑定 客户${p.customerId}（保全 warranty/service plan/binding）`);
});
// B/crm 转介绍 → A/campaign（回路闭合）
let loopClosed = false;
subscribe('crm.referral.created', (p) => {
  db.referrals.push(p);
  db.cockpit.brandHealth.sov += 1; // 口碑正声量
  loopClosed = true;
  log(`  ↩ A/campaign 收到转介绍 ${p.referralId} → 回流招商/口碑（飞轮闭合）`);
});

// ── 案例：一个经销商的一单，跑通飞轮 ──
function log(m) { console.log(m); }
console.log('\n=== Nexus 经销商成功飞轮 · 闭环案例 ===\n');

log('A 造需求：GEO/内容让 AI 推荐 → 高意向线索灌入线索池');
db.cockpit.brandHealth.aiVisibility = 72; // GEO 可见度指数（示意）
publish('growth.lead.attributed', { leadId: 'L1001', tenantId: 'rhautt', dealerId: 'D-上海旗舰', source: 'geo:doubao', utm: { campaign: 'wuheng-shanghai' }, attributedAt: new Date().toISOString() });

log('B②：报价(HVAC计算/CPQ)→签约');
publish('crm.deal.signed', { eventId: 'evt-deal-1', opportunityId: 'opp-L1001', dealerId: 'D-上海旗舰', amount: 88000, signedAt: new Date().toISOString() });

log('至少一次投递：同一成交事件重投（验证幂等，GMV 不应翻倍）');
publish('crm.deal.signed', { eventId: 'evt-deal-1', opportunityId: 'opp-L1001', dealerId: 'D-上海旗舰', amount: 88000, signedAt: new Date().toISOString() });

log('B③：施工交付→验收→终身IoT');
publish('delivery.handover.completed', { projectId: 'PRJ-L1001', customerId: 'C-王先生', handoverAt: new Date().toISOString() });

log('复购/转介绍：满意客户带新 → 回 A');
publish('crm.referral.created', { referralId: 'REF-1', fromCustomerId: 'C-王先生', dealerId: 'D-上海旗舰' });

// ── 断言闭环 ──
console.log('\n=== 闭环验证 ===');
const checks = [
  ['线索被 AI问诊承接为商机', db.opportunities.length === 1],
  ['成交写入 + 经销商成功度重算', db.deals.length === 1 && db.dealerSuccess.get('D-上海旗舰').gmv === 88000],
  ['至少一次投递幂等（重投不翻倍 GMV）', db.deals.length === 1 && db.cockpit.networkGmv === 88000],
  ['北极星=活跃盈利经销商数 +1', db.cockpit.northStar_activeProfitableDealers === 1],
  ['网络 GMV 归集', db.cockpit.networkGmv === 88000],
  ['终身IoT绑定保全', db.lifecycleBindings.length === 1 && db.lifecycleBindings[0].bindingStatus === 'bound'],
  ['转介绍回流 A（飞轮闭合）', loopClosed === true],
  ['全部事件在契约中声明', trace.every((t) => DECLARED.has(t))],
];
let ok = true;
for (const [name, pass] of checks) { console.log(`  ${pass ? '✅' : '❌'} ${name}`); if (!pass) ok = false; }
console.log(`\n事件轨迹: ${trace.join(' → ')}`);
console.log(ok ? '\n🎉 闭环跑通：A 造需求 → B①问诊 → B②成交 → C度量北极星 → B③终身 → 回A，飞轮成立。\n' : '\n❌ 闭环未通。\n');
process.exit(ok ? 0 : 1);
