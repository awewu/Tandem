#!/usr/bin/env node
/**
 * scripts/codemod-charter-tokens.mjs · CHARTER-UI-V1 全量代码迁移
 *
 * 把 raw Tailwind 调色板/字号/圆角/阴影 → semantic design token (CSS var 驱动).
 *
 * 替换策略 (CHARTER §1.2 / §1.4 / §1.7 / §1.8):
 *
 *   text-{xs,sm,base,lg,xl,2xl,3xl,4xl}    → text-{footnote..title-1}
 *   text-{red,amber,green}-{NNN}           → text-{danger,warning,success}
 *   bg-{red,amber,green}-{NNN}             → bg-{token}/{alpha by shade}
 *   border-{red,amber,green}-{NNN}         → border-{token}/{alpha} | border-{token}
 *   ring-{red,amber,green}-{NNN}           → ring-{token}/{alpha}
 *   text-zinc-{NNN}                        → text-ink-{primary|secondary|tertiary}
 *   bg-zinc-{NNN}                          → bg-surface-{1|2|3}
 *   border-zinc-{NNN}                      → border
 *   ring-zinc-{NNN}                        → ring
 *   rounded-xl                             → rounded-2xl
 *   shadow-sm/md/lg/xl                     → shadow-soft/-sm/-lg/-xl (md → soft)
 *
 * 兼容 Tailwind 修饰前缀 (hover:, focus:, dark:, md: ...).
 *
 * 用法:
 *   node scripts/codemod-charter-tokens.mjs --dry        # 预览
 *   node scripts/codemod-charter-tokens.mjs              # 实修
 *   node scripts/codemod-charter-tokens.mjs --files=...  # 限定文件 (glob 不支持, 用 path)
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const filesArg = args.find((a) => a.startsWith('--files='))?.slice('--files='.length);
const FILE_FILTER = filesArg ? filesArg.split(',').map((s) => s.trim()) : null;

const SCAN_DIRS = ['app', 'components'];
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build']);

// ─────────────────────────────────────────────────────────────
// 映射函数
// ─────────────────────────────────────────────────────────────

const TEXT_SIZE_MAP = {
  xs: 'footnote',
  sm: 'caption',
  base: 'body',
  lg: 'headline',
  xl: 'headline',
  '2xl': 'title-3',
  '3xl': 'title-2',
  '4xl': 'title-1',
};

const SHADOW_MAP = {
  sm: 'shadow-soft-sm',
  md: 'shadow-soft',
  lg: 'shadow-soft-lg',
  xl: 'shadow-soft-xl',
};

function alphaForShade(n) {
  if (n <= 50) return 5;
  if (n <= 100) return 10;
  if (n <= 200) return 20;
  if (n <= 300) return 30;
  if (n <= 400) return 50;
  return null; // 500+ → solid (no alpha)
}

const SEM_TOKEN = { red: 'danger', amber: 'warning', green: 'success' };

function mapSemanticColor(prefix, color, shade) {
  const token = SEM_TOKEN[color];
  if (!token) return null;
  const n = parseInt(shade, 10);
  if (Number.isNaN(n)) return null;
  // text 始终走纯色 (alpha 文本会糊)
  if (prefix === 'text') return `text-${token}`;
  const alpha = alphaForShade(n);
  if (alpha === null) return `${prefix}-${token}`;
  return `${prefix}-${token}/${alpha}`;
}

function mapZinc(prefix, shade) {
  const n = parseInt(shade, 10);
  if (prefix === 'text') {
    if (n <= 400) return 'text-ink-tertiary';
    if (n <= 600) return 'text-ink-secondary';
    return 'text-ink-primary';
  }
  if (prefix === 'bg') {
    if (n <= 100) return 'bg-surface-1';
    if (n <= 300) return 'bg-surface-2';
    return 'bg-surface-3';
  }
  if (prefix === 'border') return 'border';
  if (prefix === 'ring') return 'ring';
  return null;
}

// ─────────────────────────────────────────────────────────────
// 文件级替换
// ─────────────────────────────────────────────────────────────

function transform(src) {
  let out = src;
  let changes = 0;

  // 1. text-size
  out = out.replace(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b(?!-)/g, (m, size) => {
    const target = TEXT_SIZE_MAP[size];
    if (!target) return m;
    changes++;
    return `text-${target}`;
  });

  // 2. shadow
  out = out.replace(/\bshadow-(sm|md|lg|xl)\b(?!-soft)/g, (m, sz) => {
    const target = SHADOW_MAP[sz];
    if (!target) return m;
    changes++;
    return target;
  });

  // 3. rounded-xl → rounded-2xl
  out = out.replace(/\brounded-xl\b/g, () => {
    changes++;
    return 'rounded-2xl';
  });

  // 4. semantic color (text/bg/border/ring)-(red/amber/green)-NNN
  out = out.replace(
    /\b(text|bg|border|ring)-(red|amber|green)-(\d{2,3})\b/g,
    (m, prefix, color, shade) => {
      const repl = mapSemanticColor(prefix, color, shade);
      if (repl == null) return m;
      changes++;
      return repl;
    },
  );

  // 5. zinc
  out = out.replace(
    /\b(text|bg|border|ring)-zinc-(\d{2,3})\b/g,
    (m, prefix, shade) => {
      const repl = mapZinc(prefix, shade);
      if (repl == null) return m;
      changes++;
      return repl;
    },
  );

  return { out, changes };
}

// ─────────────────────────────────────────────────────────────
// 走目录
// ─────────────────────────────────────────────────────────────

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

let totalFiles = 0;
let modifiedFiles = 0;
let totalChanges = 0;

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (FILE_FILTER && !FILE_FILTER.some((f) => rel.includes(f))) continue;
    totalFiles++;
    const src = readFileSync(file, 'utf8');
    const { out, changes } = transform(src);
    if (changes > 0 && out !== src) {
      modifiedFiles++;
      totalChanges += changes;
      if (DRY) {
        console.log(`[dry] ${rel}  ${changes} replacements`);
      } else {
        writeFileSync(file, out, 'utf8');
        console.log(`[fix] ${rel}  ${changes} replacements`);
      }
    }
  }
}

console.log('');
console.log(`扫描 ${totalFiles} 文件 · 修改 ${modifiedFiles} · 替换 ${totalChanges} 处`);
console.log(DRY ? '(dry-run · 加 --no-dry 实修)' : '✓ 已写盘');
