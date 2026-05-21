/**
 * Write-endpoint role gate matrix.
 *
 * For each mutating endpoint, verify:
 *   - admin       : can write (2xx)
 *   - non-admin   : forbidden (403) or open (200, if endpoint isn't admin-only)
 *   - anon        : with ALLOW_DEMO_AUTH=1 → demo-admin → 2xx; else 401
 *
 * Strategy: dry-run with minimal body, accept 400/422 as "auth passed but body invalid"
 * (still proves the gate works). Only mark fail when 401/403 mismatches expectation.
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

const TOKENS = {
  admin:    tk({ sub:'admin-1',    email:'a@t', roles:['admin','employee'],   tenantId:'default', mfa:true,  sid:'sa' }),
  manager:  tk({ sub:'manager-1',  email:'m@t', roles:['manager','employee'], tenantId:'default', mfa:false, sid:'sm' }),
  employee: tk({ sub:'employee-1', email:'e@t', roles:['employee'],           tenantId:'default', mfa:false, sid:'se' }),
};

async function call(path, method, body, role) {
  const headers = { 'Content-Type': 'application/json' };
  if (role !== 'anon') headers.Cookie = `tandem_at=${TOKENS[role]}`;
  try {
    const r = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    return r.status;
  } catch { return 0; }
}

// Each entry: path, method, body, gate ('admin' | 'open')
//   - 'admin'  : non-admin should get 403, admin 2xx-or-4xx-not-401/403
//   - 'open'   : any auth role should get 2xx-or-4xx-not-401/403
const CASES = [
  // Admin-only writes
  { path: '/api/admin/launchpad',         method: 'POST', body: { orderMap: [] }, gate: 'admin' },
  { path: '/api/launchpad',               method: 'POST', body: { name: 'X', url: 'https://x', category: 'business' }, gate: 'admin' },

  // Open writes (any logged user)
  { path: '/api/im/channels',             method: 'POST', body: { name: 'smoke-channel', kind: 'group' }, gate: 'open' },
  { path: '/api/calendar',                method: 'POST', body: { title: 'smoke', startAt: new Date().toISOString(), endAt: new Date(Date.now()+3600000).toISOString() }, gate: 'open' },
  { path: '/api/notifications',           method: 'POST', body: { userId: 'demo-user', type: 'system', title: 'smoke', body: 'x' }, gate: 'open' },
  { path: '/api/okr/checkins',            method: 'POST', body: { scope: 'objective', scopeId: 'nonexistent', confidence: 7 }, gate: 'open' },
  { path: '/api/convergence',             method: 'POST', body: { title: 'smoke', options: [] }, gate: 'open' },
];

function judge(status, gate, role) {
  // 401 expected when role=anon AND no demo fallback. With ALLOW_DEMO_AUTH=1 here, anon=admin.
  if (gate === 'admin') {
    if (role === 'admin' || role === 'anon') {
      // anon falls back to demo-admin → should NOT be 403/401
      return status >= 200 && status < 500 && status !== 401 && status !== 403;
    }
    return status === 403;
  }
  // open
  return status >= 200 && status < 500 && status !== 401 && status !== 403;
}

(async () => {
  let pass = 0, fail = 0;
  console.log('\n=== Write-endpoint role gate matrix ===\n');
  console.log('endpoint                              gate    anon       admin      manager    employee');
  console.log('────────────────────────────────────  ──────  ─────────  ─────────  ─────────  ─────────');
  for (const c of CASES) {
    const cells = {};
    for (const role of ['anon', 'admin', 'manager', 'employee']) {
      const status = await call(c.path, c.method, c.body, role);
      const ok = judge(status, c.gate, role);
      if (ok) pass++; else fail++;
      cells[role] = `${status}${ok?'✓':'✗'}`.padEnd(9);
    }
    const label = `${c.method} ${c.path}`.slice(0, 36).padEnd(36);
    console.log(`${label}  ${c.gate.padEnd(6)}  ${cells.anon}  ${cells.admin}  ${cells.manager}  ${cells.employee}`);
  }
  console.log(`\nSummary: ${pass} passed, ${fail} failed (${CASES.length} endpoints × 4 roles)`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
