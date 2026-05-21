/**
 * smoke-all — orchestrates every smoke script and prints a final report.
 *
 * Pre-req: dev server running at $BASE (default http://localhost:3001).
 */
import { spawnSync } from 'node:child_process';

const scripts = [
  ['Launchpad full-chain',          'scripts/smoke-launchpad.mjs'],
  ['Role × API (read) matrix',      'scripts/smoke-roles.mjs'],
  ['Role × API (write) matrix',     'scripts/smoke-write-roles.mjs'],
  ['Page render × 3 roles',         'scripts/smoke-pages.mjs'],
  ['Dynamic [id] page render',      'scripts/smoke-dynamic-pages.mjs'],
  ['Multi-tenant isolation',        'scripts/smoke-tenants.mjs'],
  ['Cross-module tenant isolation', 'scripts/smoke-tenants-full.mjs'],
];

const results = [];
for (const [name, path] of scripts) {
  console.log(`\n────── Running: ${name} ──────`);
  const r = spawnSync(process.execPath, [path], { stdio: 'inherit' });
  results.push({ name, code: r.status ?? -1 });
}

console.log('\n════════ SMOKE SUMMARY ════════');
for (const { name, code } of results) {
  console.log(`  ${code === 0 ? '✓' : '✗'}  ${name}${code === 0 ? '' : `  (exit ${code})`}`);
}
const allOk = results.every((r) => r.code === 0);
console.log(allOk ? '\n✓ ALL SMOKE PASSED\n' : '\n✗ SOME FAILED\n');
process.exit(allOk ? 0 : 1);
