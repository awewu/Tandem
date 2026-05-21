/**
 * Dynamic [id] page render smoke.
 *
 * Resolves a fixture id per dynamic route from the seed data via list APIs,
 * then renders the detail page as anon / employee / admin and asserts:
 *   - 200 (or 307 redirect)
 *   - HTML body has no obvious render error markers
 */

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const BASE = process.env.BASE ?? 'http://localhost:3001';
const SECRET = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || 'dev-only-secret-do-not-use-in-prod';

function b64u(b) { return Buffer.from(b).toString('base64url'); }
function signToken(p) {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...p, iat: now, exp: now + 900 };
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const bd = b64u(JSON.stringify(full));
  const sig = createHmac('sha256', SECRET).update(`${h}.${bd}`).digest('base64url');
  return `${h}.${bd}.${sig}`;
}

const adminToken = signToken({ sub: 'admin-1', email: 'a@t', roles: ['admin', 'employee'], tenantId: 'default', mfa: true, sid: 'sa' });
const employeeToken = signToken({ sub: 'employee-1', email: 'e@t', roles: ['employee'], tenantId: 'default', mfa: false, sid: 'se' });

async function getJson(path, token = adminToken) {
  const r = await fetch(BASE + path, { headers: { Cookie: `tandem_at=${token}` } });
  try { return await r.json(); } catch { return null; }
}

// id resolvers: each returns string|null
const RESOLVERS = {
  '/bitable/[id]': async () => {
    // No bitable seed data; create one as admin so we can render the detail page.
    const list = await getJson('/api/bitable/tables');
    if (list?.tables?.[0]?.id) return list.tables[0].id;
    const r = await fetch(BASE + '/api/bitable/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `tandem_at=${adminToken}` },
      body: JSON.stringify({ name: 'Smoke Bitable', fields: [{ name: 'col1', type: 'text' }] }),
    });
    try {
      const created = await r.json();
      return created?.table?.id ?? created?.id ?? null;
    } catch { return null; }
  },
  '/convergence/[id]': async () => {
    // Convergence detail page renders by decision-card id (cardId param).
    const r = await getJson('/api/convergence');
    return r?.cards?.[0]?.id ?? r?.rooms?.[0]?.id ?? r?.[0]?.id ?? null;
  },
  '/documents/[id]': async () => {
    const r = await getJson('/api/documents');
    return r?.documents?.[0]?.id ?? r?.[0]?.id ?? null;
  },
  '/decision-card/[id]': async () => {
    const r = await getJson('/api/convergence');
    return r?.cards?.[0]?.id ?? null;
  },
  '/meetings/room/[id]': async () => {
    // Meetings room shares decision-card id as room id in this app.
    const r = await getJson('/api/convergence');
    return r?.cards?.[0]?.id ?? null;
  },
};

async function check(route, token) {
  const headers = {};
  if (token) headers.Cookie = `tandem_at=${token}`;
  try {
    const r = await fetch(BASE + route, { headers, redirect: 'manual' });
    if (r.status === 307 || r.status === 308) return { status: r.status, ok: true, note: 'redirect' };
    if (r.status !== 200) return { status: r.status, ok: false };
    const txt = await r.text();
    if (/Application error|Internal Server Error/.test(txt)) return { status: 200, ok: false, note: 'render error' };
    return { status: 200, ok: true, len: txt.length };
  } catch (err) {
    return { status: 0, ok: false, note: String(err) };
  }
}

(async () => {
  let pass = 0, fail = 0;
  console.log('\n=== Dynamic [id] page smoke ===\n');
  console.log('route                            id           anon         employee     admin');
  console.log('───────────────────────────────  ───────────  ───────────  ───────────  ───────────');
  for (const [pattern, resolve] of Object.entries(RESOLVERS)) {
    const id = await resolve();
    const route = id ? pattern.replace('[id]', id) : null;
    if (!route) {
      console.log(`${pattern.padEnd(31)}  ${'(no fixture)'.padEnd(11)}  —            —            —`);
      continue;
    }
    const a = await check(route);
    const e = await check(route, employeeToken);
    const ad = await check(route, adminToken);
    const fmt = (x) => {
      if (x.ok) { pass++; return `${x.status}✓`.padEnd(11); }
      fail++;
      return `${x.status}✗${(x.note ?? '').slice(0, 6)}`.padEnd(11);
    };
    const idShort = id.length > 11 ? id.slice(0, 8) + '…' : id;
    console.log(`${pattern.padEnd(31)}  ${idShort.padEnd(11)}  ${fmt(a)}  ${fmt(e)}  ${fmt(ad)}`);
  }
  console.log(`\nSummary: ${pass} OK, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
