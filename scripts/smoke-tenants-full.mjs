/**
 * Cross-module tenant isolation smoke.
 *
 * Premise: all seed data lives under tenantId='default'.
 * If an admin signed under tenantId='ghost-tenant' can read any default-tenant
 * data, the module is leaking across tenants.
 *
 * For each module, we extract a count from the list response.
 *   - default-tenant admin should see N > 0 (proves data exists & API works)
 *   - ghost-tenant admin should see 0       (proves isolation)
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
function tk(p) {
  const now = Math.floor(Date.now()/1000);
  const f = { ...p, iat: now, exp: now + 900 };
  const h = b64u(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const bd = b64u(JSON.stringify(f));
  const s = createHmac('sha256', SECRET).update(`${h}.${bd}`).digest('base64url');
  return `${h}.${bd}.${s}`;
}

// Use 'demo-user' as the default-tenant identity so notifications/seeded user-scoped
// data is visible (seed creates notifs targeted to demo-user / colleague-li).
const tokDefault = tk({ sub:'demo-user', email:'demo-user@t', roles:['admin','employee','manager','steward'], tenantId:'default',      mfa:true, sid:'sd' });
const tokGhost   = tk({ sub:'demo-user', email:'demo-user@t', roles:['admin','employee','manager','steward'], tenantId:'ghost-tenant', mfa:true, sid:'sg' });

async function listCount(path, token, extract) {
  const r = await fetch(BASE + path, { headers: { Cookie: `tandem_at=${token}` } });
  if (r.status !== 200) return { status: r.status, count: null };
  try {
    const body = await r.json();
    return { status: 200, count: extract(body), body };
  } catch {
    return { status: 200, count: null };
  }
}

// Module → list path + count extractor
const MODULES = [
  { name: 'launchpad',     path: '/api/admin/launchpad', count: (b) => b.apps?.length ?? 0 },
  { name: 'documents',     path: '/api/documents',       count: (b) => (b.documents ?? b.items ?? b ?? []).length ?? 0 },
  { name: 'drive',         path: '/api/drive',           count: (b) => (b.files ?? b.items ?? b ?? []).length ?? 0 },
  { name: 'calendar',      path: '/api/calendar',        count: (b) => (b.events ?? []).length ?? 0 },
  { name: 'notifications', path: '/api/notifications',   count: (b) => (b.notifications ?? []).length ?? 0 },
  { name: 'im-channels',   path: '/api/im/channels',     count: (b) => (b.channels ?? b.items ?? []).length ?? 0 },
  { name: 'bitable',       path: '/api/bitable/tables',  count: (b) => (b.tables ?? []).length ?? 0 },
  { name: 'approvals',     path: '/api/approvals',       count: (b) => (b.approvals ?? b.requests ?? b.items ?? []).length ?? 0 },
  { name: '1on1',          path: '/api/1on1',            count: (b) => (b.meetings ?? b.sessions ?? b.items ?? []).length ?? 0 },
  { name: '360-cycles',    path: '/api/360/cycles',      count: (b) => (b.cycles ?? []).length ?? 0 },
  { name: 'convergence',   path: '/api/convergence',     count: (b) => (b.cards ?? b.rooms ?? b.items ?? []).length ?? 0 },
  { name: 'tandem-okr',    path: '/api/tandem-okr',      count: (b) => (b.objectives ?? []).length ?? 0 },
  { name: 'okr-initiatives', path: '/api/okr/initiatives', count: (b) => (b.initiatives ?? []).length ?? 0 },
  { name: 'audit',         path: '/api/audit',           count: (b) => (b.entries ?? b.logs ?? b.items ?? []).length ?? 0 },
  // budget returns {snapshot:{}} — not a list endpoint, skip tenant iso check (no leakable rows)
];

(async () => {
  let isolated = 0, leaked = 0, skipped = 0;
  console.log('\n=== Cross-module tenant isolation ===\n');
  console.log('module             default  ghost  result');
  console.log('─────────────────  ───────  ─────  ─────────────');
  const leaks = [];
  for (const m of MODULES) {
    const def = await listCount(m.path, tokDefault, m.count);
    const gho = await listCount(m.path, tokGhost, m.count);
    let result;
    if (def.status !== 200 || gho.status !== 200) { result = 'skip(no 200)'; skipped++; }
    else if (def.count === null || gho.count === null) { result = 'skip(parse)'; skipped++; }
    else if (def.count === 0) { result = 'skip(no data)'; skipped++; }
    else if (gho.count === 0) { result = 'ISOLATED ✓'; isolated++; }
    else { result = `LEAK ✗ (${gho.count}/${def.count})`; leaked++; leaks.push(m.name); }
    const defS = String(def.count ?? def.status).padStart(7);
    const ghoS = String(gho.count ?? gho.status).padStart(5);
    console.log(`${m.name.padEnd(17)}  ${defS}  ${ghoS}  ${result}`);
  }
  console.log(`\nSummary: ${isolated} isolated, ${leaked} LEAKED, ${skipped} skipped (${MODULES.length} modules)`);
  if (leaks.length) console.log(`Leaks: ${leaks.join(', ')}`);
  process.exit(leaked > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
