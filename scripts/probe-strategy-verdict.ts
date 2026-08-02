#!/usr/bin/env tsx
/**
 * 真模型探针 · StratOS 合理性裁决端点 (防"假闭环": 确认中央 AI 真能产出结构化裁决)
 * ─────────────────────────────────────────────────────────────────────────
 * 直接复用 strategy-verdict 路由的**真实**系统提示 VERDICT_SYSTEM + extractJson,
 * 喂一份合成战略摘要 (含脆弱前提/at-risk Bet/低 runway), 用真 DeepSeek 跑一遍,
 * 断言返回的是可解析 JSON 且含 overallStance + premises/bets 的 recommendation。
 *
 * 这样验证的是裁决**生成能力**本身 (核心风险), 不依赖 HTTP/服务令牌/dev server。
 *
 * 用法: npx tsx scripts/probe-strategy-verdict.ts   (需 .env.local 有 DEEPSEEK_API_KEY)
 * 退出码: 0 = 结构化裁决成立; 1 = 解析/字段不达标; 2 = 环境/执行错误。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function loadEnvLocal(): void {
  const p = resolve(REPO_ROOT, '.env.local');
  if (!existsSync(p)) { console.error('❌ 缺 .env.local'); process.exit(2); }
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

const SAMPLE_DIGEST = {
  diagnosis: {
    crux: '增长依赖单一大客户, 第二曲线未验证',
    challengeStatement: '两年内把非核心客户营收占比从 15% 提到 40%',
    bottleneckType: 'market',
    period: '2026-H1',
  },
  hardBlocks: [
    { assertionType: 'gross_margin_floor', message: '毛利率跌破 25% 底线', metricValue: 22, thresholdValue: 25 },
  ],
  fragilePremises: [
    { code: 'P3', premise: '核心大客户未来两年维持 30% 采购增长', category: 'market', confidence: 25, fragility: 92, failSignal: '该客户 Q1 采购环比下滑 18%' },
    { code: 'P5', premise: '新产线良率 6 个月内爬升至 90%', category: 'capability', confidence: 55, fragility: 75, failSignal: null },
  ],
  topDiffs: [
    { category: 'market', severity: 'critical', title: '大客户集中度风险显性化', formationType: 'external_shock' },
  ],
  bets: [
    { code: 'B1', title: '东南亚新建产能', type: 'capacity', gateStatus: 'review', fpaToggle: 'off', capexTotal: 12000 },
    { code: 'B2', title: '第二曲线 SaaS 试点', type: 'growth', gateStatus: 'approved', fpaToggle: 'on', capexTotal: 3000 },
  ],
  fpa: { revenueBudget: 80000, revenueForecast: 71000, profitForecast: 6000, cashRunwayMonths: 2 },
  counts: { premises: 6, fragilePremises: 2, hardBlocks: 1, bets: 2 },
};

async function main() {
  loadEnvLocal();
  if (!process.env.DEEPSEEK_API_KEY) { console.error('❌ .env.local 无 DEEPSEEK_API_KEY'); process.exit(2); }
  console.log('🛰  StratOS 合理性裁决真模型探针');
  console.log(`   model=${process.env.DEEPSEEK_MODEL ?? '(default)'}\n`);

  const { boot, getRouter } = await import('@/lib/boot');
  const { VERDICT_SYSTEM, extractJson } = await import('@/app/api/company-brain/strategy-verdict/route');
  await boot();
  const router = getRouter();

  const t0 = Date.now();
  // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: 离线探针, 无用户 session
  const res = await router.chat({
    scenario: 'reasoning_complex',
    temperature: 0.3,
    responseFormat: 'json',
    messages: [
      { role: 'system', content: VERDICT_SYSTEM },
      { role: 'user', content: '这是当前战略合理性传感器摘要 (JSON):\n' + JSON.stringify(SAMPLE_DIGEST, null, 2) + '\n\n请据此输出你的合理性裁决 JSON。' },
    ],
    metadata: { requestId: 'probe-strategy-verdict' },
  });
  const ms = Date.now() - t0;

  const content = typeof res.message.content === 'string' ? res.message.content : '';
  let verdict: Record<string, unknown>;
  try {
    verdict = extractJson(content) as Record<string, unknown>;
  } catch {
    console.log(`❌ 未返回可解析 JSON (${ms}ms):`, content.slice(0, 300));
    process.exit(1);
  }

  const stance = verdict.overallStance;
  const premises = Array.isArray(verdict.premises) ? verdict.premises : [];
  const bets = Array.isArray(verdict.bets) ? verdict.bets : [];
  const validStance = ['persevere', 'pivot', 'kill', 'mixed'].includes(String(stance));
  const hasRecs = [...premises, ...bets].some((x) => x && typeof x === 'object' && 'recommendation' in x);

  console.log(`model=${res.model} · ${ms}ms`);
  console.log(`overallStance=${String(stance)} · crux="${String(verdict.crux ?? '').slice(0, 60)}"`);
  console.log(`premises=${premises.length} · bets=${bets.length}\n`);

  if (validStance && hasRecs) {
    console.log('✅ 中央 AI 产出了结构化合理性裁决 (overallStance + 逐条 recommendation)。');
    console.log('   → 姿势 B 裁决生成真闭环成立。');
    process.exit(0);
  }
  console.log('❌ 裁决结构不达标 (缺 overallStance 或逐条 recommendation)。');
  console.log(JSON.stringify(verdict, null, 2).slice(0, 500));
  process.exit(1);
}

main().catch((err) => { console.error('探针崩溃:', err); process.exit(2); });
