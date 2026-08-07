#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REQUIRED_TESTS = [
  'services/api/src/modules/quote/quote-lock.nodetest.ts',
  // 合规闸静默降级回归防线：曾出现「8 个内核挂 7 个仍判合规」，
  // 错误方案带着合规标记流向经销商与客户。此测试是「客户专业度」的红线守卫。
  'services/api/src/modules/design/design-calc-gate.nodetest.ts',
];
// 已退役运行时模块（存在即失败）。
//
// ⚠️ 治理自洽修正（宪章 Control Rule：「PRD and product boundaries override code convenience」）：
// 本清单原为 ['design','rysnova-bim','ai-design','delivery','lifecycle','aftersales']，与 PRD 直接冲突：
//   · `design` / `delivery` 是**现役核心域**——AGENTS.md 流程 `lead->diagnosis->design->...->lifecycle`
//     明写其在链上，且两模块均已在 services/api 接线（design 承载 hvac-kernels；delivery 承载
//     lifecycle_links 项目主线，被 CRM 建单直接依赖）。
//   · `rysnova-bim` / `ai-design` / `lifecycle` / `aftersales` 被 PRD §13 决策 **D4 明令"恢复并入 B③"**，
//     并写明"这些正是 B③ 技术支持的核心能力"。把它们列为"存在即失败"，等于**门禁主动阻止宪章要做的事**。
// 故退役清单清空；D4 恢复欠债改由下方 PRD_D4_RECOVERY 追踪（缺失=记欠债，不阻断；
// 半恢复=阻断，因为半个模块比没有更危险）。
const RETIRED_MODULES = [];

// hvac-kernels 是「客户专业度」的核心资产（7,456 行 / 9 域）。其基准集必须存在且全绿：
// 黄金值防漂移、不变量防算错（后者已实证抓到「房间负荷全 NaN 却不抛错」的真缺陷）。
const KERNEL_TEST_DIR = 'packages/domain/hvac-kernels/__tests__';
const REQUIRED_KERNEL_TESTS = [
  `${KERNEL_TEST_DIR}/regression-baseline.test.js`,
  `${KERNEL_TEST_DIR}/domain-coverage-baseline.test.js`,
];

// 待重建模块。恢复标志：模块目录存在且含 module 声明文件。
// 2026-08-04 收敛（宪章 §1.2「技术支持止于售前专业度」+ §5.4）：
//   原 D4 四模块中，仅 `ai-design`（售前 AI 设计与审计）属当期范围；
//   `rysnova-bim`(深化/施工) · `lifecycle`(终身运维) · `aftersales`(售后) 转入 §5.3 冻结册，
//   解冻条件＝售前闭环跑通且经销商明确提出。
const PRD_D4_RECOVERY = ['ai-design'];
const failures = [];
const recoveryDebt = [];

for (const testPath of REQUIRED_TESTS) {
  if (!fs.existsSync(path.join(ROOT, testPath))) failures.push(`missing retained core-domain test: ${testPath}`);
}
for (const testPath of REQUIRED_KERNEL_TESTS) {
  if (!fs.existsSync(path.join(ROOT, testPath))) failures.push(`missing hvac-kernel baseline test: ${testPath}`);
}
// 内核基准集用 Jest（与 nodetest 分属两套 runner），单独执行。
if (!failures.length) {
  const jest = spawnSync(process.execPath, [
    path.join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js'),
    KERNEL_TEST_DIR, '--silent',
  ], { cwd: ROOT, encoding: 'utf8' });
  if (jest.status !== 0) {
    failures.push('hvac-kernels 基准集未通过（专业度红线：黄金值漂移或不变量被破坏）');
  }
}
for (const moduleName of RETIRED_MODULES) {
  if (fs.existsSync(path.join(ROOT, 'services/api/src/modules', moduleName))) {
    failures.push(`retired runtime module is still present: ${moduleName}`);
  }
}
for (const moduleName of PRD_D4_RECOVERY) {
  const dir = path.join(ROOT, 'services/api/src/modules', moduleName);
  if (!fs.existsSync(dir)) {
    recoveryDebt.push(moduleName);
    continue;
  }
  // 目录已在但没有 NestJS 模块声明 = 半恢复（未接线），这种不一致状态必须阻断。
  const wired = fs.readdirSync(dir).some((f) => /\.module\.ts$/.test(f));
  if (!wired) failures.push(`PRD D4 module partially recovered but not wired (missing *.module.ts): ${moduleName}`);
}

let output = '';
if (!failures.length) {
  const result = spawnSync(process.execPath, [
    '-r',
    'ts-node/register/transpile-only',
    '--test',
    ...REQUIRED_TESTS,
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TS_NODE_PROJECT: 'services/api/tsconfig.json' },
  });
  output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status !== 0) failures.push('retained quote-lock core-domain test failed');
}

const report = {
  guard: 'core-domain-coverage-check',
  at: new Date().toISOString(),
  requiredTests: REQUIRED_TESTS,
  retiredModules: RETIRED_MODULES,
  prdD4Recovery: { required: PRD_D4_RECOVERY, outstanding: recoveryDebt },
  passed: failures.length === 0,
  failures,
  output: output.slice(-4000),
};

// 宪章 Control Rule：Findings/Release evidence 须落台账 —— 让 D4 欠债可见, 不再被沉默.
try {
  require('../release/evidence-utils').updateReleaseEvidence('prdD4CoreDomainRecovery', {
    command: 'npm run guard:core-domain-coverage',
    status: recoveryDebt.length ? 'recovery-outstanding' : 'recovered',
    prdDecision: 'PRD §13 D4 · 恢复并入 B③ 全周期技术赋能',
    roadmapPhase: 'P2',
    required: PRD_D4_RECOVERY,
    outstanding: recoveryDebt,
    path: 'evidence/testing/core-domain-coverage-report.json',
  });
} catch { /* 台账不可写不应阻断域覆盖校验 */ }
const evidenceDir = path.join(ROOT, 'evidence', 'testing');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'core-domain-coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Core Domain Coverage Check: failures = ${failures.length}, PRD-D4 recovery outstanding = ${recoveryDebt.length}`);
if (recoveryDebt.length) {
  console.warn(`⚠️  PRD §13 D4 待恢复（P2 路线图，不阻断）: ${recoveryDebt.join(', ')} —— 已记入 evidence/release-evidence.json#prdD4CoreDomainRecovery`);
}
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exit(1);
