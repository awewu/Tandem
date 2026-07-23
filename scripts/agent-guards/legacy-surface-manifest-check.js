#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ACTIVE_HTML_PATHS } = require('../../server/middleware/productionStaticSurfaceGuard');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'archive', 'legacy-ui', 'public', 'legacy-surface-manifest.json');
const VALID_BUCKETS = ['active', 'migration-candidate', 'archive', 'static-inventory'];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walkHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(file, files);
    else if (entry.name.endsWith('.html')) files.push(path.relative(ROOT, file).replace(/\\/g, '/'));
  }
  return files;
}

const failures = [];
const manifest = readJson(MANIFEST_PATH);
const declared = new Map();

for (const bucket of VALID_BUCKETS) {
  const entries = manifest.surfaces?.[bucket];
  if (!Array.isArray(entries)) {
    failures.push(`manifest missing bucket: ${bucket}`);
    continue;
  }

  for (const item of entries) {
    if (declared.has(item)) failures.push(`${item} declared in both ${declared.get(item)} and ${bucket}`);
    declared.set(item, bucket);
  }
}

const publicHtml = walkHtml(path.join(ROOT, 'archive', 'legacy-ui', 'public'));
for (const file of publicHtml) {
  if (!declared.has(file)) failures.push(`${file} is not classified in archive/legacy-ui/public/legacy-surface-manifest.json`);
}

for (const [file, bucket] of declared.entries()) {
  if (!fs.existsSync(path.join(ROOT, file))) failures.push(`${file} declared as ${bucket} but file is missing`);
}

const activeFromManifest = new Set((manifest.surfaces?.active || []).map(file => `/${path.basename(file)}`));
for (const pathName of ACTIVE_HTML_PATHS) {
  if (!activeFromManifest.has(pathName)) failures.push(`${pathName} is active in static guard but missing from manifest active bucket`);
}
for (const pathName of activeFromManifest) {
  if (!ACTIVE_HTML_PATHS.has(pathName)) failures.push(`${pathName} is active in manifest but not allowed by productionStaticSurfaceGuard`);
}

console.log(`Legacy Surface Manifest Check: html = ${publicHtml.length}, classified = ${declared.size}, failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
