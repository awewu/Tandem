/**
 * Playwright auth setup · 在主测试运行前先用 admin@tandem.local 登录拿到 cookie,
 * 把 storage state 写到 .auth/admin.json. 后续 spec 用 storageState 直接复用,
 * 不再被 middleware 重定向到 /login.
 *
 * 由 playwright.config.ts 的 setup project + dependencies 引用.
 */

import { test as setup, expect } from '@playwright/test';
import { join } from 'node:path';

const AUTH_FILE = join(__dirname, '..', '..', '.auth', 'admin.json');

setup('authenticate as demo user', async ({ page }) => {
  // 默认走 employee 测试账号 (由 scripts/seed-demo-users.mjs 创建).
  // 任一存在的账号都行 — middleware 只检查"有 cookie", 不区分角色.
  const email = process.env.E2E_LOGIN_EMAIL ?? 'manager@tandem.local';
  const password = process.env.E2E_LOGIN_PASSWORD ?? 'Demo1234!@#';

  // 用 page.request 保证 cookie 落入同一个 browser context,
  // 之后 storageState 才能正确捕获到登录态.
  const res = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.ok(), `login should succeed, got ${res.status()}: ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);

  await page.context().storageState({ path: AUTH_FILE });
});
