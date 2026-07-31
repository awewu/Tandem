#!/usr/bin/env tsx
/**
 * 真模型探针 · Phase4 memory.timeline (防"假闭环"验证)
 * ─────────────────────────────────────────────────────────
 * 目的: 用真 DeepSeek 确认中央 AI 感知 pass 面对"某实体一路怎么演进 / 来龙去脉 / 版本取代"
 *       这类**时间/因果轴**问题时, 真的会调用新接入的只读技能 `memory.timeline`
 *       (MAGMA-lite 时间因果链), 而非只在 PERCEPTION_TOOLSET 里注册却从不触发。
 *
 * 机制: 直连 companyBrainPerceptionPass, 检查返回的 toolInvocations 是否含 memory.timeline。
 *       (tool-loop 会把技能 id 的点 sanitize 成下划线喂 LLM function-calling, 返回时还原,
 *        故这里断言还原后的点号 id。) 该探针只证明"LLM 会选这个工具", 与库里是否恰好有该
 *        实体的记忆无关 —— 选择依据是 schema/description, 不是数据是否命中。
 *
 * 用法: npx tsx scripts/probe-memory-timeline.ts
 *       需 .env.local 内有 DEEPSEEK_API_KEY (真付费调用)。
 * 退出码: 0 = 命中 memory.timeline; 1 = 未命中; 2 = 环境/执行错误。
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

const TIMELINE_QUERY =
  'KR-3 这个关键结果从立项到现在一路是怎么演进的？哪一版方案取代了哪一版？帮我把中间的来龙去脉按时间线梳理清楚。';

async function main() {
  loadEnvLocal();
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ .env.local 无 DEEPSEEK_API_KEY, 无法做真模型探针');
    process.exit(2);
  }
  console.log('🛰  memory.timeline 感知真模型探针');
  console.log(`   model=${process.env.DEEPSEEK_MODEL ?? '(default)'} · db=${process.env.DATABASE_URL ? 'on' : 'off'}`);
  console.log(`   query="${TIMELINE_QUERY}"\n`);

  // ── 2. env 就绪后再动态 import app 模块 (drizzle-client 在 import 时读 DATABASE_URL) ──
  const { boot } = await import('@/lib/boot');
  const { companyBrainPerceptionPass } = await import('@/lib/persona/company-brain-perception');

  await boot();

  const t0 = Date.now();
  const res = await companyBrainPerceptionPass(TIMELINE_QUERY, '你是瑞合瑞德集团的中央 AI。');
  const ms = Date.now() - t0;

  const names = res.toolInvocations.map((t) => `${t.name}${t.ok ? '' : '(fail)'}`);
  console.log(`perceived=${res.perceived} · rounds=${res.log.roundsExecuted} · toolCalls=${res.log.toolCallCount} · ${ms}ms`);
  console.log(`toolInvocations: ${names.length ? names.join(', ') : '(none)'}\n`);

  const hit = res.toolInvocations.find((t) => t.name === 'memory.timeline');
  if (hit) {
    console.log(`✅ 命中: 中央 AI 真的调用了 memory.timeline (ok=${hit.ok})`);
    console.log('   → Phase4 记忆时间/因果链 真闭环成立 (非注册即死代码)。');
    process.exit(0);
  }
  console.log('❌ 未命中 memory.timeline。');
  console.log('   可能原因: 感知 gate 未触发 / LLM 本轮选了 memory.search 等其它工具 / 该技能未注册。请检查上面的 toolInvocations。');
  process.exit(1);
}

main().catch((err) => {
  console.error('探针崩溃:', err);
  process.exit(2);
});
