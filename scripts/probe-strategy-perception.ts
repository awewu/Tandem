#!/usr/bin/env tsx
/**
 * 真模型探针 · StratOS 战略合理性→中央AI感知 (防"假闭环"验证, 姿势 B)
 * ─────────────────────────────────────────────────────────
 * 目的: 用真 DeepSeek 确认中央 AI 感知 pass 面对"战略合理性/前提是否失效/该不该坚守"
 *       类问题时, **真的会调用** 新接入的只读技能 `strategy.validity_digest` (战略之眼),
 *       而非只在代码里注册却从不触发。
 *
 * 机制: 直连 companyBrainPerceptionPass, 检查返回的 toolInvocations 是否含 strategy.validity_digest。
 *       (tool-loop 会把技能 id 的点 sanitize 成下划线喂 LLM function-calling, 返回时还原,
 *        故这里断言还原后的点号 id。)
 *
 * 两级判定:
 *   - 命中调用 (LLM 选了该工具)      → 感知接线真闭环成立 (非注册即死代码)。
 *   - 且 ok=true (StratOS 端点可达)  → 跨仓数据链路真通 (需 STRATOS_PERCEPTION_URL/TOKEN + StratOS 在线)。
 *     未配 URL/TOKEN 或 StratOS 未起时 ok=false 属预期 (fail-soft), 探针仍以"命中调用"为成功基线。
 *
 * 用法: npx tsx scripts/probe-strategy-perception.ts
 *       需 .env.local 内有 DEEPSEEK_API_KEY (真付费调用)。
 *       完整跨仓验证还需 STRATOS_PERCEPTION_URL + STRATOS_PERCEPTION_TOKEN 且 StratOS 在线。
 * 退出码: 0 = 命中 strategy.validity_digest; 1 = 未命中; 2 = 环境/执行错误。
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ── 1. 先加载 .env.local 到 process.env (务必在任何 app 模块 import 之前) ──
function loadEnvLocal(): void {
  const p = resolve(REPO_ROOT, '.env.local');
  if (!existsSync(p)) {
    console.error('❌ 缺 .env.local');
    process.exit(2);
  }
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const STRATEGY_QUERY =
  '我们当前的战略前提还成立吗？有没有已经失效或高度脆弱的假设？战略诊断的核心 crux 是什么？哪些重大投资 Bet 的门禁或现金 runway 已经亮红灯，需要考虑是坚守还是转向(pivot/kill)？';

async function main() {
  loadEnvLocal();
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ .env.local 无 DEEPSEEK_API_KEY, 无法做真模型探针');
    process.exit(2);
  }
  console.log('🛰  StratOS 战略感知真模型探针');
  console.log(`   model=${process.env.DEEPSEEK_MODEL ?? '(default)'} · db=${process.env.DATABASE_URL ? 'on' : 'off'}`);
  console.log(`   stratosBridge=${process.env.STRATOS_PERCEPTION_URL && process.env.STRATOS_PERCEPTION_TOKEN ? 'configured' : 'NOT configured (期望 ok=false, fail-soft)'}`);
  console.log(`   query="${STRATEGY_QUERY}"\n`);

  // ── 2. env 就绪后再动态 import app 模块 (drizzle-client 在 import 时读 DATABASE_URL) ──
  const { boot } = await import('@/lib/boot');
  const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');

  await boot();

  const t0 = Date.now();
  const res = await companyBrainPerceptionPass(STRATEGY_QUERY, '你是瑞合瑞德集团的中央 AI。');
  const ms = Date.now() - t0;

  const names = res.toolInvocations.map((t) => `${t.name}${t.ok ? '' : '(fail)'}`);
  console.log(`perceived=${res.perceived} · rounds=${res.log.roundsExecuted} · toolCalls=${res.log.toolCallCount} · ${ms}ms`);
  console.log(`toolInvocations: ${names.length ? names.join(', ') : '(none)'}\n`);

  const hit = res.toolInvocations.find((t) => t.name === 'strategy.validity_digest');
  if (hit) {
    console.log(`✅ 命中: 中央 AI 真的调用了 strategy.validity_digest (ok=${hit.ok})`);
    if (hit.ok) {
      console.log('   → 战略→中央AI感知 跨仓数据链路真通 (StratOS 端点可达)。');
    } else {
      console.log('   → 感知接线真闭环成立 (非死代码); StratOS 端点未配置/未在线, ok=false 属预期 fail-soft。');
      console.log('     配 STRATOS_PERCEPTION_URL + STRATOS_PERCEPTION_TOKEN 且 StratOS 在线后可验证完整数据链路。');
    }
    process.exit(0);
  }
  console.log('❌ 未命中 strategy.validity_digest。');
  console.log('   可能原因: 感知 gate 未触发 / LLM 本轮选了其它工具 / 该技能未注册。请检查上面的 toolInvocations。');
  process.exit(1);
}

main().catch((err) => {
  console.error('探针崩溃:', err);
  process.exit(2);
});
