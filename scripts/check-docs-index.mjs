#!/usr/bin/env node
/**
 * check-docs-index.mjs · docs/INDEX.md 完整性扫描
 *
 * 目的:
 *   - INDEX.md 是单一真相目录, 但人工维护极易漏登记新 .md
 *   - 本脚本枚举 docs/**\/*.md, 与 INDEX.md 中提到的 backtick 路径求差集
 *   - --strict 模式: 任何未登记 / 已删除文件 → exit 1
 *
 * 用法:
 *   node scripts/check-docs-index.mjs           # 报告但不 fail (CI warn)
 *   node scripts/check-docs-index.mjs --strict  # 任意 diff → exit 1 (pre-commit gate)
 *
 * 允许列表 (ALLOW_UNLISTED): 不强制登记的 .md 路径前缀 (如 archive/ 子目录).
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, 'docs');
const INDEX_FILE = join(DOCS_DIR, 'INDEX.md');
const STRICT = process.argv.includes('--strict');

const ALLOW_UNLISTED = [
  'docs/archive/',
  'docs/INDEX.md',
  'docs/README.md', // docs 子目录的入门 README, 与 INDEX.md 并列存在 (历史遗留)
];

// ─── 1. 扫 docs/**/*.md ────────────────────────────────────────────────
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (s.isFile() && name.toLowerCase().endsWith('.md')) acc.push(full);
  }
  return acc;
}

const allMdFiles = walk(DOCS_DIR).map((p) => relative(ROOT, p).split(sep).join('/'));

// ─── 2. 读 INDEX.md, 提取被引用的 docs/*.md 路径 ───────────────────────
const indexRaw = readFileSync(INDEX_FILE, 'utf8');
// match backtick paths like `docs/FOO.md`, `docs/sub/BAR.md`, `FOO.md` (root-level mention)
// 接受 backtick 内或 markdown 链接 [..](docs/..) 形式
const refRegex = /(?:`|\(|\[)((?:docs\/)?[A-Za-z0-9_\-./]+\.md)(?:`|\)|\s)/g;
const referenced = new Set();
let m;
// 根目录顶层只白名单这几个 (其他根级 .md 不强制登记)
const ROOT_LEVEL_TRACKED = new Set(['STATUS.md', 'PROGRESS-2026-05-29.md', 'RELEASE-COMMIT-PLAN.md', 'RELEASE-COMMIT-PLAN-2.md']);
while ((m = refRegex.exec(indexRaw)) !== null) {
  let p = m[1];
  // 形如 `MANIFESTO.md` (无 / 无 docs/) → 优先按项目根存在性判定
  if (!p.includes('/')) {
    if (ROOT_LEVEL_TRACKED.has(p)) continue; // 根级白名单不审
    // 若实际存在于项目根 (如 TEST-REPORT.md / DOCKER-SETUP.md 等), 也跳过, 本脚本只审 docs/
    if (existsSync(join(ROOT, p))) continue;
    p = `docs/${p}`;
  } else if (!p.startsWith('docs/')) {
    // 形如 `archive/foo.md` → 按 docs/archive/foo.md
    p = `docs/${p}`;
  }
  referenced.add(p);
}

// ─── 3. diff ────────────────────────────────────────────────────────────
const isAllowed = (p) => ALLOW_UNLISTED.some((prefix) => p.startsWith(prefix));

const unlisted = allMdFiles.filter((p) => !referenced.has(p) && !isAllowed(p));
const danglingRefs = [...referenced].filter((p) => !allMdFiles.includes(p));

// ─── 4. 报告 ────────────────────────────────────────────────────────────
const total = allMdFiles.length;
const reffedCount = [...referenced].filter((p) => allMdFiles.includes(p)).length;

console.log('');
console.log(`📚 docs 总数: ${total} · INDEX 已登记: ${reffedCount} · 未登记: ${unlisted.length} · 悬空引用: ${danglingRefs.length}`);

if (unlisted.length > 0) {
  console.log('');
  console.log('⚠️  未在 docs/INDEX.md 登记的 .md 文件:');
  for (const p of unlisted.slice(0, 50)) console.log(`   - ${p}`);
  if (unlisted.length > 50) console.log(`   ... 还有 ${unlisted.length - 50} 个`);
}

if (danglingRefs.length > 0) {
  console.log('');
  console.log('❌ INDEX.md 引用但实际不存在的 .md 文件 (悬空引用):');
  for (const p of danglingRefs) console.log(`   - ${p}`);
}

console.log('');

if (STRICT && (unlisted.length > 0 || danglingRefs.length > 0)) {
  console.log('💥 --strict 模式: docs/INDEX.md 与 docs/*.md 不一致, 请同步后再提交.');
  process.exit(1);
}

if (unlisted.length === 0 && danglingRefs.length === 0) {
  console.log('✅ docs/INDEX.md 与 docs/*.md 完全同步');
}
