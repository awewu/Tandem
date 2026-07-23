#!/usr/bin/env node
/*
 * Legacy static page VI migration.
 *
 * Brings P3 static-inventory demo pages onto the Rheem official-aligned VI:
 *  - injects the official token stylesheet link when missing
 *  - rewrites forbidden/off-brand hex colors to brand tokens
 *
 * Color map source of truth: archive/legacy-ui/public/css/rheem-official-tokens.css
 *   --rheem-color-red       #DD001C   (primary action / brand red)
 *   --rheem-color-red-deep  #A50016   (hover / gradient end)
 *   --rheem-color-blue      #1B365D   (domain / navigation blue)
 *
 * Usage:
 *   node scripts/agent-guards/legacy-page-vi-migrate.js          # apply
 *   node scripts/agent-guards/legacy-page-vi-migrate.js --dry    # report only
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const publicDir = path.join(root, 'archive', 'legacy-ui', 'public');
const dryRun = process.argv.includes('--dry');

const TOKEN_HREF = '/css/rheem-official-tokens.css';
const TOKEN_LINK = `<link rel="stylesheet" href="${TOKEN_HREF}">`;

// Off-brand -> brand token hex. Keys are lowercase.
const colorMap = new Map([
  // AI purple gradient pair -> brand red / deep red
  ['#667eea', '#DD001C'],
  ['#764ba2', '#A50016'],
  // Generic / framework blues -> Rheem domain navy
  ['#3498db', '#1B365D'],
  ['#2563eb', '#1B365D'],
  ['#3b82f6', '#1B365D'],
  ['#6366f1', '#1B365D'],
  ['#2a5298', '#1B365D'],
  ['#1e3c72', '#1B365D'],
  // Pink accents -> brand red
  ['#ff4081', '#DD001C'],
  ['#e91e63', '#DD001C'],
  ['#ec4899', '#DD001C'],
  ['#ff6b8a', '#DD001C'],
  // Legacy reds -> brand red (deep red kept where it is a hover tone)
  ['#e74c3c', '#DD001C'],
  ['#f44336', '#DD001C'],
]);

// Full-inventory scan: every static page under archive/legacy-ui/public/ is a migration target.
const targetPages = fs
  .readdirSync(publicDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''))
  .sort();

function replaceColors(html) {
  let count = 0;
  let out = html;
  for (const [from, to] of colorMap) {
    const re = new RegExp(from.replace('#', '#'), 'gi');
    out = out.replace(re, (m) => {
      count += 1;
      return to;
    });
  }
  return { out, count };
}

function ensureTokenLink(html) {
  if (html.includes(TOKEN_HREF)) return { out: html, injected: false };
  // Inject right before the first existing stylesheet link, else before </head>.
  const firstLink = html.search(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/i);
  if (firstLink !== -1) {
    const out = html.slice(0, firstLink) + TOKEN_LINK + '\n  ' + html.slice(firstLink);
    return { out, injected: true };
  }
  const headClose = html.search(/<\/head>/i);
  if (headClose !== -1) {
    const out = html.slice(0, headClose) + '  ' + TOKEN_LINK + '\n' + html.slice(headClose);
    return { out, injected: true };
  }
  return { out: html, injected: false };
}

const results = [];
for (const name of targetPages) {
  const file = path.join(publicDir, `${name}.html`);
  if (!fs.existsSync(file)) {
    results.push({ page: name, status: 'missing' });
    continue;
  }
  const original = fs.readFileSync(file, 'utf8');
  const linked = ensureTokenLink(original);
  const recolored = replaceColors(linked.out);
  const changed = linked.injected || recolored.count > 0;
  if (changed && !dryRun) {
    fs.writeFileSync(file, recolored.out, 'utf8');
  }
  results.push({
    page: name,
    status: changed ? (dryRun ? 'would-change' : 'changed') : 'no-change',
    tokenInjected: linked.injected,
    colorReplacements: recolored.count,
  });
}

const summary = {
  mode: dryRun ? 'dry-run' : 'apply',
  pages: results.length,
  changed: results.filter((r) => r.status === 'changed' || r.status === 'would-change').length,
  totalColorReplacements: results.reduce((a, r) => a + (r.colorReplacements || 0), 0),
  results,
};
console.log(JSON.stringify(summary, null, 2));
