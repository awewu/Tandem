#!/usr/bin/env node
/**
 * flywheel-integration.mjs — 增长飞轮**真库集成测试**（对运行中的 API + 真实 PostgreSQL）。
 *
 * 为什么需要这一层：services/api 的 27 个 nodetest 全部使用 mock/fake-datasource，
 * 无法捕获真实数据库约束。实证：`crm.createLead` 曾因 `opportunities.project_id NOT NULL`
 * (迁移037 project-spine) 在真库 500，而 mock 测试全绿——这层空白的代价。
 *
 * 覆盖（真写 + 真读 + 真事件）：
 *   1. 登录（PII 哈希 + bcrypt + 四闸鉴权）
 *   2. createLead 多表写（客户 + 项目主线 lifecycle_links + 商机 + 审计 + outbox 同事务）
 *      ← 断言 opportunity.projectId 非空（project-spine 回归防线）
 *   3. 驾驶舱读（北极星/AARRR/GEO闭环/线索分配/品牌健康度）契约与类型
 *   4. 日快照写 + 趋势读（脱敏聚合固化）
 *   5. 事件驱动：createLead → lead.created → 漏斗 '线索' 计数增长（等 outbox sweep）
 *
 * 前置：API 运行中（默认 http://127.0.0.1:3300）+ 迁移已应用 + seed-nestjs-auth 已播种。
 * 用法：node scripts/tests/flywheel-integration.mjs
 *   可选 env：API_BASE / TEST_STAFF_ID / TEST_STAFF_PW / TEST_DEALER_ID / TEST_DEALER_PW
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3300';
const STAFF = { phone: process.env.TEST_STAFF_ID || 'admin@rhautt.local', password: process.env.TEST_STAFF_PW || 'Test1234!' };
const DEALER = { phone: process.env.TEST_DEALER_ID || '13900000001', password: process.env.TEST_DEALER_PW || 'Dealer@2026' };
const SWEEP_WAIT_MS = Number(process.env.SWEEP_WAIT_MS || 8000);

let passed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) { passed += 1; console.log(`  ✅ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 无 body */ }
  return { status: res.status, body: json };
}

async function login(creds) {
  const r = await api('/api/v2/auth/login', { method: 'POST', body: creds });
  return { status: r.status, token: r.body?.token || r.body?.accessToken || null, user: r.body?.user };
}

async function main() {
  console.log(`\n增长飞轮真库集成测试 → ${BASE}\n`);

  // 0) 服务可达
  const health = await api('/api/v2/health');
  check('0. API 可达', health.status === 200, `health=${health.status}`);
  if (health.status !== 200) return finish();

  // 1) 登录（员工 + 经销商）
  console.log('\n[1] 鉴权');
  const staff = await login(STAFF);
  check('1a. 员工登录 200 且发证', staff.status === 200 && !!staff.token, `status=${staff.status}`);
  const dealer = await login(DEALER);
  check('1b. 经销商登录 200 且发证', dealer.status === 200 && !!dealer.token, `status=${dealer.status}`);
  if (!staff.token || !dealer.token) return finish();

  // 2) createLead 多表写（含 project-spine 回归防线）
  console.log('\n[2] CRM 建单（真库多表写 + 项目主线）');
  const funnelBefore = await api('/api/v2/growth/cockpit/aarrr-funnel', { token: dealer.token });
  const leadBefore = funnelBefore.body?.stages?.find((s) => s.stage === 'lead')?.count ?? 0;

  const phone = `139${String(Date.now()).slice(-8)}`;
  const lead = await api('/api/v2/crm/leads', {
    method: 'POST', token: dealer.token,
    body: { phone, name: '集成测试客户', city: '上海', source: 'integration-test' },
  });
  check('2a. createLead 201（未因 project_id NOT NULL 失败）', lead.status === 201, `status=${lead.status} body=${JSON.stringify(lead.body).slice(0, 160)}`);
  const customerId = lead.body?.customer?.id;
  check('2b. 返回客户 id', !!customerId);

  if (customerId) {
    const c360 = await api(`/api/v2/crm/customers/${customerId}`, { token: dealer.token });
    const opp = c360.body?.opportunities?.[0];
    check('2c. 商机已建', !!opp);
    check('2d. 商机锚定项目主线 projectId 非空（project-spine 回归防线）', !!opp?.projectId, `projectId=${opp?.projectId}`);
  }

  // 3) 驾驶舱读契约
  console.log('\n[3] 驾驶舱读（契约 + 类型）');
  const ns = await api('/api/v2/growth/cockpit/north-star', { token: staff.token });
  check('3a. 北极星 200 且字段完整', ns.status === 200 && typeof ns.body?.activeProfitableDealers === 'number' && typeof ns.body?.networkGmv === 'number');
  const fn = await api('/api/v2/growth/cockpit/aarrr-funnel', { token: staff.token });
  check('3b. AARRR 六阶段齐全', fn.status === 200 && fn.body?.stages?.length === 6);
  const gl = await api('/api/v2/growth/cockpit/geo-loop', { token: staff.token });
  check('3c. GEO 闭环含 缺口/被引率/内容状态', gl.status === 200 && typeof gl.body?.gaps === 'number' && typeof gl.body?.citedRate === 'number' && !!gl.body?.content);
  const lr = await api('/api/v2/growth/cockpit/lead-routing', { token: staff.token });
  check('3d. 线索分配含 成功率/未覆盖样本', lr.status === 200 && typeof lr.body?.routingRate === 'number' && Array.isArray(lr.body?.unroutedSamples));
  const bh = await api('/api/v2/growth/cockpit/brand-health', { token: staff.token });
  check('3e. 品牌健康度接真数据字段', bh.status === 200 && typeof bh.body?.citedRate === 'number' && typeof bh.body?.positiveSentiment === 'number');

  // 4) 日快照写 + 趋势读
  console.log('\n[4] 脱敏聚合日快照 + 趋势');
  const snap = await api('/api/v2/growth/cockpit/snapshot', { method: 'POST', token: staff.token, body: {} });
  check('4a. 日快照写入 201', snap.status === 201, `status=${snap.status}`);
  check('4b. 快照含北极星与漏斗指标', !!snap.body?.metrics?.network_gmv !== undefined && snap.body?.metrics?.funnel_revenue !== undefined);
  const tr = await api('/api/v2/growth/cockpit/trends?metric=network_gmv&days=7', { token: staff.token });
  check('4c. 趋势序列可读', tr.status === 200 && Array.isArray(tr.body?.series) && tr.body.series.length >= 1);

  // 5) 事件驱动：lead.created → 漏斗线索 +1（等 outbox sweep）
  console.log(`\n[5] 事件驱动闭环（等 outbox sweep ${SWEEP_WAIT_MS}ms）`);
  await new Promise((r) => setTimeout(r, SWEEP_WAIT_MS));
  const funnelAfter = await api('/api/v2/growth/cockpit/aarrr-funnel', { token: dealer.token });
  const leadAfter = funnelAfter.body?.stages?.find((s) => s.stage === 'lead')?.count ?? 0;
  check('5a. lead.created 经事件总线归集到漏斗「线索」', leadAfter > leadBefore, `before=${leadBefore} after=${leadAfter}`);

  finish();
}

function finish() {
  console.log(`\n${'─'.repeat(60)}`);
  if (failures.length === 0) {
    console.log(`✅ 集成测试全部通过（${passed} 项断言）`);
    process.exit(0);
  }
  console.log(`❌ ${failures.length} 项失败 / ${passed} 项通过`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}

main().catch((e) => { console.error('集成测试异常:', e.message); process.exit(1); });
