#!/usr/bin/env node
/**
 * Brain Load Test · 30 人测试上线前的并发摸底
 * ─────────────────────────────────────────────────────────
 * 目的:
 *   - 模拟 N 个用户同时用 BossAI, 量化"30 人测试翻不翻车":
 *     - 延迟 (avg / p50 / p95 / p99)
 *     - 成功率
 *     - 平均输出长度
 *     - LLM 成本估算 (按 DeepSeek pricing)
 *
 * 用法:
 *   1. 起 dev: $env:ALLOW_DEMO_AUTH='1'; npm run dev
 *   2. node scripts/brain-load.mjs --users 30 --duration 60
 *      可选: --ramp 10 (10s 内逐步起 30 人) · --think 3 (用户两次问之间思考 3s)
 *
 * 安全:
 *   - 默认 1 用户 / 30s , 避免误炸; --users >=10 需要 --confirm
 *   - 每 5s 打印一次进度, Ctrl+C 干净中止
 *
 * 输出: 表格 + .brain-load-{ts}.json 留档
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// ────────────────── 参数 ──────────────────

function argv(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v ?? fallback;
}

const BASE = argv('base', process.env.SMOKE_BASE ?? 'http://localhost:3005');
const USERS = parseInt(argv('users', '1'), 10);
const DURATION_SEC = parseInt(argv('duration', '30'), 10);
const RAMP_SEC = parseInt(argv('ramp', '0'), 10);
const THINK_SEC = parseFloat(argv('think', '2'));
const CONFIRM = process.argv.includes('--confirm');

if (USERS >= 10 && !CONFIRM) {
  console.error(`⚠ users=${USERS} 较大, 可能炸 LLM 配额. 加 --confirm 后重跑.`);
  process.exit(2);
}

// ────────────────── 场景轮换 ──────────────────

const QUESTIONS = [
  '你好, 介绍下自己',
  '我们公司本季 OKR 进度怎么样?',
  '本周我有哪些待办?',
  '现在 3 个项目都缺人 (A 新客户/B 续费大客户/C 内部工具), 砍哪个?',
  '帮我列一下张三上周做了什么',
  '我们部门的 KR 哪些 at-risk?',
  '帮我起草一封邮件给客户, 致歉延期',
  '复盘下周的工作',
];

function pickQuestion(uid, count) {
  return QUESTIONS[(uid * 7 + count * 3) % QUESTIONS.length];
}

// ────────────────── HTTP ──────────────────

async function callBossAi(question, signal) {
  const start = Date.now();
  let res;
  try {
    res = await fetch(`${BASE}/api/boss-ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: question }] }),
      signal,
    });
  } catch (err) {
    return { ok: false, error: `fetch: ${err.message}`, latencyMs: Date.now() - start };
  }
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, latencyMs: Date.now() - start };

  const reader = res.body?.getReader();
  if (!reader) return { ok: false, error: 'no body', latencyMs: Date.now() - start };
  const decoder = new TextDecoder();
  let buf = '';
  let content = '';
  let doneMeta = null;
  let firstByteMs = null;
  while (true) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch {}
      return { ok: false, error: 'aborted', latencyMs: Date.now() - start };
    }
    const { done, value } = await reader.read();
    if (done) break;
    if (firstByteMs === null) firstByteMs = Date.now() - start;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (typeof evt.content === 'string') content += evt.content;
        if (evt.done) doneMeta = evt;
        if (typeof evt.error === 'string') {
          return { ok: false, error: evt.error, latencyMs: Date.now() - start, content };
        }
      } catch {}
    }
  }
  return { ok: true, content, doneMeta, latencyMs: Date.now() - start, firstByteMs };
}

// ────────────────── 用户 worker ──────────────────

async function userWorker(uid, endAt, results, signal, startDelayMs) {
  if (startDelayMs > 0) await sleep(startDelayMs);
  let count = 0;
  while (Date.now() < endAt && !signal.aborted) {
    const q = pickQuestion(uid, count);
    const r = await callBossAi(q, signal);
    results.push({ uid, q, ok: r.ok, error: r.error, latencyMs: r.latencyMs, firstByteMs: r.firstByteMs, contentLen: r.content?.length ?? 0 });
    count += 1;
    if (Date.now() >= endAt) break;
    await sleep(THINK_SEC * 1000);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ────────────────── 统计 ──────────────────

function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(results, elapsedSec) {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const lat = ok.map((r) => r.latencyMs);
  const ftb = ok.filter((r) => r.firstByteMs != null).map((r) => r.firstByteMs);
  const lens = ok.map((r) => r.contentLen);
  const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

  // 成本估算 (粗): 假设 inputTokens ~ 3000 (含 systemPrompt), outputTokens ~ contentLen/2 (中文)
  // DeepSeek 价: input 0.001 元/1k, output 0.002 元/1k (≈ $0.00014/$0.00028 USD)
  let cnyTotal = 0;
  for (const r of ok) {
    const inputTok = 3000;
    const outputTok = Math.ceil(r.contentLen / 2);
    cnyTotal += (inputTok / 1000) * 0.001 + (outputTok / 1000) * 0.002;
  }

  return {
    elapsedSec,
    total: results.length,
    ok: ok.length,
    failed: failed.length,
    successRate: results.length ? ok.length / results.length : 0,
    qps: results.length / Math.max(elapsedSec, 1),
    latency: {
      avg: Math.round(avg(lat)),
      p50: pct(lat, 50),
      p95: pct(lat, 95),
      p99: pct(lat, 99),
      max: lat.length ? Math.max(...lat) : 0,
    },
    firstByteMs: {
      avg: Math.round(avg(ftb)),
      p95: pct(ftb, 95),
    },
    avgContentLen: Math.round(avg(lens)),
    estimatedCnyDeepseek: cnyTotal.toFixed(4),
    estimatedCnyPer1000Req: ok.length ? ((cnyTotal / ok.length) * 1000).toFixed(2) : '0',
    failureReasons: failed.reduce((acc, r) => {
      const key = (r.error ?? 'unknown').slice(0, 60);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

// ────────────────── 主流程 ──────────────────

async function main() {
  console.log(`\n🔥 Brain Load Test · ${BASE}`);
  console.log(`   users=${USERS} duration=${DURATION_SEC}s ramp=${RAMP_SEC}s think=${THINK_SEC}s`);
  console.log(`   开始: ${new Date().toISOString()}\n`);

  // 健康探活
  try {
    const h = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!h.ok) { console.error(`❌ /api/health ${h.status}`); process.exit(2); }
  } catch (err) {
    console.error(`❌ 连不上 ${BASE}: ${err.message}`); process.exit(2);
  }

  const ctrl = new AbortController();
  process.on('SIGINT', () => {
    console.log('\n⏹ Ctrl+C — 优雅中止 (等当前请求完成)');
    ctrl.abort();
  });

  const results = [];
  const startMs = Date.now();
  const endMs = startMs + DURATION_SEC * 1000;

  // 进度打印
  const progressTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startMs) / 1000);
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const avgLat = ok > 0 ? Math.round(results.filter((r) => r.ok).reduce((s, r) => s + r.latencyMs, 0) / ok) : 0;
    process.stdout.write(`\r  [${elapsed}s] req=${results.length} ok=${ok} fail=${failed} avgLat=${avgLat}ms`);
  }, 1000);

  // 起 users 个 worker, ramp 内均匀分布起点
  const workers = [];
  for (let uid = 0; uid < USERS; uid++) {
    const startDelay = RAMP_SEC > 0 ? Math.floor((RAMP_SEC * 1000 * uid) / USERS) : 0;
    workers.push(userWorker(uid, endMs, results, ctrl.signal, startDelay));
  }
  await Promise.all(workers);
  clearInterval(progressTimer);
  process.stdout.write('\n');

  const elapsedSec = (Date.now() - startMs) / 1000;
  const sum = summarize(results, elapsedSec);

  // ────────────────── 输出 ──────────────────
  console.log('\n┌────────────────────────────────────────────────────┐');
  console.log(`│  Brain Load 报告 · ${USERS} 并发用户 / ${DURATION_SEC}s`.padEnd(53) + '│');
  console.log('├────────────────────────────────────────────────────┤');
  console.log(`│ 总请求:        ${String(sum.total).padEnd(36)}│`);
  console.log(`│ 成功 / 失败:   ${String(sum.ok + ' / ' + sum.failed).padEnd(36)}│`);
  console.log(`│ 成功率:        ${(sum.successRate * 100).toFixed(1) + '%'.padEnd(34)}│`);
  console.log(`│ QPS:           ${sum.qps.toFixed(2).padEnd(36)}│`);
  console.log('├────────────────────────────────────────────────────┤');
  console.log(`│ 延迟 avg:      ${(sum.latency.avg + 'ms').padEnd(36)}│`);
  console.log(`│ 延迟 p50:      ${(sum.latency.p50 + 'ms').padEnd(36)}│`);
  console.log(`│ 延迟 p95:      ${(sum.latency.p95 + 'ms').padEnd(36)}│`);
  console.log(`│ 延迟 p99:      ${(sum.latency.p99 + 'ms').padEnd(36)}│`);
  console.log(`│ 延迟 max:      ${(sum.latency.max + 'ms').padEnd(36)}│`);
  console.log(`│ 首字节 avg:    ${(sum.firstByteMs.avg + 'ms').padEnd(36)}│`);
  console.log(`│ 首字节 p95:    ${(sum.firstByteMs.p95 + 'ms').padEnd(36)}│`);
  console.log('├────────────────────────────────────────────────────┤');
  console.log(`│ 平均输出长度:  ${(sum.avgContentLen + ' chars').padEnd(36)}│`);
  console.log(`│ DeepSeek 估算: ${('¥ ' + sum.estimatedCnyDeepseek + ' (总)').padEnd(36)}│`);
  console.log(`│ 每千请求成本:  ${('¥ ' + sum.estimatedCnyPer1000Req).padEnd(36)}│`);
  console.log('└────────────────────────────────────────────────────┘');

  if (sum.failed > 0) {
    console.log('\n失败原因 (top):');
    for (const [k, v] of Object.entries(sum.failureReasons).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`  ${v}× ${k}`);
    }
  }

  // ────────────────── 30 人测试就绪判定 ──────────────────
  console.log('\n30 人测试就绪判定:');
  const verdicts = [];
  if (sum.successRate < 0.95) verdicts.push(`✗ 成功率 ${(sum.successRate * 100).toFixed(1)}% < 95% (不可上)`);
  else verdicts.push(`✓ 成功率 ${(sum.successRate * 100).toFixed(1)}% ≥ 95%`);
  if (sum.latency.p95 > 30000) verdicts.push(`✗ p95 延迟 ${sum.latency.p95}ms > 30s (用户会以为卡死)`);
  else verdicts.push(`✓ p95 延迟 ${sum.latency.p95}ms ≤ 30s`);
  if (sum.firstByteMs.p95 > 8000) verdicts.push(`✗ p95 首字节 ${sum.firstByteMs.p95}ms > 8s (无即时反馈感)`);
  else verdicts.push(`✓ p95 首字节 ${sum.firstByteMs.p95}ms ≤ 8s`);
  const dailyCny30 = parseFloat(sum.estimatedCnyPer1000Req) * 30 * 50 / 1000; // 30 人, 每人 50 req/天
  console.log(`  ${verdicts.join('\n  ')}`);
  console.log(`  💰 估算: 30 人 × 50 req/day × 30 天 ≈ ¥ ${(dailyCny30 * 30).toFixed(2)} / 月`);

  // 落档
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = resolve(REPO_ROOT, `.brain-load-${ts}.json`);
  writeFileSync(filePath, JSON.stringify({ args: { BASE, USERS, DURATION_SEC, RAMP_SEC, THINK_SEC }, summary: sum, samples: results.slice(0, 20) }, null, 2));
  console.log(`\n详细数据落档: ${filePath}`);

  process.exit(sum.failed > sum.ok ? 1 : 0);
}

main().catch((err) => { console.error('brain-load crashed:', err); process.exit(3); });
