/**
 * Warm-up — fire every route once so Next dev compiles + caches them.
 * Run while dev server is on http://localhost:3001.
 *
 * Usage:  node scripts/warmup.mjs
 */

const BASE = process.env.BASE ?? 'http://127.0.0.1:3001';
const CONCURRENCY = 6;
const PER_REQ_TIMEOUT_MS = 90_000;

// All app pages + key API endpoints used on first paint.
const ROUTES = [
  // Pages
  '/',
  '/okr', '/okr/cascade', '/okr/calendar', '/okr/dashboard',
  '/im',
  '/mail',
  '/settings/email',
  '/intranet',
  '/persona', '/persona/evolution',
  '/knowledge', '/memories', '/skills', '/skills/learning', '/agents',
  '/calendar', '/report', '/tasks', '/notifications', '/search',
  '/settings', '/settings/privacy',
  '/convergence', '/decision-card',
  '/design', '/chat', '/workflows', '/logs', '/mcp', '/insights',
  '/1on1', '/360', '/nine-box', '/approvals', '/bitable',
  '/documents', '/drive', '/analytics', '/meetings',
  '/admin/baseline', '/admin/intranet', '/admin/invite',
  '/admin/launchpad', '/admin/skills', '/admin/steward', '/admin/tandem-skills',
  '/login', '/register',
  // API (commonly hit on first navigation)
  '/api/health',
  '/api/dashboard/stats',
  '/api/launchpad',
  '/api/notifications/badge',
  '/api/mail/status',
  '/api/tandem-okr',
  '/api/convergence',
  '/api/1on1',
  '/api/360/cycles',
  '/api/im/channels',
];

async function hit(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_REQ_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + path, { signal: ctrl.signal, redirect: 'manual' });
    return { path, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { path, status: 0, err: e.message, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function pool(items, limit, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      const r = await fn(items[idx]);
      results[idx] = r;
      const tag = r.status >= 200 && r.status < 400 ? '✓' : (r.status === 0 ? '✗' : '·');
      console.log(`  ${tag}  ${String(r.status).padStart(3)}  ${String(r.ms).padStart(6)}ms  ${r.path}`);
    }
  });
  await Promise.all(workers);
  return results;
}

console.log(`Warming up ${ROUTES.length} routes against ${BASE} (concurrency=${CONCURRENCY}) ...`);
const t0 = Date.now();
const results = await pool(ROUTES, CONCURRENCY, hit);
const ok = results.filter((r) => r.status >= 200 && r.status < 400).length;
const slow = results.filter((r) => r.ms > 5000).length;
const max = Math.max(...results.map((r) => r.ms));
console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)}s.  ${ok}/${ROUTES.length} OK · ${slow} took >5s · max ${max}ms`);

// Second round — should be HOT now
console.log('\nSecond pass (should be hot) ...');
const t1 = Date.now();
const r2 = await pool(ROUTES, CONCURRENCY, hit);
const max2 = Math.max(...r2.map((r) => r.ms));
const avg2 = Math.round(r2.reduce((a, b) => a + b.ms, 0) / r2.length);
console.log(`\nHot: avg=${avg2}ms · max=${max2}ms · total ${Math.round((Date.now() - t1) / 1000)}s`);
