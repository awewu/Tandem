#!/usr/bin/env node
/**
 * scripts/audit-ui-charter.mjs · 一次性 UI 宪章全量审计 (绕过所有 allowlist)
 *
 * 跟 check-ui-charter.mjs 区别:
 *   - 这个脚本绕过 ALLOWLIST + RULES.allowlist + RESPONSIVE_PAGE_ALLOWLIST,
 *     扫描全部 app/**.tsx + components/**.tsx, 报真实违规数量 + 分布.
 *   - 输出 markdown 报告到 stdout (可重定向 > docs/UI-AUDIT-XXXX.md)
 *
 * 用法:
 *   node scripts/audit-ui-charter.mjs > docs/UI-AUDIT-2026-05-31.md
 *   node scripts/audit-ui-charter.mjs --pages-only   # 只列 app/**\/page.tsx
 *   node scripts/audit-ui-charter.mjs --by-rule      # 按规则分组
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const args = new Set(process.argv.slice(2));
const PAGES_ONLY = args.has('--pages-only');
const BY_RULE = args.has('--by-rule');

const RULES = [
  { name: 'no-raw-zinc-color', pattern: /\b(?:text|bg|border|ring)-zinc-\d+/g, hint: 'text-ink-{primary,secondary,tertiary} / surface-card' },
  { name: 'no-raw-red-semantic', pattern: /\b(?:text|bg|border)-red-\d+/g, hint: 'text-danger / bg-danger/5 (§1.4)' },
  { name: 'no-raw-green-semantic', pattern: /\b(?:text|bg|border)-green-\d+/g, hint: 'text-success / bg-success/5 (§1.4)' },
  { name: 'no-raw-amber-semantic', pattern: /\b(?:text|bg|border)-amber-\d+/g, hint: 'text-warning / bg-warning/5 (§1.4)' },
  { name: 'no-raw-text-size', pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)\b(?!-)/g, hint: 'text-{display,title-1..3,headline,body,caption,footnote} (§1.2)' },
  { name: 'no-raw-rounded-xl', pattern: /\brounded-xl\b/g, hint: 'rounded-2xl (§1.7)' },
  { name: 'no-raw-motion-duration', pattern: /\btransition-(?:all|colors|transform|opacity|shadow)\s+duration-\d+/g, hint: 'CSS var --duration-* / --ease-* (§1.10)' },
  { name: 'no-raw-tailwind-shadow', pattern: /\bshadow-(?:sm|md|lg|xl)\b(?!-soft)/g, hint: 'shadow-soft-{xs,sm,lg,xl} (§1.8)' },
];

const RESPONSIVE_REGEX = /\b(?:sm|md|lg|xl|2xl):/;

const SCAN_DIRS = ['app', 'components'];
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORE.has(name)) continue;
      yield* walk(full);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      yield full;
    }
  }
}

const violations = [];
const pageStats = []; // for app/**/page.tsx tracking

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (PAGES_ONLY && !(rel.startsWith('app/') && rel.endsWith('/page.tsx'))) continue;
    const src = readFileSync(file, 'utf8');
    const fileViolations = [];
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(src)) !== null) {
        const lineNo = src.slice(0, m.index).split('\n').length;
        fileViolations.push({ rule: rule.name, line: lineNo, match: m[0], hint: rule.hint });
      }
    }
    let missingResponsive = false;
    if (rel.startsWith('app/') && rel.endsWith('/page.tsx') && /className\s*=/.test(src)) {
      missingResponsive = !RESPONSIVE_REGEX.test(src);
      if (missingResponsive) {
        fileViolations.push({ rule: 'requires-responsive-layout', line: 1, match: '(no sm:|md:|lg:|xl: breakpoint)', hint: '加至少 1 个响应断点' });
      }
    }
    for (const v of fileViolations) violations.push({ file: rel, ...v });
    if (rel.startsWith('app/') && rel.endsWith('/page.tsx')) {
      pageStats.push({ file: rel, total: fileViolations.length, missingResponsive });
    }
  }
}

