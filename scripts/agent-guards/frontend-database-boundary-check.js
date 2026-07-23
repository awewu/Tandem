#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const APPS = path.join(ROOT, 'apps');
const SOURCE_DIRS = new Set(['src', 'public']);
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage']);
const RULES = [
  { label: 'database package import', pattern: /(?:from\s+|require\s*\(\s*)['"](?:pg|typeorm|mongoose|mongodb)['"]/ },
  { label: 'database connection environment variable', pattern: /\b(?:DATABASE_URL|POSTGRES_(?:URI|HOST|PORT|USER|PASSWORD|DB)|MONGODB_URI)\b/ },
  { label: 'database connection URL', pattern: /\b(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\//i },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const files = [];
if (fs.existsSync(APPS)) {
  for (const app of fs.readdirSync(APPS, { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    for (const sourceDir of SOURCE_DIRS) walk(path.join(APPS, app.name, sourceDir), files);
  }
}

const failures = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        failures.push(`${path.relative(ROOT, file)}:${index + 1} ${rule.label}`);
      }
    }
  });
}

console.log(`Frontend Database Boundary Check: files = ${files.length}, failures = ${failures.length}`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exit(1);
