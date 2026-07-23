#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'audit', 'archive', 'test', '.nx']);
function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const files = walk(ROOT, []);
const texts = files.map((f) => ({ f, t: fs.readFileSync(f, 'utf8') }));
const j = require(path.join(ROOT, 'audit', 'asset-ledger.json'));
const review = j.ledger.filter((r) => r.disposition === 'REVIEW');
function basename(file) { return path.basename(file).replace(/\.(js|jsx|ts|tsx)$/, ''); }
const rows = review.map((r) => {
  const base = basename(r.file);
  const reqRe = new RegExp("(require\\(|from\\s+)['\"][^'\"]*/" + base + "['\"]");
  const nameRe = new RegExp("['\"]" + base + "['\"]");
  let wired = 0, registry = 0;
  for (const { f, t } of texts) {
    if (f.endsWith('/' + path.basename(r.file))) continue;
    if (reqRe.test(t)) wired++;
    else if (nameRe.test(t)) registry++;
  }
  return { file: r.file, domains: r.domains, reason: r.reason, wired, registry };
});
rows.sort((a, b) => (a.wired + a.registry) - (b.wired + b.registry));
for (const r of rows) {
  const verdict = r.wired > 0 ? 'WIRED' : (r.registry > 0 ? 'REGISTRY-ONLY' : 'ORPHAN');
  console.log(r.file.replace('server/', '').padEnd(46) + ' wired=' + r.wired + ' reg=' + r.registry + '  ' + verdict);
}
fs.writeFileSync(path.join(ROOT, 'audit', 'ref-recount.json'), JSON.stringify(rows, null, 2));