// ─────────────────────────────────────────────────────────────
const errCount = violations.length;
const fileSet = new Set(violations.map((v) => v.file));
const totalFiles = (() => {
  let n = 0;
  for (const top of SCAN_DIRS) {
    const abs = join(ROOT, top);
    try { statSync(abs); } catch { continue; }
    for (const f of walk(abs)) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (PAGES_ONLY && !(rel.startsWith('app/') && rel.endsWith('/page.tsx'))) continue;
      n++;
    }
  }
  return n;
})();

console.log('# UI Charter 全量审计报告');
console.log('');
console.log(`> 生成日期: ${new Date().toISOString().slice(0, 10)}`);
console.log(`> 规则: 6 raw color + raw text-size + rounded-xl + motion + shadow + missing-responsive`);
console.log(`> 范围: ${SCAN_DIRS.join(' / ')} · 全量, **不应用任何 allowlist**`);
console.log('');
console.log('## 总体');
console.log('');
console.log(`- **扫描文件**: ${totalFiles}`);
console.log(`- **有违规的文件**: ${fileSet.size}`);
console.log(`- **违规总数**: ${errCount}`);
console.log(`- **干净文件**: ${totalFiles - fileSet.size}`);
console.log('');

// 规则分布
const byRule = new Map();
for (const v of violations) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
console.log('## 按规则分布');
console.log('');
console.log('| 规则                          | 违规数 | 说明 |');
console.log('| ----------------------------- | -----: | ---- |');
const ruleHints = Object.fromEntries(RULES.map((r) => [r.name, r.hint]));
ruleHints['requires-responsive-layout'] = '加至少 1 个 sm:/md:/lg:/xl: 断点';
for (const [r, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`| \`${r.padEnd(28)}\` | ${String(n).padStart(6)} | ${ruleHints[r] ?? ''} |`);
}
console.log('');

// 104 pages summary
if (!PAGES_ONLY || true) {
  console.log('## 页面 (app/**/page.tsx) 状态');
  console.log('');
  console.log(`总计 ${pageStats.length} 个页面.`);
  const cleanPages = pageStats.filter((p) => p.total === 0);
  const dirtyPages = pageStats.filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  console.log(`- ✅ 完全干净: **${cleanPages.length}**`);
  console.log(`- ❌ 有违规: **${dirtyPages.length}** (其中 ${pageStats.filter((p) => p.missingResponsive).length} 个缺响应断点)`);
  console.log('');
  if (dirtyPages.length > 0) {
    console.log('### 违规页面 (按违规数倒序)');
    console.log('');
    console.log('| # | 页面 | 违规数 | 缺断点 |');
    console.log('| -: | ---- | -----: | :----: |');
    dirtyPages.forEach((p, i) => {
      console.log(`| ${i + 1} | \`${p.file}\` | ${p.total} | ${p.missingResponsive ? '✗' : ''} |`);
    });
    console.log('');
  }
}

// By-file detail
const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

if (BY_RULE) {
  console.log('## 按规则分组明细');
  console.log('');
  for (const rule of RULES.concat({ name: 'requires-responsive-layout' })) {
    const list = violations.filter((v) => v.rule === rule.name);
    if (list.length === 0) continue;
    console.log(`### \`${rule.name}\` (${list.length} 处)`);
    console.log('');
    console.log('```');
    for (const v of list) console.log(`${v.file}:${v.line}  ${v.match}`);
    console.log('```');
    console.log('');
  }
}

console.log('## 详细按文件 (Top 20 最脏)');
console.log('');
const sortedFiles = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 20);
for (const [file, list] of sortedFiles) {
  console.log(`### \`${file}\` · ${list.length} 处`);
  console.log('');
  console.log('```');
  for (const v of list) console.log(`L${v.line}  ${v.rule}  ${v.match}`);
  console.log('```');
  console.log('');
}

process.exit(0);
