/**
 * Probe · DeepSeek thinking-in-tool-use 闭环验证 (B-027 防假闭环)
 *
 * 目的: 核实 deepseek-reasoner (V3.2 thinking) 能在同一模型里
 *   ① 返回 tool_calls (function calling)
 *   ② 返回 reasoning_content (思考态)
 *   ③ 把 reasoning_content 原样回传后不 400, 并给出最终答复
 *
 * 用法: node scripts/probe-deepseek-thinking-tools.mjs
 * 读取 .env.local 的 DEEPSEEK_BASE_URL / DEEPSEEK_R1_MODEL / DEEPSEEK_API_KEY。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (err) {
    console.error('[probe] cannot read .env.local:', err.message);
  }
  return env;
}

const env = loadEnvLocal();
const BASE_URL = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
const MODEL = env.DEEPSEEK_R1_MODEL || 'deepseek-reasoner';
const API_KEY = env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error('[probe] FAIL · DEEPSEEK_API_KEY 未配置');
  process.exit(1);
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_okr_progress',
      description: '查询某个 Objective 的实时进度 (0-100)',
      parameters: {
        type: 'object',
        properties: { objectiveId: { type: 'string', description: 'Objective ID' } },
        required: ['objectiveId'],
      },
    },
  },
];

async function call(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: 'auto', stream: false }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json();
}

async function main() {
  console.log(`[probe] model=${MODEL} base=${BASE_URL}`);
  const messages = [
    { role: 'user', content: '目标 obj-2026-q3 现在完成到多少了? 请先查一下再回答。' },
  ];

  // Round 1: 期望 tool_calls + reasoning_content
  const r1 = await call(messages);
  const m1 = r1.choices[0].message;
  const hasTool = Array.isArray(m1.tool_calls) && m1.tool_calls.length > 0;
  const hasReasoning = typeof m1.reasoning_content === 'string' && m1.reasoning_content.length > 0;
  console.log(`[probe] round1 · tool_calls=${hasTool} · reasoning_content=${hasReasoning}`);
  if (!hasTool) {
    console.error('[probe] FAIL · round1 未返回 tool_calls (function calling 不生效)');
    process.exit(1);
  }

  // 回传: assistant 消息必须带 reasoning_content (thinking 模式硬约束) + tool 结果
  messages.push({
    role: 'assistant',
    content: m1.content ?? '',
    reasoning_content: m1.reasoning_content,
    tool_calls: m1.tool_calls,
  });
  for (const tc of m1.tool_calls) {
    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ progress: 62 }) });
  }

  // Round 2: 期望最终答复, 不 400 (证明 reasoning_content 回传被正确接受)
  const r2 = await call(messages);
  const m2 = r2.choices[0].message;
  const finalOk = typeof m2.content === 'string' && m2.content.trim().length > 0;
  console.log(`[probe] round2 · final content len=${(m2.content || '').length}`);
  console.log(`[probe] final answer: ${(m2.content || '').slice(0, 200)}`);

  if (hasTool && hasReasoning && finalOk) {
    console.log('[probe] PASS · 推理+工具同一模型闭环跑通 (thinking-in-tool-use)');
    process.exit(0);
  }
  console.error('[probe] FAIL · 闭环未完整满足 (tool/reasoning/final 三者之一缺失)');
  process.exit(1);
}

main().catch((err) => {
  console.error('[probe] FAIL ·', err.message);
  process.exit(1);
});
