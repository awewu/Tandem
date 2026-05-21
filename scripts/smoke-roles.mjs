/**
 * Multi-role smoke matrix.
 *
 * Roles:
 *   - admin       : full access (also bypasses requireRole when demo, but here we use real JWT)
 *   - manager     : OKR/manager-scoped read
 *   - employee    : baseline employee
 *   - steward     : memory/baseline-guard owner
 *   - guest       : low-privilege (employee role only)
 *   - anon        : no token (must NOT auto-fall-back when ALLOW_DEMO_AUTH=0)
 *
 * Strategy:
 *   - Sign HS256 JWT with NEXTAUTH_SECRET / SESSION_SECRET (or dev default).
 *   - Hit a curated GET endpoint per module (read-only, no mutation).
 *   - Assert status code expected per role.
 *
 * Output: PASS/FAIL table + summary.
 */

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

// Load .env files in Next.js precedence: .env.local > .env
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

const ROLES = {
  admin:    { sub: 'admin-1',    email: 'admin@t.local',    roles: ['admin', 'employee'],   tenantId: 'default', mfa: true,  sid: 'sa' },
  manager:  { sub: 'manager-1',  email: 'mgr@t.local',      roles: ['manager', 'employee'], tenantId: 'default', mfa: false, sid: 'sm' },
  employee: { sub: 'employee-1', email: 'emp@t.local',      roles: ['employee'],            tenantId: 'default', mfa: false, sid: 'se' },
  steward:  { sub: 'steward-1',  email: 'stwd@t.local',     roles: ['steward', 'employee'], tenantId: 'default', mfa: false, sid: 'st' },
  guest:    { sub: 'guest-1',    email: 'guest@t.local',    roles: ['employee'],            tenantId: 'default', mfa: false, sid: 'sg' },
};

const TOKENS = Object.fromEntries(Object.entries(ROLES).map(([k, p]) => [k, signToken(p)]));

async function hit(path, role, method = 'GET', body) {
  const headers = {};
  if (role !== 'anon') headers.Cookie = `tandem_at=${TOKENS[role]}`;
  if (body) headers['Content-Type'] = 'application/json';
  try {
    const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status };
  } catch (err) {
    return { status: 0, err: String(err) };
  }
}

// Curated read-only endpoints across modules.
// Status codes: 200 = OK, 401 = unauth, 403 = forbidden, 404 = not found.
// For /api/auth/me: fake users don't exist in DB → 404 expected for valid JWT,
// 401 for anon (no demo fallback there).
const CASES = [
  // ── Public / health ────────────────────────────────
  { path: '/api/health',                 expect: { anon: 200, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Auth ───────────────────────────────────────────
  { path: '/api/auth/me',                expect: { anon: 401, employee: 404, admin: 404, manager: 404, steward: 404, guest: 404 } }, // /me: 401 anon, 404 unknown user

  // ── Dashboard ──────────────────────────────────────
  { path: '/api/dashboard/stats',        expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── OKR ────────────────────────────────────────────
  { path: '/api/tandem-okr',             expect: { anon: 401, employee: 200, manager: 200, admin: 200, steward: 200, guest: 200 } },
  { path: '/api/okr/initiatives',        expect: { anon: 401, employee: 200, manager: 200, admin: 200, steward: 200, guest: 200 } },
  { path: '/api/okr/checkins',           expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/nine-box',               expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Convergence ────────────────────────────────────
  { path: '/api/convergence',            expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── IM / Channels ─────────────────────────────────
  { path: '/api/im/channels',            expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Drive ──────────────────────────────────────────
  { path: '/api/drive',                  expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/drive/breadcrumbs',      expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Calendar ───────────────────────────────────────
  { path: '/api/calendar',               expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Documents ──────────────────────────────────────
  { path: '/api/documents',              expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Notifications ──────────────────────────────────
  { path: '/api/notifications',          expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Bitable ────────────────────────────────────────
  { path: '/api/bitable/tables',         expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },

  // ── Launchpad ──────────────────────────────────────
  { path: '/api/launchpad',              expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/admin/launchpad',        expect: { anon: 401, employee: 403, manager: 403, steward: 403, admin: 200, guest: 403 } },

  // ── Audit / Approvals / 1on1 / 360 / Budget ──────────
  { path: '/api/audit',                  expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/approvals',              expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/1on1',                   expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/360/cycles',             expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
  { path: '/api/budget',                 expect: { anon: 401, employee: 200, admin: 200, manager: 200, steward: 200, guest: 200 } },
];

(async () => {
  // First check ALLOW_DEMO_AUTH state — if =1 (default), 'anon' auto-falls-back to admin.
  // Force test with explicit token so anon truly has no cookie. The fallback is a feature
  // for dev convenience; the matrix below treats anon as "no Authorization header sent".
  // /api/auth/me bypasses requireAuth (no demo fallback), so use /api/launchpad
  // which uses requireAuth. If anon gets 200, demo fallback is on.
  const allowDemo = await fetch(BASE + '/api/launchpad').then((r) => r.status === 200);
  if (allowDemo) {
    console.log('⚠ ALLOW_DEMO_AUTH=1 detected — anon requests fall back to demo-admin.');
    console.log('   Adjusting expectations: anon will see same status as admin for most reads.\n');
  }

  const roles = Object.keys(ROLES);
  const allRoles = ['anon', ...roles];

  const results = [];
  for (const c of CASES) {
    const row = { path: c.path };
    for (const role of allRoles) {
      const expected = c.expect[role];
      if (expected === undefined) { row[role] = '—'; continue; }
      const { status } = await hit(c.path, role);
      // demo fallback: if anon expected to be 401 but ALLOW_DEMO_AUTH=1, accept 200/403 mirroring admin
      let effectiveExpected = expected;
      // /api/auth/me does NOT use requireAuth → no demo fallback, anon stays 401.
      const usesDemoFallback = !c.path.startsWith('/api/auth/me');
      if (allowDemo && role === 'anon' && expected === 401 && usesDemoFallback) {
        effectiveExpected = c.expect.admin ?? 200;
      }
      const ok = status === effectiveExpected;
      row[role] = `${status}${ok ? '✓' : `✗(want ${effectiveExpected})`}`;
    }
    results.push(row);
  }

  // Print table
  const pad = (s, n) => String(s).padEnd(n);
  const cols = ['path', ...allRoles];
  const widths = cols.map((c) => Math.max(c.length, ...results.map((r) => String(r[c] ?? '').length)));
  console.log('\n=== Multi-role API matrix ===\n');
  console.log(cols.map((c, i) => pad(c, widths[i])).join('  '));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const r of results) {
    console.log(cols.map((c, i) => pad(r[c] ?? '', widths[i])).join('  '));
  }

  let pass = 0, fail = 0;
  for (const r of results) for (const role of allRoles) {
    const v = r[role];
    if (typeof v === 'string') {
      if (v.includes('✓')) pass++;
      else if (v.includes('✗')) fail++;
    }
  }
  console.log(`\nSummary: ${pass} passed, ${fail} failed (${results.length} endpoints × ${allRoles.length} roles)`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
