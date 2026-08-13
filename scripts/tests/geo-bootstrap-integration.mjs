#!/usr/bin/env node
/**
 * geo-bootstrap-integration.mjs — GEO 自循环冷启动**真库集成测试**（对运行中的 API + 真实 PostgreSQL）。
 *
 * 为什么需要这一层：场景播种/启动序列的 27 个 nodetest 全部走 mock datasource，
 * 迁移 089（growth_scenario 表 + RLS + growth_geo_question.source_scenario_id）从未被真库验证过——
 * 与 flywheel-integration 同源的空白：mock 全绿但真库可能因约束/RLS/列缺失 500。
 *
 * 覆盖（真写 + 真读 + 真约束）：
 *   1. 登录发证
 *   2. 未知品类拒绝播种（诚实红线：系统不编造痛点）
 *   3. dryRun 播种只预览不落库
 *   4. 真播种：落 growth_scenario + 派生选题落 growth_geo_question（含 source_scenario_id 追溯）
 *   5. 幂等：二次播种不重复建场景/选题
 *   6. 单场景派生 dryRun 预览
 *   7. 启动序列 geo/bootstrap（runBaseline=false，不依赖外部 AI 网关）
 *   8. 受治理动作入口 geo.bootstrap-brand-category 为 green 且可直接执行
 *   9. 选题优先级：decide 型问题排在 info 型之前（商业价值打分生效）
 *
 * ⚠️ 基线探测（runBaseline=true）依赖外部 AI 网关，本测试默认关闭；
 *    设 RUN_BASELINE=1 可在网关就绪环境下额外验证（失败会如实标记，不伪造数据）。
 *
 * 前置：API 运行中（默认 http://127.0.0.1:3300）+ 迁移已应用（含 089）+ seed-nestjs-auth 已播种。
 * 用法：node scripts/tests/geo-bootstrap-integration.mjs
 *   可选 env：API_BASE / TEST_STAFF_ID / TEST_STAFF_PW / RUN_BASELINE
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:3300';
const STAFF = { phone: process.env.TEST_STAFF_ID || 'admin@rhautt.local', password: process.env.TEST_STAFF_PW || 'Test1234!' };
const RUN_BASELINE = process.env.RUN_BASELINE === '1';

// 用时间戳隔离本次运行的数据，避免与既有数据/重复运行互相干扰
const STAMP = String(Date.now()).slice(-8);
const BRAND = 'rheem';
const CATEGORY = `集成测试品类${STAMP}`;
const PAIN_POINTS = ['电费高', '噪音大', '制热效果差'];

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

/** 服务层统一包 { success, data }，动作引擎再包一层 data；此处归一。 */
function unwrap(body) {
  return body?.data?.data ?? body?.data ?? body;
}

