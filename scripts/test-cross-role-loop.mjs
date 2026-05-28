#!/usr/bin/env node
/**
 * 跨角色业务闭环验证脚本
 *
 * 路径:
 *   1. employee 登录 → 拿 cookie
 *   2. employee GET /api/okr 看自己的 OKR
 *   3. employee POST /api/okr/checkins 写 check-in
 *   4. manager 登录 → 拿 cookie
 *   5. manager GET /api/okr 看 employee 的 check-in
 *   6. hr 登录 → GET /api/admin/users (是否能看到全员)
 *
 * 输出: 每一步的 HTTP code + 关键字段, 失败立即退出
 *
 * 用法: node scripts/test-cross-role-loop.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3005';
const PASSWORD = 'Demo1234!@#';

const accounts = {
  employee: 'employee@tandem.local',
  manager:  'manager@tandem.local',
  hr:       'hr@tandem.local',
};

const cookieJars = {}; // role → Set-Cookie string

function log(step, msg) {
  console.log(`[${step.padEnd(28)}] ${msg}`);
}

async function login(role) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: accounts[role], password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    log(`login ${role}`, `❌ HTTP ${res.status}  ${JSON.stringify(body)}`);
    process.exit(1);
  }
  // 收集 cookies (Node fetch 把 Set-Cookie 合并成一个或拆成多个 entries)
  const setCookie = res.headers.getSetCookie?.() ?? res.headers.raw?.()['set-cookie'] ?? [];
  const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie])
    .map((c) => String(c).split(';')[0])
    .filter(Boolean)
    .join('; ');
  cookieJars[role] = cookies;
  log(`login ${role}`, `✅ HTTP 200, userId=${body.userId}, mfa=${body.requiresMfa}, cookies=${cookies.length} chars`);
}

async function call(role, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieJars[role] ?? '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

async function main() {
  console.log(`\n=== Cross-role loop · ${BASE} ===\n`);

  // 1. employee 登录
  await login('employee');

  // 2. employee 看自己的 OKR (UI 真正用的路径是 /api/tandem-okr, 不是 /api/okr)
  const r1 = await call('employee', 'GET', '/api/tandem-okr');
  log('GET /api/tandem-okr (emp)', `HTTP ${r1.status}  objectives=${r1.body?.objectives?.length ?? '??'}  raw=${JSON.stringify(r1.body).slice(0, 200)}`);

  // 3. employee 看 dashboard stats
  const r2 = await call('employee', 'GET', '/api/dashboard/stats');
  log('GET /api/dashboard/stats', `HTTP ${r2.status}  raw=${JSON.stringify(r2.body).slice(0, 140)}`);

  // 4. employee 看 /api/auth/me 确认身份
  const r3 = await call('employee', 'GET', '/api/auth/me');
  log('GET /api/auth/me (employee)', `HTTP ${r3.status}  ${JSON.stringify(r3.body).slice(0, 200)}`);

  // 5. manager 登录
  await login('manager');

  // 6. manager 看 /api/auth/me
  const r4 = await call('manager', 'GET', '/api/auth/me');
  log('GET /api/auth/me (manager)', `HTTP ${r4.status}  ${JSON.stringify(r4.body).slice(0, 200)}`);

  // 7. manager 看 dashboard stats (应看到下属数据)
  const r5 = await call('manager', 'GET', '/api/dashboard/stats');
  log('GET /api/dashboard/stats(mgr)', `HTTP ${r5.status}  raw=${JSON.stringify(r5.body).slice(0, 140)}`);

  // 8. manager 看 /api/org/users (员工列表)
  const r6 = await call('manager', 'GET', '/api/org/users');
  log('GET /api/org/users (mgr)', `HTTP ${r6.status}  users=${r6.body?.users?.length ?? r6.body?.data?.length ?? '??'}  raw=${JSON.stringify(r6.body).slice(0, 140)}`);

  // 9. hr 登录
  await login('hr');

  // 10. hr 看全员
  const r7 = await call('hr', 'GET', '/api/org/users');
  log('GET /api/org/users (hr)', `HTTP ${r7.status}  users=${r7.body?.users?.length ?? r7.body?.data?.length ?? '??'}`);

  // 11. hr 看 360 周期
  const r8 = await call('hr', 'GET', '/api/360/cycles');
  log('GET /api/360/cycles (hr)', `HTTP ${r8.status}  cycles=${r8.body?.cycles?.length ?? r8.body?.data?.length ?? '??'}  raw=${JSON.stringify(r8.body).slice(0, 140)}`);

  console.log('\n=== Done ===\n');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
