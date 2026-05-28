#!/usr/bin/env node
/**
 * pre-warm.mjs — 跨平台预热脚本 (Node 18+ 自带 fetch)
 *
 * 触发 Next.js dev 模式按需编译，避免演示时点新页面卡顿 3-5 秒。
 *
 * 使用：
 *   npm run pre-warm
 *   或：node scripts/pre-warm.mjs
 *
 * 对应 docs/AI-SETUP.md 第三节。
 * Windows 用户也可直接调 scripts/pre-warm.ps1（功能等价）。
 */

const PAGES = [
  '/',
  '/chat',
  '/agents',
  '/settings/llm',
  '/partner/join',
  '/register/employee',
  '/okr',
  '/report',
  '/report/weekly',
  '/kpi',
  '/im',
  '/convergence',
  '/1on1',
  '/360',
  '/nine-box',
];

const BASE_URL = process.env.PREWARM_BASE_URL ?? 'http://localhost:3000';
const TIMEOUT_MS = 30_000;

console.log('Tandem · 预热主页面，触发本地按需编译...');
console.log(`Base URL: ${BASE_URL}\n`);

let okCount = 0;
let failCount = 0;

for (const path of PAGES) {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    const elapsed = Date.now() - t0;
    // 401 = 路由就位但需登录，同样代表已编译
    if (res.ok || res.status === 401 || res.status === 302 || res.status === 307) {
      console.log(`  ✓  ${path}  (${res.status}, ${elapsed}ms)`);
      okCount += 1;
    } else {
      console.log(`  !  ${path}  (HTTP ${res.status}, ${elapsed}ms)`);
      okCount += 1; // 仍然算预热到了
    }
  } catch (err) {
    const elapsed = Date.now() - t0;
    console.log(`  ✗  ${path}  (${(err instanceof Error ? err.message : 'unknown')}, ${elapsed}ms)`);
    failCount += 1;
  } finally {
    clearTimeout(timer);
  }
}

console.log(`\n预热完成: ${okCount} 成功 / ${failCount} 失败 / 共 ${PAGES.length} 个页面`);
process.exit(failCount > 0 ? 1 : 0);
