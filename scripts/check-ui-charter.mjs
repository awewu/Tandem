#!/usr/bin/env node
/**
 * §CHARTER-UI-V1 lint · 扫描 raw Tailwind 违规
 *
 * 不依赖 ESLint plugin (零安装). 直接 ripgrep-style 扫 *.tsx.
 *
 * 用法:
 *   node scripts/check-ui-charter.mjs                # 扫全项目 (allowlist 过滤)
 *   node scripts/check-ui-charter.mjs --fix-hint     # 输出修复建议
 *   node scripts/check-ui-charter.mjs --strict       # 退出码 1 (CI 用)
 *
 * 退出码:
 *   0 = 无违规 (或 strict 关闭)
 *   1 = 有违规 + --strict 模式
 *
 * 维护:
 *   - 每条规则 = { pattern, hint }
 *   - allowlist 是已知遗留, 应逐步清零
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const HINT = args.has('--fix-hint');

// ─────────────────────────────────────────────────────────────────────
// 规则: pattern (regex) + hint (合规替代方案)
// ─────────────────────────────────────────────────────────────────────
const RULES = [
  {
    name: 'no-raw-zinc-color',
    pattern: /\b(?:text|bg|border|ring)-zinc-\d+/g,
    hint: '走 text-ink-{primary,secondary,tertiary} / surface-card / border via CSS var',
    severity: 'error',
  },
  {
    name: 'no-raw-red-semantic',
    pattern: /\b(?:text|bg|border)-red-\d+/g,
    hint: '走 text-danger / bg-danger/5 / border-danger (charter §1.4 semantic)',
    severity: 'error',
  },
  {
    name: 'no-raw-green-semantic',
    pattern: /\b(?:text|bg|border)-green-\d+/g,
    hint: '走 text-success / bg-success/5 (charter §1.4)',
    severity: 'error',
  },
  {
    name: 'no-raw-amber-semantic',
    pattern: /\b(?:text|bg|border)-amber-\d+/g,
    hint: '走 text-warning / bg-warning/5 (charter §1.4)',
    severity: 'error',
  },
  {
    name: 'no-raw-text-size',
    pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)\b(?!-)/g,
    hint: '走 text-{display,title-1,title-2,title-3,headline,body,caption,footnote} (charter §1.2)',
    severity: 'error',
    // §1.2 typography · 2026-05-31 全量清零 (codemod-charter-tokens.mjs).
    // allowlist 已清空, 新文件使用 raw text-{xs..4xl} 即 fail.
    allowlist: new Set([]),
  },
  {
    name: 'no-raw-rounded-xl',
    pattern: /\brounded-xl\b/g,
    hint: '改用 rounded-2xl (charter §1.7 corner radius)',
    severity: 'error',
    // §1.7 corner-radius · 2026-05-31 全量清零 (codemod-charter-tokens.mjs).
    allowlist: new Set([]),
  },
  {
    // §1 motion: charter §1.10 motion language — 必须走 --duration-* / --ease-* CSS var
    // 不允许 raw "transition-{all,colors,...} duration-NNN" 组合 (旧 Tailwind 默认值, 跟 design-tokens 不一致)
    // 2026-05-30 P3.F 清零 (12 → 0), 提为 error 防止再加新债.
    name: 'no-raw-motion-duration',
    pattern: /\btransition-(?:all|colors|transform|opacity|shadow)\s+duration-\d+/g,
    hint: '走 CSS var: style={{ transitionDuration: "var(--duration-fast)", transitionTimingFunction: "var(--ease-standard)" }} 或 globals.css 里的语义类 (.surface-interactive / .card-elevated)',
    severity: 'error',
    // 已清零, allowlist 为空 (任何新加 = PR 打回)
    allowlist: new Set([]),
  },
  {
    name: 'no-raw-tailwind-shadow',
    pattern: /\bshadow-(?:sm|md|lg|xl)\b(?!-soft)/g,
    hint: '走 shadow-soft-{xs,sm,lg,xl} (charter §1.8)',
    severity: 'error',
    // §1.3/§1.8 shadow · 2026-05-31 全量清零 (codemod-charter-tokens.mjs).
    allowlist: new Set([]),
  },
];

// ─────────────────────────────────────────────────────────────────────
// allowlist · 历史债 · 2026-05-31 全量清零 (104 页面 + 全部 components)
//
// 维护规则:
//   - 此 allowlist 永久空, 任何新文件违规 = PR 打回
//   - 历史 P1.5 渐次清零策略已结束 (一夜攻关 codemod 一刀清干净)
// ─────────────────────────────────────────────────────────────────────
const ALLOWLIST = new Set([]);

// ─────────────────────────────────────────────────────────────────────
// M1 响应断点 ratchet (2026-05-30) — 扫 app/*/page.tsx 是否带响应断点
// 防止移动端破碎进一步扩散 (51 文件 snapshot allowlist · 渐次清零)
// ─────────────────────────────────────────────────────────────────────
// 2026-05-31 全量清零: 104 页面都带响应断点 (codemod-responsive-layout.mjs).
const RESPONSIVE_PAGE_ALLOWLIST = new Set([]);

