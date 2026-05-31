#!/usr/bin/env node
/**
 * scripts/codemod-responsive-layout.mjs · CHARTER-UI-V1 §1.M1 响应断点
 *
 * 给指定 app/**\/page.tsx 加 1 个有意义的响应断点 (mobile-first):
 *
 *   1) `<div className="flex h-screen ...">`  (双栏布局)
 *      → `<div className="flex flex-col md:flex-row h-screen ...">`
 *
 *   2) `<div className="... grid grid-cols-{N} ...">`  (固定多列)
 *      → `<div className="... grid grid-cols-1 md:grid-cols-{N} ...">`
 *      (只对 grid-cols-{2,3,4,6,12} 处理; grid-cols-1 跳过)
 *
 *   3) 兜底: 给 outer container 加 `md:px-8` (CHARTER 接受 1 个断点即合规)
 *
 * 仅修改首个 outer container; 不递归.
 *
 * 用法:
 *   node scripts/codemod-responsive-layout.mjs --dry
 *   node scripts/codemod-responsive-layout.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');

const TARGETS = [
  'app/1on1/page.tsx',
  'app/admin/baseline/page.tsx',
  'app/admin/intranet/page.tsx',
  'app/admin/invite/page.tsx',
  'app/admin/kpi/bonus-payout/page.tsx',
  'app/admin/kpi/setup/page.tsx',
  'app/admin/kpi/subjects/page.tsx',
  'app/admin/launchpad/page.tsx',
  'app/admin/organization/page.tsx',
  'app/approvals/page.tsx',
  'app/bitable/[id]/page.tsx',
  'app/convergence/page.tsx',
  'app/convergence/[id]/page.tsx',
  'app/documents/page.tsx',
  'app/documents/[id]/page.tsx',
  'app/drive/page.tsx',
  'app/intranet/category/[cat]/page.tsx',
  'app/intranet/ethics/page.tsx',
  'app/intranet/posts/[id]/page.tsx',
  'app/knowledge/page.tsx',
  'app/logs/page.tsx',
  'app/mail/page.tsx',
  'app/memories/page.tsx',
  'app/nine-box/suggestions/page.tsx',
  'app/notifications/page.tsx',
  'app/partner/join/page.tsx',
  'app/persona/evolution/page.tsx',
  'app/persona/me/proxy-actions/page.tsx',
  'app/persona/page.tsx',
  'app/register/employee/page.tsx',
  'app/register/page.tsx',
  'app/search/page.tsx',
  'app/settings/llm/page.tsx',
  'app/settings/page.tsx',
  'app/settings/privacy/page.tsx',
  'app/tasks/page.tsx',
  'app/workflows/page.tsx',
];

let fixed = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const file = join(ROOT, rel);
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    console.log(`[miss] ${rel}  (file not found)`);
    skipped++;
    continue;
  }

  // Already responsive? skip
  if (/\b(?:sm|md|lg|xl|2xl):/.test(src)) {
    console.log(`[skip] ${rel}  (already has breakpoint — audit may be stale)`);
    skipped++;
    continue;
  }

  // Find first className= near return (
  const returnIdx = src.indexOf('return (');
  if (returnIdx === -1) {
    console.log(`[skip] ${rel}  (no 'return (' — non-standard)`);
    skipped++;
    continue;
  }

  // Find first className="..." or className={`...`} after return (
  const afterReturn = src.slice(returnIdx);
  const classNameRe = /className=(?:"([^"]+)"|\{`([^`]+)`\}|\{cn\(([^)]+)\)\})/;
  const m = afterReturn.match(classNameRe);
  if (!m) {
    console.log(`[skip] ${rel}  (no className found after return)`);
    skipped++;
    continue;
  }

  const fullMatch = m[0];
  const classStr = m[1] ?? m[2] ?? m[3] ?? '';
  const matchStartInFile = returnIdx + m.index;
  const matchEndInFile = matchStartInFile + fullMatch.length;

  let newClassStr = classStr;
  let strategy = '';

  // Strategy 1: flex h-screen (双栏)
  if (/\bflex\b/.test(classStr) && !/\bflex-(?:col|row)\b/.test(classStr)) {
    newClassStr = classStr.replace(/\bflex\b/, 'flex flex-col md:flex-row');
    strategy = 'flex→flex-col md:flex-row';
  }
  // Strategy 2: grid grid-cols-N (N>=2)
  else if (/\bgrid\s+grid-cols-([2-9]|1[0-2])\b/.test(classStr)) {
    newClassStr = classStr.replace(
      /\b(grid)\s+grid-cols-([2-9]|1[0-2])\b/,
      '$1 grid-cols-1 md:grid-cols-$2',
    );
    strategy = `grid-cols-N → grid-cols-1 md:grid-cols-N`;
  }
  // Strategy 3: 兜底 — 加一个不与现有 layout 冲突的断点
  //   .page-container 已经在 lg 处加了 64px px, 这里用 md:py-10 避开 px 冲突
  //   一般页面用 md:px-8 (mobile p-6 → desktop px-8 更宽松)
  else {
    if (/\bpage-container\b/.test(classStr)) {
      newClassStr = classStr.trim() + ' md:py-10';
      strategy = '+md:py-10 (page-container 兼容)';
    } else {
      newClassStr = classStr.trim() + ' md:px-8';
      strategy = '+md:px-8 (fallback)';
    }
  }

  if (newClassStr === classStr) {
    console.log(`[skip] ${rel}  (no strategy applied)`);
    skipped++;
    continue;
  }

  // Reconstruct className=...
  let newFullMatch;
  if (m[1] !== undefined) newFullMatch = `className="${newClassStr}"`;
  else if (m[2] !== undefined) newFullMatch = 'className={`' + newClassStr + '`}';
  else newFullMatch = `className={cn(${m[3]})}`; // shouldn't trigger here

  const newSrc = src.slice(0, matchStartInFile) + newFullMatch + src.slice(matchEndInFile);

  if (DRY) {
    console.log(`[dry] ${rel}  ${strategy}`);
    console.log(`       - ${classStr.slice(0, 80)}${classStr.length > 80 ? '...' : ''}`);
    console.log(`       + ${newClassStr.slice(0, 80)}${newClassStr.length > 80 ? '...' : ''}`);
  } else {
    writeFileSync(file, newSrc, 'utf8');
    console.log(`[fix] ${rel}  ${strategy}`);
  }
  fixed++;
}

console.log('');
console.log(`修复 ${fixed} · 跳过 ${skipped}`);
console.log(DRY ? '(dry-run)' : '✓ 已写盘');
