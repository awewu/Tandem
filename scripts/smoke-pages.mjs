/**
 * Page render smoke — HTTP-level (no Playwright).
 *
 * Hits every top-level page route as anon (demo fallback on) and as admin,
 * asserting:
 *   - 200 status
 *   - HTML body contains <html, <body, no obvious "Application error" / RSC error markers
 *
 * Detail-route pages with `[id]` are skipped (need fixture id).
 */

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const BASE = process.env.BASE ?? 'http://localhost:3001';
const SECRET = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || 'dev-only-secret-do-not-use-in-prod';

function b64u(buf) { return Buffer.from(buf).toString('base64url'); }
function signToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + 900 };
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const b = b64u(JSON.stringify(full));
  const sig = createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${sig}`;
}

const adminToken = signToken({
  sub: 'admin-1', email: 'admin@t.local',
  roles: ['admin', 'employee'], tenantId: 'default', mfa: true, sid: 'sa',
});
const employeeToken = signToken({
  sub: 'employee-1', email: 'emp@t.local',
  roles: ['employee'], tenantId: 'default', mfa: false, sid: 'se',
});

// Discover all page.tsx routes (excluding [param] dynamic segments).
function discoverRoutes(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === 'page.tsx') out.push(prefix || '/');
      continue;
    }
    if (entry === 'api' || entry.startsWith('_') || entry === 'node_modules') continue;
    if (entry.startsWith('[') && entry.endsWith(']')) continue; // dynamic — skip
    out.push(...discoverRoutes(full, `${prefix}/${entry}`));
  }
  return out;
}

const routes = discoverRoutes('app').sort();

async function check(route, role, token) {
  const headers = {};
  if (token) headers.Cookie = `tandem_at=${token}`;
  let status = 0, len = 0, errMarker = null;
  try {
    const r = await fetch(BASE + route, { headers, redirect: 'manual' });
    status = r.status;
    if (status === 200) {
      const txt = await r.text();
      len = txt.length;
      // Common Next.js / React error markers
      if (/Application error|Internal Server Error|Server Error: \(/.test(txt)) errMarker = 'render error';
      else if (/digest:/.test(txt) && /Error:/.test(txt)) errMarker = 'RSC error';
      else if (!/<html|<!DOCTYPE/i.test(txt) && !/__next/.test(txt)) errMarker = 'no html';
    }
  } catch (err) {
    status = 0; errMarker = String(err);
  }
  return { status, len, errMarker };
}

(async () => {
  const rows = [];
  for (const r of routes) {
    const a = await check(r, 'anon');
    const e = await check(r, 'employee', employeeToken);
    const ad = await check(r, 'admin', adminToken);
    rows.push({ route: r, anon: a, employee: e, admin: ad });
  }

  console.log(`\n=== Page render smoke (${rows.length} routes) ===\n`);
  const pad = (s, n) => String(s).padEnd(n);
  const w0 = Math.max(5, ...rows.map((r) => r.route.length));
  console.log([pad('route', w0), pad('anon', 14), pad('employee', 14), pad('admin', 14)].join('  '));
  console.log(['─'.repeat(w0), '─'.repeat(14), '─'.repeat(14), '─'.repeat(14)].join('  '));

  let pass = 0, fail = 0;
  for (const row of rows) {
    const fmt = (x) => {
      if (x.status === 200 && !x.errMarker) { pass++; return `200✓ ${x.len}b`.padEnd(14); }
      if (x.status === 307 || x.status === 308) { pass++; return `${x.status}↪ redirect`.padEnd(14); }
      fail++;
      const detail = x.errMarker ?? `${x.status}`;
      return `${x.status}✗${detail.slice(0, 8)}`.padEnd(14);
    };
    console.log([pad(row.route, w0), fmt(row.anon), fmt(row.employee), fmt(row.admin)].join('  '));
  }

  console.log(`\nSummary: ${pass} OK, ${fail} failed (${rows.length} routes × 3 roles)`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
