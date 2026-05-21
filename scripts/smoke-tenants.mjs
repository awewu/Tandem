/**
 * Multi-tenant isolation smoke.
 *
 * Verify: data created by tenant A is NOT visible to a user signed under tenant B.
 *
 * Modules tested: Launchpad (admin) and Notifications (per-user, but tenant-scoped).
 * Strategy:
 *   1. Sign two admin tokens with different tenantId.
 *   2. Tenant A creates a launchpad app + a notification.
 *   3. Tenant B reads /api/admin/launchpad and /api/notifications → must NOT contain A's records.
 *   4. Tenant A re-reads → must contain its own records.
 *   5. Cleanup: delete the launchpad app.
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

const tokA = tk({ sub: 'admin-A', email: 'a@A', roles: ['admin','employee'], tenantId: 'tenant-A', mfa: true, sid: 'sa' });
const tokB = tk({ sub: 'admin-B', email: 'a@B', roles: ['admin','employee'], tenantId: 'tenant-B', mfa: true, sid: 'sb' });

async function call(path, method = 'GET', body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Cookie = `tandem_at=${token}`;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, body: json };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}${detail ? `  :: ${detail}` : ''}`); fail++; }
}

(async () => {
  console.log('\n=== Multi-tenant isolation smoke ===');

  // ── Launchpad ──────────────────────
  console.log('\n[Launchpad]');
  const created = await call('/api/launchpad', 'POST', {
    name: 'Tenant-A-Only',
    url: 'https://tenant-a.example',
    category: 'business',
    description: 'visible only to tenant A',
  }, tokA);
  check('A creates app (201)', created.status === 201, `got ${created.status}`);
  const newId = created.body?.app?.id;

  const adminListB = await call('/api/admin/launchpad', 'GET', undefined, tokB);
  check('B does NOT see A\'s app (admin list)', !adminListB.body?.apps?.some((a) => a.id === newId));

  const adminListA = await call('/api/admin/launchpad', 'GET', undefined, tokA);
  check('A sees own app (admin list)', adminListA.body?.apps?.some((a) => a.id === newId));

  const viewerB = await call('/api/launchpad', 'GET', undefined, tokB);
  check('B viewer list excludes A\'s app', !viewerB.body?.apps?.some((a) => a.id === newId));

  // Cleanup
  if (newId) await call(`/api/launchpad/${newId}`, 'DELETE', undefined, tokA);

  // ── Notifications ──────────────────
  console.log('\n[Notifications]');
  // Create notif under tenant A targeting an A-side user.
  const notif = await call('/api/notifications', 'POST', {
    userId: 'admin-A',
    type: 'system',
    title: 'Tenant-A-private-notif',
    body: 'should NOT leak to tenant B',
  }, tokA);
  check('A creates notif (201)', notif.status === 201, `got ${notif.status}`);

  const notifsA = await call('/api/notifications?userId=admin-A', 'GET', undefined, tokA);
  check('A sees own notif', notifsA.body?.notifications?.some((n) => n.title === 'Tenant-A-private-notif')
                          || notifsA.body?.items?.some((n) => n.title === 'Tenant-A-private-notif'),
        `body keys: ${Object.keys(notifsA.body ?? {}).join(',')}`);

  const notifsBSearchA = await call('/api/notifications?userId=admin-A', 'GET', undefined, tokB);
  // Even targeting userId admin-A, B (different tenant) should not see A's data
  const leak = (notifsBSearchA.body?.notifications ?? notifsBSearchA.body?.items ?? [])
    .some((n) => n.title === 'Tenant-A-private-notif');
  check('B querying A\'s userId does NOT leak A\'s notif', !leak);

  console.log(`\nSummary: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
