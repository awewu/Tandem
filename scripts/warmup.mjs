/**
 * Warm-up — fire routes once so Next dev compiles + caches them.
 * Run while dev server is on http://localhost:3005.
 *
 * Usage:  node scripts/warmup.mjs
 *         node scripts/warmup.mjs --full
 */

import { createReadStream, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createInterface } from 'node:readline';

const BASE = process.env.BASE ?? process.env.PREWARM_BASE_URL ?? 'http://127.0.0.1:3005';
const CONCURRENCY = Number(process.env.WARMUP_CONCURRENCY ?? 2);
const PER_REQ_TIMEOUT_MS = 90_000;
const MODE = process.argv.includes('--full')
  ? 'full'
  : process.argv.includes('--critical')
    ? 'critical'
    : (process.env.WARMUP_MODE ?? 'critical');

async function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  const rl = createInterface({ input: createReadStream('.env.local'), crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
}

function cookieHeader(setCookies) {
  return setCookies
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function b64u(value) {
  return Buffer.from(value).toString('base64url');
}

function sessionSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret === 'change-me-in-prod-use-openssl-rand-base64-32') {
    return 'dev-only-secret-do-not-use-in-prod';
  }
  return secret;
}

function syntheticWarmupCookie() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: process.env.WARMUP_USER_ID ?? 'demo-user',
    email: process.env.WARMUP_EMAIL ?? 'demo@tandem.local',
    roles: (process.env.WARMUP_ROLES ?? 'owner,admin,champion,steward,manager,employee')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
    tenantId: process.env.WARMUP_TENANT_ID ?? 'default',
    mfa: true,
    sid: `warmup_${now}`,
    iat: now,
    exp: now + 15 * 60,
  };
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', sessionSecret()).update(`${header}.${body}`).digest('base64url');
  return `tandem_at=${header}.${body}.${sig}`;
}

async function loginCookie() {
  await loadEnvLocal();
  const email = process.env.WARMUP_EMAIL ?? process.env.TANDEM_BOOTSTRAP_OWNER_EMAIL;
  const password = process.env.WARMUP_PASSWORD ?? process.env.TANDEM_BOOTSTRAP_OWNER_PASSWORD;
  if (!email || !password) {
    console.log('Warmup auth: skipped (WARMUP_EMAIL/PASSWORD or TANDEM_BOOTSTRAP_OWNER_* not set)');
    return '';
  }
  try {
    const r = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tandem-client': 'desktop' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    });
    const getSetCookie = r.headers.getSetCookie?.bind(r.headers);
    const setCookies = getSetCookie ? getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
    const cookies = cookieHeader(setCookies);
    if (!r.ok || !cookies) {
      console.log(`Warmup auth: login did not yield cookies (HTTP ${r.status}); using local signed warmup cookie`);
      return syntheticWarmupCookie();
    }
    console.log(`Warmup auth: logged in as ${email}`);
    return cookies;
  } catch (err) {
    console.log(`Warmup auth: failed (${err instanceof Error ? err.message : 'unknown'}); using local signed warmup cookie`);
    return syntheticWarmupCookie();
  }
}

// Critical first-paint routes: quick enough to run automatically on dev start.
const CRITICAL_ROUTES = [
  '/', '/login',
  '/okr', '/okr/cascade',
  '/kpi', '/tti',
  '/im',
  '/api/health',
  '/api/dashboard/stats',
  '/api/launchpad',
  '/api/notifications/badge',
  '/api/tandem-okr',
  '/api/im/channels',
];

// All app pages + key API endpoints used on first paint.
const FULL_ROUTES = [
  ...CRITICAL_ROUTES,
  // Pages
  '/okr/calendar', '/okr/dashboard',
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
  '/register',
  // API (commonly hit on first navigation)
  '/api/mail/status',
  '/api/convergence',
  '/api/1on1',
  '/api/360/cycles',
  { path: '/api/internal/api-log-ingest', method: 'POST', body: '{}' },
];

const ROUTES = MODE === 'full' ? FULL_ROUTES : CRITICAL_ROUTES;

async function hit(route, cookies = '') {
  const item = typeof route === 'string' ? { path: route, method: 'GET' } : route;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_REQ_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const headers = {
      ...(item.body ? { 'content-type': 'application/json' } : {}),
      ...(cookies ? { cookie: cookies } : {}),
    };
    const r = await fetch(BASE + item.path, {
      method: item.method ?? 'GET',
      body: item.body,
      signal: ctrl.signal,
      redirect: 'manual',
      headers,
    });
    return { path: item.path, method: item.method ?? 'GET', status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { path: item.path, method: item.method ?? 'GET', status: 0, err: e.message, ms: Date.now() - t0 };
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
      console.log(`  ${tag}  ${String(r.status).padStart(3)}  ${String(r.ms).padStart(6)}ms  ${r.method.padEnd(4)} ${r.path}`);
    }
  });
  await Promise.all(workers);
  return results;
}

const cookies = await loginCookie();

console.log(`Warming up ${ROUTES.length} ${MODE} routes against ${BASE} (concurrency=${CONCURRENCY}) ...`);
const t0 = Date.now();
const results = await pool(ROUTES, CONCURRENCY, (route) => hit(route, cookies));
const ok = results.filter((r) => r.status >= 200 && r.status < 400).length;
const slow = results.filter((r) => r.ms > 5000).length;
const max = Math.max(...results.map((r) => r.ms));
console.log(`\nDone in ${Math.round((Date.now() - t0) / 1000)}s.  ${ok}/${ROUTES.length} OK · ${slow} took >5s · max ${max}ms`);

// Second round — should be HOT now
console.log('\nSecond pass (should be hot) ...');
const t1 = Date.now();
const r2 = await pool(ROUTES, CONCURRENCY, (route) => hit(route, cookies));
const max2 = Math.max(...r2.map((r) => r.ms));
const avg2 = Math.round(r2.reduce((a, b) => a + b.ms, 0) / r2.length);
console.log(`\nHot: avg=${avg2}ms · max=${max2}ms · total ${Math.round((Date.now() - t1) / 1000)}s`);
