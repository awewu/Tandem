#!/usr/bin/env node
/**
 * 跨平台 API 单测运行器(替代 bash 专用的 `VAR=x ... $(find ...)`,Windows/*nix 通用)。
 * 递归收集 services/api/src 下所有 *.nodetest.ts,经 ts-node transpile-only 用 node:test 运行。
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const testDir = path.join(root, 'services', 'api', 'src');

function collect(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, acc);
    else if (e.name.endsWith('.nodetest.ts')) acc.push(p);
  }
  return acc;
}

const files = collect(testDir, []);
if (!files.length) { console.error('no *.nodetest.ts found'); process.exit(1); }

const r = spawnSync(process.execPath, ['-r', 'ts-node/register/transpile-only', '--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TS_NODE_PROJECT: path.join('services', 'api', 'tsconfig.json') },
});
process.exit(r.status == null ? 1 : r.status);
