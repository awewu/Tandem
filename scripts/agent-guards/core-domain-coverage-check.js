#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REQUIRED_TESTS = [
  'services/api/src/modules/quote/quote-lock.nodetest.ts',
];
const RETIRED_MODULES = ['design', 'rysnova-bim', 'ai-design', 'delivery', 'lifecycle', 'aftersales'];
const failures = [];

for (const testPath of REQUIRED_TESTS) {
  if (!fs.existsSync(path.join(ROOT, testPath))) failures.push(`missing retained core-domain test: ${testPath}`);
}
for (const moduleName of RETIRED_MODULES) {
  if (fs.existsSync(path.join(ROOT, 'services/api/src/modules', moduleName))) {
    failures.push(`retired runtime module is still present: ${moduleName}`);
  }
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
  passed: failures.length === 0,
  failures,
  output: output.slice(-4000),
};
const evidenceDir = path.join(ROOT, 'evidence', 'testing');
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'core-domain-coverage-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`Core Domain Coverage Check: failures = ${failures.length}`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exit(1);