async function main() {
  console.log(`\nGEO 自循环冷启动真库集成测试 → ${BASE}`);
  console.log(`本次隔离品类：${CATEGORY}\n`);

  const health = await api('/api/v2/health');
  check('0. API 可达', health.status === 200, `health=${health.status}`);
  if (health.status !== 200) return finish();

  console.log('\n[1] 鉴权');
  const login = await api('/api/v2/auth/login', { method: 'POST', body: STAFF });
  const token = login.body?.token || login.body?.accessToken || null;
  check('1a. 员工登录 200 且发证', login.status === 200 && !!token, `status=${login.status}`);
  if (!token) return finish();

  // ── 2) 诚实红线：未知品类不编造痛点 ──
  console.log('\n[2] 未知品类拒绝播种（诚实红线）');
  const unknown = await api('/api/v2/growth/geo/scenarios/seed', {
    method: 'POST', token,
    body: { brandSlug: BRAND, category: CATEGORY }, // 无内置词表且不给 painPoints
  });
  check('2a. 未知品类无词表 → 400 拒绝', unknown.status === 400, `status=${unknown.status}`);
  check('2b. 错误信息说明需提供真实痛点',
    String(unknown.body?.message || '').includes('painPoints'),
    `message=${String(unknown.body?.message || '').slice(0, 120)}`);

  // ── 3) dryRun 只预览不落库 ──
  console.log('\n[3] dryRun 播种（只预览不落库）');
  const dry = await api('/api/v2/growth/geo/scenarios/seed', {
    method: 'POST', token,
    body: { brandSlug: BRAND, category: CATEGORY, painPoints: PAIN_POINTS, maxScenarios: 4, dryRun: true },
  });
  const dryData = unwrap(dry.body);
  check('3a. dryRun 201/200', dry.status === 201 || dry.status === 200, `status=${dry.status} body=${JSON.stringify(dry.body).slice(0, 200)}`);
  check('3b. 返回 dryRun 标记', dryData?.dryRun === true);
  check('3c. 规划了场景与选题', (dryData?.scenariosPlanned ?? 0) > 0 && (dryData?.topicsPlanned ?? 0) > 0,
    `scenarios=${dryData?.scenariosPlanned} topics=${dryData?.topicsPlanned}`);
  const previewQuestions = (dryData?.preview || []).flatMap((p) => (p.topics || []).map((t) => t.question));
  check('3d. 预览问句无未填充占位（{houseType} 之类）',
    previewQuestions.length > 0 && previewQuestions.every((q) => !/[{}]/.test(q)),
    `bad=${previewQuestions.filter((q) => /[{}]/.test(q)).slice(0, 3).join(' | ')}`);

  const listAfterDry = await api(`/api/v2/growth/geo/scenarios?category=${encodeURIComponent(CATEGORY)}`, { token });
  const dryRows = unwrap(listAfterDry.body)?.scenarios ?? unwrap(listAfterDry.body) ?? [];
  check('3e. dryRun 后库中无该品类场景（确未落库）', Array.isArray(dryRows) && dryRows.length === 0,
    `rows=${Array.isArray(dryRows) ? dryRows.length : 'n/a'}`);

  // ── 4) 真播种：落 growth_scenario（迁移 089 首次真库写）──
  console.log('\n[4] 真播种（迁移 089 真库写 + RLS）');
  const seed = await api('/api/v2/growth/geo/scenarios/seed', {
    method: 'POST', token,
    body: { brandSlug: BRAND, category: CATEGORY, painPoints: PAIN_POINTS, maxScenarios: 4 },
  });
  const seedData = unwrap(seed.body);
  check('4a. 播种 201/200（未因 089 表缺失/RLS 500）', seed.status === 201 || seed.status === 200,
    `status=${seed.status} body=${JSON.stringify(seed.body).slice(0, 240)}`);
  check('4b. 真建了场景', (seedData?.scenariosCreated ?? 0) > 0, `created=${seedData?.scenariosCreated}`);
  check('4c. 真存了选题', (seedData?.questionsSaved ?? 0) > 0, `saved=${seedData?.questionsSaved}`);

  const list = await api(`/api/v2/growth/geo/scenarios?category=${encodeURIComponent(CATEGORY)}`, { token });
  const rows = unwrap(list.body)?.scenarios ?? unwrap(list.body) ?? [];
  check('4d. 场景可读回', Array.isArray(rows) && rows.length > 0, `rows=${Array.isArray(rows) ? rows.length : 'n/a'}`);
  const scenarioId = Array.isArray(rows) && rows.length ? rows[0].id : null;
  check('4e. 场景字段完整（品类/角色/痛点/意向）',
    !!scenarioId && !!rows[0].category && !!rows[0].audience && !!rows[0].painPoint && !!rows[0].intent,
    `row=${JSON.stringify(rows[0] || {}).slice(0, 200)}`);

  // 选题落库且带追溯（089 新增列 source_scenario_id）
  const questions = await api('/api/v2/growth/geo/question-set', {
    method: 'POST', token, body: { brandSlug: BRAND, category: CATEGORY },
  });
  const qRows = unwrap(questions.body)?.items ?? [];
  const mine = Array.isArray(qRows) ? qRows.filter((q) => q.category === CATEGORY) : [];
  check('4f. 选题落入问题库', mine.length > 0, `questions=${mine.length}`);
  check('4g. 选题回填 source_scenario_id（选题来源可追溯）',
    mine.length > 0 && mine.every((q) => !!q.sourceScenarioId),
    `withSource=${mine.filter((q) => !!q.sourceScenarioId).length}/${mine.length}`);

  // ── 5) 幂等：二次播种不重复 ──
  console.log('\n[5] 幂等（重复播种不重复建）');
  const seed2 = await api('/api/v2/growth/geo/scenarios/seed', {
    method: 'POST', token,
    body: { brandSlug: BRAND, category: CATEGORY, painPoints: PAIN_POINTS, maxScenarios: 4 },
  });
  const seed2Data = unwrap(seed2.body);
  check('5a. 二次播种成功', seed2.status === 201 || seed2.status === 200, `status=${seed2.status}`);
  check('5b. 未重复建场景', (seed2Data?.scenariosCreated ?? -1) === 0, `created=${seed2Data?.scenariosCreated}`);
  check('5c. 未重复存选题', (seed2Data?.questionsSaved ?? -1) === 0, `saved=${seed2Data?.questionsSaved}`);

  const list2 = await api(`/api/v2/growth/geo/scenarios?category=${encodeURIComponent(CATEGORY)}`, { token });
  const rows2 = unwrap(list2.body)?.scenarios ?? unwrap(list2.body) ?? [];
  check('5d. 场景总数未增长', Array.isArray(rows2) && rows2.length === rows.length,
    `before=${rows.length} after=${Array.isArray(rows2) ? rows2.length : 'n/a'}`);

  // ── 6) 单场景派生预览 ──
  console.log('\n[6] 单场景派生 prompt 簇（dryRun）');
  if (scenarioId) {
    const derive = await api(`/api/v2/growth/geo/scenarios/${scenarioId}/derive`, {
      method: 'POST', token, body: { dryRun: true },
    });
    const dData = unwrap(derive.body);
    check('6a. 派生 201/200', derive.status === 201 || derive.status === 200, `status=${derive.status}`);
    check('6b. 产出选题且带打分', Array.isArray(dData?.topics) && dData.topics.length > 0 && typeof dData.topics[0]?.score === 'number',
      `topics=${dData?.topics?.length}`);
    check('6c. dryRun 未落库', dData?.saved === 0 || dData?.dryRun === true);

    // 9) 打分生效：decide 型应优先于 info 型（priority 越小越优先）
    const topics = Array.isArray(dData?.topics) ? dData.topics : [];
    const bestDecide = Math.min(...topics.filter((t) => t.intent === 'decide').map((t) => t.priority), Infinity);
    const bestInfo = Math.min(...topics.filter((t) => t.intent === 'info').map((t) => t.priority), Infinity);
    check('6d. 决策型选题优先级高于信息型（商业价值打分生效）',
      Number.isFinite(bestDecide) && Number.isFinite(bestInfo) ? bestDecide < bestInfo : true,
      `decide=${bestDecide} info=${bestInfo}`);
  } else {
    check('6a. 派生（跳过：无场景 id）', false, 'scenarioId 缺失');
  }

  // ── 7) 启动序列编排 ──
  console.log('\n[7] 启动序列 geo/bootstrap');
  const bootCategory = `${CATEGORY}B`;
  const boot = await api('/api/v2/growth/geo/bootstrap', {
    method: 'POST', token,
    body: {
      brandSlug: BRAND, category: bootCategory, painPoints: PAIN_POINTS,
      maxScenarios: 3, runBaseline: RUN_BASELINE,
    },
  });
  const bootData = unwrap(boot.body);
  check('7a. 启动序列 201/200', boot.status === 201 || boot.status === 200,
    `status=${boot.status} body=${JSON.stringify(boot.body).slice(0, 240)}`);
  const steps = bootData?.steps || [];
  const seedStep = steps.find((s) => s.step === 'seed-scenarios');
  check('7b. 播种步骤 ok', seedStep?.status === 'ok', `step=${JSON.stringify(seedStep || {}).slice(0, 160)}`);
  const baseStep = steps.find((s) => s.step === 'baseline-probe');
  check('7c. 基线步骤状态如实上报（不伪造）',
    !!baseStep && ['ok', 'failed', 'skipped'].includes(baseStep.status),
    `step=${JSON.stringify(baseStep || {}).slice(0, 160)}`);
  if (RUN_BASELINE) {
    console.log(`     ℹ️  基线探测结果：${baseStep?.status}${baseStep?.error ? ` — ${String(baseStep.error).slice(0, 120)}` : ''}`);
  }
  check('7d. 返回后续待办且内容生成标为 yellow',
    Array.isArray(bootData?.nextActions)
      && bootData.nextActions.some((a) => a.actionId === 'geo.generate-content' && a.zone === 'yellow'),
    `next=${JSON.stringify(bootData?.nextActions || []).slice(0, 200)}`);

  const bootList = await api(`/api/v2/growth/geo/scenarios?category=${encodeURIComponent(bootCategory)}`, { token });
  const bootRows = unwrap(bootList.body)?.scenarios ?? unwrap(bootList.body) ?? [];
  check('7e. 启动序列真落了场景', Array.isArray(bootRows) && bootRows.length > 0,
    `rows=${Array.isArray(bootRows) ? bootRows.length : 'n/a'}`);

  // ── 8) 受治理动作入口（人与 AI Agent 同一闸）──
  console.log('\n[8] 受治理动作入口');
  const actions = await api('/api/v2/growth/geo/actions', { token });
  const actionList = unwrap(actions.body)?.actions ?? unwrap(actions.body) ?? [];
  const bootAction = Array.isArray(actionList) ? actionList.find((a) => a.id === 'geo.bootstrap-brand-category') : null;
  check('8a. 启动序列已注册为受治理动作', !!bootAction, `actions=${Array.isArray(actionList) ? actionList.length : 'n/a'}`);
  check('8b. 标记为 green（只建选题+只读探测）', bootAction?.zone === 'green', `zone=${bootAction?.zone}`);

  const invoked = await api('/api/v2/growth/geo/actions/geo.bootstrap-brand-category', {
    method: 'POST', token,
    body: {
      input: {
        brandSlug: BRAND, category: `${CATEGORY}C`, painPoints: PAIN_POINTS,
        maxScenarios: 2, runBaseline: false,
      },
    },
  });
  check('8c. green 动作可直接执行（无需人工核准）',
    (invoked.status === 201 || invoked.status === 200) && invoked.body?.success === true && !invoked.body?.blocked,
    `status=${invoked.status} body=${JSON.stringify(invoked.body).slice(0, 200)}`);

  const invalid = await api('/api/v2/growth/geo/actions/geo.bootstrap-brand-category', {
    method: 'POST', token, body: { input: { brandSlug: BRAND } }, // 缺 category
  });
  check('8d. 缺参被动作校验拦下（不进主执行）',
    invalid.body?.success === false || invalid.status >= 400,
    `status=${invalid.status} body=${JSON.stringify(invalid.body).slice(0, 200)}`);

  finish();
}

function finish() {
  console.log(`\n${'─'.repeat(60)}`);
  if (failures.length === 0) {
    console.log(`✅ GEO 冷启动集成测试全部通过（${passed} 项断言）`);
    process.exit(0);
  }
  console.log(`❌ ${failures.length} 项失败 / ${passed} 项通过`);
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}

main().catch((e) => { console.error('集成测试异常:', e.message); process.exit(1); });
