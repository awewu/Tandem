#!/usr/bin/env node
/**
 * P0-1 门禁 · 核心域测试保护（core-domain-coverage-check）
 *
 * 委员会「改动不安全」裁决的机器化验收：核心「亏钱/漏数据」逻辑必须有单测保护，
 * 且不得被静默删除。本 guard 强制：
 *   1) 核心域 nodetest 必须存在（回归保护——删测即红灯）；
 *   2) 核心域 nodetest 全绿（0 失败）；
 *   3) 纯决策逻辑文件 design-sync.service.ts 行覆盖率 ≥ 阈值（真相源同步是 M12 命门）。
 *
 * 零新依赖：用 Node 内置 test runner + --experimental-test-coverage + ts-node/transpile-only。
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TS_PROJECT = 'services/api/tsconfig.json';

// 核心域必测文件（modulePath → 必须存在的 nodetest）
const REQUIRED_TESTS = [
  'services/api/src/modules/rysnova-bim/design-sync.nodetest.ts',   // M12 真相源同步状态机
  'services/api/src/modules/quote/quote-lock.nodetest.ts',          // 价格快照锁定（金额）
  'services/api/src/modules/design/design-release.nodetest.ts',     // 放行状态机 + 软闸
  'services/api/src/modules/rysnova-bim/bim-inherit.nodetest.ts',   // 签单承接幂等
];

// 纯决策逻辑文件的最低行覆盖率（whole-file 覆盖有意义者）
const COVERAGE_THRESHOLDS = [
  { file: 'design-sync.service.ts', minLine: 70 },
];

const failures = [];

// 1) 存在性
for (const t of REQUIRED_TESTS) {
  if (!fs.existsSync(path.join(ROOT, t))) {
    failures.push(`缺少核心域单测（回归保护）：${t}`);
  }
}

// 2) + 3) 运行 + 覆盖率
let out = '';
if (failures.length === 0) {
  const cmd = `TS_NODE_PROJECT=${TS_PROJECT} node --experimental-test-coverage -r ts-node/register/transpile-only --test ${REQUIRED_TESTS.join(' ')}`;
  try {
    out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = `${e.stdout || ''}\n${e.stderr || ''}`;
    failures.push('核心域 nodetest 运行失败（存在 fail 用例或运行时错误）');
  }

  const failMatch = out.match(/^# fail (\d+)/m);
  if (failMatch && Number(failMatch[1]) > 0) {
    failures.push(`核心域 nodetest 有 ${failMatch[1]} 个失败用例`);
  }

  for (const { file, minLine } of COVERAGE_THRESHOLDS) {
    const re = new RegExp(`${file.replace(/[.]/g, '\\.')}\\s*\\|\\s*([\\d.]+)`);
    const m = out.match(re);
    if (!m) {
      failures.push(`未能解析覆盖率：${file}`);
    } else if (Number(m[1]) < minLine) {
      failures.push(`${file} 行覆盖率 ${m[1]}% < 阈值 ${minLine}%`);
    }
  }
}

// 证据留档
const evidenceDir = path.join(ROOT, 'evidence', 'testing');
try { fs.mkdirSync(evidenceDir, { recursive: true }); } catch { /* noop */ }
const report = {
  guard: 'core-domain-coverage-check',
  at: new Date().toISOString(),
  requiredTests: REQUIRED_TESTS,
  thresholds: COVERAGE_THRESHOLDS,
  passed: failures.length === 0,
  failures,
};
try {
  fs.writeFileSync(path.join(evidenceDir, 'core-domain-coverage-report.json'), JSON.stringify(report, null, 2));
} catch { /* noop */ }

if (failures.length > 0) {
  console.error('❌ core-domain-coverage-check 未通过：');
  for (const f of failures) console.error(`   - ${f}`);
  process.exit(1);
}
console.log('✅ core-domain-coverage-check 通过：核心域单测齐备、全绿，且 design-sync 行覆盖 ≥ 70%。');
