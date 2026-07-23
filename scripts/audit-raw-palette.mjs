#!/usr/bin/env node
/**
 * Deep VI/SI audit — finds raw Tailwind palette colors that bypass design tokens.
 * The existing check-ui-charter.mjs only catches zinc/red/green/amber;
 * this script catches ALL raw palette usage (blue/violet/sky/emerald/rose/slate/etc.)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const PAT = /\b(?:bg|text|border|ring|from|to|via)-(?:blue|violet|cyan|slate|sky|emerald|rose|purple|indigo|fuchsia|pink|orange|teal|lime|green|red|amber|yellow|gray|grey|neutral|stone)-\d+(?:\/\d+)?/g;

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

const byFile = new Map();
let total = 0;

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const src = readFileSync(file, 'utf8');
    PAT.lastIndex = 0;
    let m, count = 0;
    const matches = [];
    while ((m = PAT.exec(src)) !== null) {
      count++;
      const lineNo = src.slice(0, m.index).split('\n').length;
      matches.push({ line: lineNo, match: m[0] });
    }
    if (count > 0) {
      total += count;
      byFile.set(rel, matches);
    }
  }
}

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`\n=== Raw Palette Violation Audit ===`);
console.log(`Total violations: ${total}`);
console.log(`Files affected: ${sorted.length}\n`);
console.log(`Top 30 files:`);
sorted.slice(0, 30).forEach(([file, matches]) => {
  console.log(`  ${String(matches.length).padStart(4)}  ${file}`);
});

// Group by palette color
const byColor = new Map();
for (const [file, matches] of byFile) {
  for (const m of matches) {
    const color = m.match.match(/-(\w+)-\d/)?.[1] ?? 'unknown';
    if (!byColor.has(color)) byColor.set(color, 0);
    byColor.set(color, byColor.get(color) + 1);
  }
}
console.log(`\nBy color:`);
[...byColor.entries()].sort((a, b) => b[1] - a[1]).forEach(([color, count]) => {
  console.log(`  ${String(count).padStart(5)}  ${color}`);
});
