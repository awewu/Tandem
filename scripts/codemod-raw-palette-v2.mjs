#!/usr/bin/env node
/**
 * Codemod: replace ALL raw Tailwind palette colors with design tokens.
 * Handles bg/text/border/ring/from/to/via prefixes.
 * Skips files in design-tokens.ts (those are intentional semantic definitions).
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components'];
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build']);
const SKIP_FILES = new Set(['lib/design-tokens.ts']);

// ── Mapping tables ──
const TEXT_MAP = {
  'slate-100': 'text-ink-primary', 'slate-300': 'text-ink-tertiary', 'slate-400': 'text-ink-tertiary', 'slate-500': 'text-ink-tertiary',
  'slate-750': 'text-ink-secondary',
  'slate-600': 'text-ink-secondary', 'slate-700': 'text-ink-secondary',
  'slate-800': 'text-ink-primary', 'slate-900': 'text-ink-primary', 'slate-950': 'text-ink-primary',
  'gray-400': 'text-ink-tertiary', 'gray-500': 'text-ink-tertiary',
  'gray-600': 'text-ink-secondary', 'gray-700': 'text-ink-secondary',
  'gray-800': 'text-ink-primary', 'gray-900': 'text-ink-primary',
  'neutral-400': 'text-ink-tertiary', 'neutral-500': 'text-ink-tertiary',
  'neutral-600': 'text-ink-secondary', 'neutral-700': 'text-ink-secondary',
  'neutral-800': 'text-ink-primary', 'neutral-900': 'text-ink-primary',
  'stone-400': 'text-ink-tertiary', 'stone-500': 'text-ink-tertiary',
  'stone-600': 'text-ink-secondary', 'stone-700': 'text-ink-secondary',
  'stone-800': 'text-ink-primary', 'stone-900': 'text-ink-primary',
  'emerald-300': 'text-success', 'emerald-400': 'text-success', 'emerald-500': 'text-success',
  'emerald-600': 'text-success', 'emerald-700': 'text-success',
  'emerald-800': 'text-success', 'emerald-900': 'text-success', 'emerald-950': 'text-success',
  'green-600': 'text-success', 'green-700': 'text-success',
  'rose-300': 'text-danger', 'rose-400': 'text-danger', 'rose-500': 'text-danger',
  'rose-600': 'text-danger', 'rose-700': 'text-danger',
  'rose-800': 'text-danger', 'rose-900': 'text-danger', 'rose-950': 'text-danger',
  'red-600': 'text-danger', 'red-700': 'text-danger',
  'amber-300': 'text-warning', 'amber-400': 'text-warning', 'amber-500': 'text-warning',
  'amber-600': 'text-warning', 'amber-700': 'text-warning',
  'amber-800': 'text-warning', 'amber-900': 'text-warning',
  'yellow-200': 'text-warning/70', 'yellow-400': 'text-warning', 'yellow-500': 'text-warning', 'yellow-600': 'text-warning', 'yellow-700': 'text-warning',
  'yellow-800': 'text-warning', 'yellow-900': 'text-warning', 'yellow-950': 'text-warning',
  'orange-400': 'text-warning', 'orange-500': 'text-warning', 'orange-600': 'text-warning', 'orange-700': 'text-warning',
  'orange-900': 'text-warning', 'orange-950': 'text-warning',
  'blue-400': 'text-info', 'blue-500': 'text-info', 'blue-600': 'text-info', 'blue-700': 'text-info',
  'blue-800': 'text-info', 'blue-900': 'text-info', 'blue-950': 'text-info',
  'sky-400': 'text-info', 'sky-500': 'text-info', 'sky-600': 'text-info', 'sky-700': 'text-info',
  'sky-800': 'text-info', 'sky-900': 'text-info',
  'cyan-400': 'text-info', 'cyan-500': 'text-info', 'cyan-600': 'text-info', 'cyan-700': 'text-info',
  'cyan-800': 'text-info', 'cyan-900': 'text-info', 'cyan-950': 'text-info',
  'indigo-300': 'text-info/70', 'indigo-400': 'text-info', 'indigo-500': 'text-info', 'indigo-600': 'text-info', 'indigo-700': 'text-info',
  'indigo-800': 'text-info', 'indigo-900': 'text-info', 'indigo-950': 'text-info',
  'violet-300': 'text-brand-600', 'violet-400': 'text-brand-700', 'violet-500': 'text-brand-700', 'violet-600': 'text-brand-700', 'violet-700': 'text-brand-700',
  'violet-800': 'text-brand-700', 'violet-900': 'text-brand-700', 'violet-950': 'text-brand-700',
  'purple-500': 'text-brand-700', 'purple-600': 'text-brand-700', 'purple-700': 'text-brand-700',
  'purple-800': 'text-brand-700', 'purple-900': 'text-brand-700', 'purple-950': 'text-brand-700',
  'fuchsia-500': 'text-brand-700', 'fuchsia-600': 'text-brand-700', 'fuchsia-700': 'text-brand-700',
  'pink-400': 'text-brand-700', 'pink-500': 'text-brand-700', 'pink-600': 'text-brand-700', 'pink-700': 'text-brand-700',
  'pink-900': 'text-brand-700', 'pink-950': 'text-brand-700',
  'teal-500': 'text-success', 'teal-600': 'text-success', 'teal-700': 'text-success',
  'lime-500': 'text-success', 'lime-600': 'text-success', 'lime-700': 'text-success', 'lime-900': 'text-success',
};

const BG_MAP = {
  'slate-50': 'bg-surface-2', 'slate-100': 'bg-surface-3',
  'slate-200': 'bg-surface-3', 'slate-300': 'bg-surface-3',
  'slate-400': 'bg-surface-3', 'slate-500': 'bg-ink-tertiary',
  'slate-600': 'bg-ink-secondary', 'slate-700': 'bg-ink-secondary',
  'slate-800': 'bg-ink-primary', 'slate-900': 'bg-ink-primary', 'slate-950': 'bg-ink-primary',
  'gray-50': 'bg-surface-2', 'gray-100': 'bg-surface-3',
  'gray-200': 'bg-surface-3',
  'neutral-50': 'bg-surface-2', 'neutral-100': 'bg-surface-3',
  'neutral-200': 'bg-surface-3',
  'stone-50': 'bg-surface-2', 'stone-100': 'bg-surface-3',
  'stone-200': 'bg-surface-3',
  'emerald-50': 'bg-success/10', 'emerald-100': 'bg-success/15',
  'emerald-200': 'bg-success/20', 'emerald-300': 'bg-success/25',
  'emerald-400': 'bg-success/30',
  'emerald-400': 'bg-success/30', 'emerald-500': 'bg-success',
  'emerald-600': 'bg-success/80', 'emerald-700': 'bg-success/70',
  'emerald-900': 'bg-success/50', 'emerald-950': 'bg-success/40',
  'green-50': 'bg-success/10', 'green-100': 'bg-success/15',
  'rose-50': 'bg-danger/5', 'rose-100': 'bg-danger/10',
  'rose-200': 'bg-danger/15', 'rose-300': 'bg-danger/20',
  'rose-400': 'bg-danger/30', 'rose-500': 'bg-danger',
  'rose-600': 'bg-danger/80', 'rose-700': 'bg-danger/70',
  'rose-900': 'bg-danger/50', 'rose-950': 'bg-danger/40',
  'red-50': 'bg-danger/5', 'red-100': 'bg-danger/10',
  'amber-50': 'bg-warning/10', 'amber-100': 'bg-warning/15',
  'amber-200': 'bg-warning/20', 'amber-300': 'bg-warning/25',
  'amber-400': 'bg-warning/30', 'amber-500': 'bg-warning',
  'amber-600': 'bg-warning/80', 'amber-700': 'bg-warning/70',
  'amber-900': 'bg-warning/50',
  'yellow-50': 'bg-warning/10', 'yellow-100': 'bg-warning/15', 'yellow-200': 'bg-warning/20',
  'yellow-400': 'bg-warning/30', 'yellow-500': 'bg-warning', 'yellow-800': 'bg-warning/50',
  'yellow-900': 'bg-warning/40', 'yellow-950': 'bg-warning/35',
  'orange-50': 'bg-warning/10', 'orange-100': 'bg-warning/15',
  'orange-400': 'bg-warning/30', 'orange-500': 'bg-warning', 'orange-600': 'bg-warning/80',
  'orange-700': 'bg-warning/70', 'orange-950': 'bg-warning/40',
  'blue-50': 'bg-info/10', 'blue-100': 'bg-info/15',
  'blue-200': 'bg-info/20', 'blue-300': 'bg-info/25',
  'blue-400': 'bg-info/30', 'blue-500': 'bg-info',
  'blue-600': 'bg-info/80', 'blue-700': 'bg-info/70',
  'blue-950': 'bg-info/40',
  'sky-50': 'bg-info/10', 'sky-100': 'bg-info/15',
  'sky-200': 'bg-info/20', 'sky-300': 'bg-info/25',
  'sky-400': 'bg-info/30', 'sky-500': 'bg-info',
  'sky-600': 'bg-info/80', 'sky-700': 'bg-info/70',
  'cyan-50': 'bg-info/10', 'cyan-100': 'bg-info/15', 'cyan-400': 'bg-info/30', 'cyan-500': 'bg-info',
  'cyan-900': 'bg-info/50', 'cyan-950': 'bg-info/40',
  'indigo-50': 'bg-info/10', 'indigo-100': 'bg-info/15', 'indigo-200': 'bg-info/20',
  'indigo-300': 'bg-info/25', 'indigo-400': 'bg-info/30', 'indigo-500': 'bg-info',
  'indigo-600': 'bg-info/80', 'indigo-700': 'bg-info/70', 'indigo-950': 'bg-info/40',
  'violet-50': 'bg-brand-50', 'violet-100': 'bg-brand-100',
  'violet-200': 'bg-brand-200', 'violet-300': 'bg-brand-300',
  'violet-400': 'bg-brand-400', 'violet-500': 'bg-brand-500',
  'violet-600': 'bg-brand-600', 'violet-700': 'bg-brand-700',
  'violet-800': 'bg-brand-800', 'violet-900': 'bg-brand-900', 'violet-950': 'bg-brand-900',
  'purple-50': 'bg-brand-50', 'purple-100': 'bg-brand-100',
  'purple-200': 'bg-brand-200', 'purple-300': 'bg-brand-300',
  'purple-500': 'bg-brand-500', 'purple-600': 'bg-brand-600',
  'purple-700': 'bg-brand-700', 'purple-900': 'bg-brand-900', 'purple-950': 'bg-brand-900',
  'fuchsia-50': 'bg-brand-50', 'fuchsia-100': 'bg-brand-100', 'fuchsia-500': 'bg-brand-500',
  'pink-50': 'bg-brand-50', 'pink-100': 'bg-brand-100', 'pink-400': 'bg-brand-300', 'pink-500': 'bg-brand-500', 'pink-950': 'bg-brand-900',
  'teal-50': 'bg-success/10', 'teal-100': 'bg-success/15', 'teal-500': 'bg-success',
  'lime-50': 'bg-success/10', 'lime-100': 'bg-success/15', 'lime-500': 'bg-success', 'lime-900': 'bg-success/50',
};

const BORDER_MAP = {
  'slate-100': 'border-border', 'slate-200': 'border-border',
  'slate-300': 'border-border', 'slate-400': 'border-border',
  'slate-500': 'border-border', 'slate-600': 'border-border',
  'slate-700': 'border-border', 'slate-800': 'border-border',
  'gray-100': 'border-border', 'gray-200': 'border-border',
  'gray-300': 'border-border',
  'neutral-100': 'border-border', 'neutral-200': 'border-border',
  'neutral-300': 'border-border',
  'stone-100': 'border-border', 'stone-200': 'border-border',
  'stone-300': 'border-border',
  'emerald-100': 'border-success/20', 'emerald-200': 'border-success/30', 'emerald-300': 'border-success/40',
  'emerald-400': 'border-success/50', 'emerald-500': 'border-success', 'emerald-600': 'border-success/80',
  'emerald-900': 'border-success/50',
  'green-200': 'border-success/30', 'green-300': 'border-success/40',
  'rose-100': 'border-danger/20', 'rose-200': 'border-danger/30', 'rose-300': 'border-danger/40',
  'rose-400': 'border-danger/50', 'rose-500': 'border-danger', 'rose-600': 'border-danger/80',
  'rose-900': 'border-danger/50',
  'red-200': 'border-danger/30', 'red-300': 'border-danger/40',
  'amber-200': 'border-warning/30', 'amber-300': 'border-warning/40',
  'amber-400': 'border-warning/50', 'amber-500': 'border-warning', 'amber-600': 'border-warning/80',
  'amber-900': 'border-warning/50',
  'yellow-200': 'border-warning/30', 'yellow-300': 'border-warning/40',
  'yellow-400': 'border-warning/50', 'yellow-500': 'border-warning',
  'orange-200': 'border-warning/30', 'orange-300': 'border-warning/40',
  'blue-200': 'border-info/30', 'blue-300': 'border-info/40',
  'blue-400': 'border-info/50', 'blue-500': 'border-info', 'blue-600': 'border-info/80',
  'blue-700': 'border-info/70',
  'sky-200': 'border-info/30', 'sky-300': 'border-info/40',
  'sky-400': 'border-info/50', 'sky-500': 'border-info', 'sky-600': 'border-info/80',
  'cyan-200': 'border-info/30', 'cyan-300': 'border-info/40',
  'indigo-100': 'border-info/20', 'indigo-200': 'border-info/30', 'indigo-300': 'border-info/40',
  'indigo-500': 'border-info', 'indigo-600': 'border-info/80',
  'violet-200': 'border-brand-200', 'violet-300': 'border-brand-300',
  'violet-400': 'border-brand-400', 'violet-500': 'border-brand-500', 'violet-600': 'border-brand-600',
  'violet-800': 'border-brand-800', 'violet-900': 'border-brand-900',
  'purple-200': 'border-brand-200', 'purple-300': 'border-brand-300',
  'purple-500': 'border-brand-500', 'purple-600': 'border-brand-600',
  'purple-700': 'border-brand-700',
  'fuchsia-200': 'border-brand-200',
  'pink-200': 'border-brand-200',
  'teal-200': 'border-success/30',
  'lime-200': 'border-success/30',
};

const RING_MAP = {
  'slate-200': 'ring-border', 'slate-300': 'ring-border',
  'slate-400': 'ring-border', 'slate-500': 'ring-border',
  'slate-600': 'ring-border', 'slate-700': 'ring-border',
  'slate-800': 'ring-border',
  'emerald-200': 'ring-success/30', 'emerald-300': 'ring-success/40',
  'emerald-400': 'ring-success/50', 'emerald-500': 'ring-success',
  'rose-200': 'ring-danger/30', 'rose-300': 'ring-danger/40',
  'rose-400': 'ring-danger/50', 'rose-500': 'ring-danger',
  'amber-200': 'ring-warning/30', 'amber-300': 'ring-warning/40',
  'amber-400': 'ring-warning/50', 'amber-500': 'ring-warning',
  'blue-200': 'ring-info/30', 'blue-300': 'ring-info/40',
  'blue-400': 'ring-info/50', 'blue-500': 'ring-info',
  'sky-200': 'ring-info/30', 'sky-300': 'ring-info/40',
  'sky-500': 'ring-info',
  'indigo-100': 'ring-info/20', 'indigo-200': 'ring-info/30', 'indigo-300': 'ring-info/40',
  'indigo-400': 'ring-info/50', 'indigo-500': 'ring-info',
  'yellow-400': 'ring-warning/50', 'yellow-500': 'ring-warning',
  'violet-200': 'ring-brand-200', 'violet-300': 'ring-brand-300',
  'violet-400': 'ring-brand-400', 'violet-500': 'ring-brand-500', 'violet-600': 'ring-brand-600',
  'purple-200': 'ring-brand-200', 'purple-300': 'ring-brand-300',
  'purple-500': 'ring-brand-500',
};

const FROM_MAP = {
  'slate-50': 'from-surface-2', 'slate-100': 'from-surface-3',
  'emerald-50': 'from-success/10', 'emerald-500': 'from-success',
  'rose-50': 'from-danger/5', 'rose-500': 'from-danger',
  'amber-50': 'from-warning/10', 'amber-400': 'from-warning/30', 'amber-500': 'from-warning',
  'blue-50': 'from-info/10', 'blue-500': 'from-info',
  'sky-50': 'from-info/10', 'sky-500': 'from-info',
  'violet-50': 'from-brand-50', 'violet-500': 'from-brand-500', 'violet-600': 'from-brand-600',
  'purple-50': 'from-brand-50', 'purple-500': 'from-brand-500', 'purple-600': 'from-brand-600',
  'indigo-500': 'from-info', 'orange-500': 'from-warning',
  'purple-700': 'from-brand-700', 'cyan-400': 'from-info/30',
  'slate-400': 'from-ink-tertiary',
  'emerald-400': 'from-success/30', 'rose-400': 'from-danger/30',
  'sky-400': 'from-info/30', 'violet-400': 'from-brand-400',
  'pink-400': 'from-brand-300', 'teal-500': 'from-success',
  'slate-700': 'from-ink-secondary', 'slate-800': 'from-ink-primary',
  'violet-900': 'from-brand-900', 'violet-950': 'from-brand-900',
};

const TO_MAP = {
  'slate-50': 'to-surface-2', 'slate-100': 'to-surface-3',
  'emerald-50': 'to-success/10', 'emerald-500': 'to-success',
  'rose-50': 'to-danger/5', 'rose-500': 'to-danger',
  'amber-50': 'to-warning/10', 'amber-500': 'to-warning',
  'blue-50': 'to-info/10', 'blue-500': 'to-info',
  'sky-50': 'to-info/10', 'sky-500': 'to-info',
  'violet-50': 'to-brand-50', 'violet-500': 'to-brand-500', 'violet-600': 'to-brand-600',
  'purple-50': 'to-brand-50', 'purple-500': 'to-brand-500', 'purple-600': 'to-brand-600',
  'indigo-500': 'to-info', 'orange-50': 'to-warning/10',
  'orange-500': 'to-warning', 'orange-600': 'to-warning/80',
  'emerald-400': 'to-success/30', 'emerald-900': 'to-success/50',
  'rose-400': 'to-danger/30',
  'sky-400': 'to-info/30', 'violet-400': 'to-brand-400',
  'violet-800': 'to-brand-800', 'violet-900': 'to-brand-900', 'violet-950': 'to-brand-900',
  'teal-500': 'to-success', 'pink-400': 'to-brand-300',
  'slate-700': 'to-ink-secondary', 'slate-800': 'to-ink-primary', 'slate-900': 'to-ink-primary',
  'yellow-500': 'to-warning', 'yellow-200': 'to-warning/20',
  'indigo-100': 'to-info/15', 'indigo-200': 'to-info/20', 'indigo-300': 'to-info/25',
  'blue-600': 'to-info/80', 'blue-700': 'to-info/70',
  'amber-400': 'to-warning/30', 'slate-600': 'to-ink-secondary',
};

const VIA_MAP = {
  'slate-100': 'via-surface-3', 'emerald-100': 'via-success/15',
  'rose-100': 'via-danger/10', 'amber-100': 'via-warning/15',
  'blue-100': 'via-info/15', 'sky-100': 'via-info/15',
  'violet-100': 'via-brand-100', 'purple-100': 'via-brand-100',
  'slate-700': 'via-ink-secondary', 'slate-800': 'via-ink-primary',
  'amber-50': 'via-warning/10', 'amber-900': 'via-warning/50',
  'emerald-900': 'via-success/50',
};

const ALL_COLORS = new Set([
  'blue','violet','cyan','slate','sky','emerald','rose','purple',
  'indigo','fuchsia','pink','orange','teal','lime','green','red',
  'amber','yellow','gray','grey','neutral','stone',
]);

const MAPS = { text: TEXT_MAP, bg: BG_MAP, border: BORDER_MAP, ring: RING_MAP, from: FROM_MAP, to: TO_MAP, via: VIA_MAP };

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

let totalReplaced = 0;
let filesChanged = 0;
const unresolved = [];

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (SKIP_FILES.has(rel)) continue;
    const src = readFileSync(file, 'utf8');
    let out = src;
    let fileCount = 0;

    for (const [prefix, map] of Object.entries(MAPS)) {
      // Match prefix-color-shade with optional /alpha
      const re = new RegExp(`\\b${prefix}-((?:${[...ALL_COLORS].join('|')})-\\d+)(\\/\\d+)?`, 'g');
      out = out.replace(re, (full, colorShade, alpha) => {
        const replacement = map[colorShade];
        if (!replacement) {
          unresolved.push(`${rel}: ${full}`);
          return full;
        }
        // If the replacement already has an alpha (e.g. bg-success/10) and input had alpha, skip
        if (alpha && replacement.includes('/')) return replacement;
        if (alpha) return replacement + alpha;
        fileCount++;
        return replacement;
      });
    }

    if (out !== src) {
      writeFileSync(file, out, 'utf8');
      filesChanged++;
      totalReplaced += fileCount;
    }
  }
}

console.log(`Codemod complete: ${totalReplaced} replacements across ${filesChanged} files`);
if (unresolved.length > 0) {
  console.log(`\nUnresolved (${unresolved.length}):`);
  unresolved.slice(0, 30).forEach(u => console.log(`  ${u}`));
  if (unresolved.length > 30) console.log(`  ... and ${unresolved.length - 30} more`);
}
