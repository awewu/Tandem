/**
 * 补种瑞合瑞德绩效数据层 (KPI / TTI / 360), 点亮 6 大功能。
 * 前置: 已跑过 import-ruihe.mjs --commit, 且 dev server 在 3000。
 *
 *   node scripts/seed-ruihe-perf.mjs
 */
const BASE = process.env.BASE || 'http://localhost:3000';
await fetch(`${BASE}/api/health`).catch(() => {});
const lr = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'e00001@ruihe.local', password: 'Ruihe@2026' }),
});
if (lr.status !== 200) { console.error('login failed', lr.status, await lr.text()); process.exit(1); }
const cookie = (lr.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/).map((s) => s.split(';')[0].trim()).join('; ');
console.log('✓ 登录 owner');
const r = await fetch(`${BASE}/api/admin/seed-ruihe`, { method: 'POST', headers: { cookie } });
const j = await r.json();
console.log('seed-ruihe:', r.status);
console.log(JSON.stringify(j, null, 2));
