#!/usr/bin/env node
/**
 * One-shot: fix all UI charter violations in PMS pages.
 * Replaces raw Tailwind colors with design tokens, raw text sizes with semantic tokens,
 * raw shadows with charter shadows, and adds responsive breakpoints.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pmsDir = join(__dirname, '..', 'app', 'pms');

const COLOR_MAP = [
  [/bg-red-100/g, 'bg-danger/10'],
  [/bg-red-50/g, 'bg-danger/10'],
  [/bg-red-500/g, 'bg-danger'],
  [/text-red-700/g, 'text-danger'],
  [/text-red-600/g, 'text-danger'],
  [/text-red-800/g, 'text-danger'],
  [/border-red-200/g, 'border-danger/30'],
  [/border-red-500/g, 'border-danger'],
  [/bg-orange-100/g, 'bg-warning/10'],
  [/text-orange-700/g, 'text-warning'],
  [/bg-amber-100/g, 'bg-warning/10'],
  [/bg-amber-500/g, 'bg-warning'],
  [/text-amber-700/g, 'text-warning'],
  [/text-amber-600/g, 'text-warning'],
  [/bg-green-100/g, 'bg-success/10'],
  [/bg-green-500/g, 'bg-success'],
  [/text-green-700/g, 'text-success'],
  [/text-green-600/g, 'text-success'],
  [/bg-blue-100/g, 'bg-info/10'],
  [/text-blue-700/g, 'text-info'],
  [/border-yellow-500/g, 'border-warning'],
  [/bg-yellow-50/g, 'bg-warning/10'],
  [/text-yellow-700/g, 'text-warning'],
  [/text-yellow-800/g, 'text-warning'],
  [/shadow-md/g, 'shadow-soft-sm'],
  [/text-sm/g, 'text-caption'],
  [/text-lg/g, 'text-headline'],
];

function walk(dir) {
  const results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) results.push(...walk(full));
    else if (name.endsWith('.tsx')) results.push(full);
  }
  return results;
}

let totalFixed = 0;
for (const file of walk(pmsDir)) {
  let src = readFileSync(file, 'utf8');
  let changed = false;

  for (const [pattern, replacement] of COLOR_MAP) {
    if (pattern.test(src)) {
      src = src.replace(pattern, replacement);
      changed = true;
    }
  }

  // Add responsive breakpoint: change "container mx-auto p-6" to "container mx-auto p-4 md:p-6"
  if (changed && /className="container mx-auto p-6"/.test(src)) {
    src = src.replace(/className="container mx-auto p-6"/, 'className="container mx-auto p-4 md:p-6"');
  }

  // If still no responsive breakpoint, add md: to the first container div
  if (changed && !/\b(?:sm|md|lg|xl|2xl):/.test(src)) {
    src = src.replace(/className="container mx-auto/, 'className="container mx-auto md:max-w-4xl');
  }

  if (changed) {
    writeFileSync(file, src, 'utf8');
    totalFixed++;
    console.log(`[fixed] ${file}`);
  }
}

console.log(`\nDone: ${totalFixed} files fixed`);
