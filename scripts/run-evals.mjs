#!/usr/bin/env node
/**
 * scripts/run-evals.mjs · Production Evals Runner (cross-platform)
 *
 * 干 3 件事:
 *   1. 设置 RUN_EVALS=1 (在线 LLM 案例进闸 — 当前 tests/eval 全是离线, 留扩展点)
 *   2. 调 vitest run tests/eval, 把日志打到 stdout
 *   3. 退出码透传
 *
 * 用法:
 *   npm run evals          # 仅离线 (RUN_EVALS unset, online case skip)
 *   npm run evals:online   # 在线 (RUN_EVALS=1, 调真 LLM)
 *
 * 后续 (P2):
 *   - --suite=memory-rerank 单 suite 跑
 *   - --report=md 输出 markdown report
 *   - --push-usage POST 到 /api/admin/usage (跑完写入看板)
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const env = {
  ...process.env,
  RUN_EVALS: '1',
};

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const args = ['vitest', 'run', 'tests/eval', '--reporter=verbose'];

console.log('[evals] RUN_EVALS=1 · running suite under tests/eval/');
console.log(`[evals] cwd=${repoRoot}`);
console.log(`[evals] $ ${cmd} ${args.join(' ')}`);
console.log('-'.repeat(60));

const child = spawn(cmd, args, {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
  // Node 18+ on Windows needs shell:true for .cmd shims
  shell: isWin,
});

child.on('exit', (code) => {
  console.log('-'.repeat(60));
  if (code === 0) {
    console.log('[evals] ✅ all suites passed');
  } else {
    console.log(`[evals] ❌ vitest exited with code ${code}`);
  }
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error('[evals] spawn failed:', err);
  process.exit(1);
});