const RESPONSIVE_BREAKPOINT_REGEX = /\b(?:sm|md|lg|xl|2xl):/;

// ─────────────────────────────────────────────────────────────────────
// 扫描
// ─────────────────────────────────────────────────────────────────────
const SCAN_DIRS = ['app', 'components'];
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      yield* walk(full);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      yield full;
    }
  }
}

const violations = [];

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (ALLOWLIST.has(rel)) continue;
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (const rule of RULES) {
      if (rule.allowlist && rule.allowlist.has(rel)) continue;
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(src)) !== null) {
        const upToMatch = src.slice(0, m.index);
        const lineNo = upToMatch.split('\n').length;
        violations.push({
          file: rel,
          line: lineNo,
          rule: rule.name,
          match: m[0],
          hint: rule.hint,
          severity: rule.severity,
        });
      }
    }

    // M1 响应断点检查 (仅 app/**/page.tsx, allowlist 跳过)
    // 跳过无 className 的页面 (纯 redirect / 纯 metadata 导出, 没有可响应的布局)
    if (
      rel.startsWith('app/') &&
      rel.endsWith('/page.tsx') &&
      !RESPONSIVE_PAGE_ALLOWLIST.has(rel) &&
      /className\s*=/.test(src)
    ) {
      if (!RESPONSIVE_BREAKPOINT_REGEX.test(src)) {
        violations.push({
          file: rel,
          line: 1,
          rule: 'requires-responsive-layout',
          match: '(无 sm:|md:|lg:|xl: 断点)',
          hint: '加至少 1 个响应断点 (sm:/md:/lg:/xl:) 让小屏不破碎. 主组件可参考 components/mobile-* 现有实现.',
          severity: 'error',
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 输出
// ─────────────────────────────────────────────────────────────────────
const errors = violations.filter((v) => v.severity === 'error');
const warns = violations.filter((v) => v.severity === 'warn');

if (violations.length === 0) {
  console.log('✓ CHARTER-UI-V1 合规 · 0 违规');
  console.log(`  扫描范围: ${SCAN_DIRS.join(' / ')} · allowlist ${ALLOWLIST.size} 条 (KPI 后台遗留)`);
  process.exit(0);
}

const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

console.log(`\n⚠ CHARTER-UI-V1 违规扫描: ${errors.length} error, ${warns.length} warn\n`);
for (const [file, vs] of byFile) {
  console.log(`  ${file}`);
  for (const v of vs) {
    const sym = v.severity === 'error' ? '✗' : '!';
    console.log(`    ${sym} L${v.line}  ${v.rule}  '${v.match}'`);
    if (HINT) console.log(`       → ${v.hint}`);
  }
  console.log('');
}

console.log(`总计: ${violations.length} 条 · allowlist ${ALLOWLIST.size} 文件已跳过 (P1.5 清零)`);
console.log(`提示: 添加 --fix-hint 看建议; --strict CI 用 (有 error 退 1)`);

if (STRICT && errors.length > 0) {
  console.log(`\n✗ STRICT 模式: ${errors.length} error → exit 1`);
  process.exit(1);
}
process.exit(0);
