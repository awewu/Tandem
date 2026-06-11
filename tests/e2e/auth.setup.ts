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
  // 默认走 admin 账号 (恒热 Everhot CEO 何恒, owner+admin, 由 showcase seed 创建).
  // 为何用 admin 而非 manager:
  //   - smoke 覆盖 /admin/organization 等 admin 页面
  //   - B-027 价值观锚写入受 MANIFESTO §15 约束 (仅本人/admin), 而 demo 工作台
  //     固定操作 persona id 'me'/'demo-user' — 非 admin 的真实登录会被 403.
  //   admin 是这些操作的合法身份, 能让全部 smoke 在真鉴权 (非 demo bypass) 下通过.
  const email = process.env.E2E_LOGIN_EMAIL ?? 'heheng@everhot.com.cn';
  const password = process.env.E2E_LOGIN_PASSWORD ?? 'Everhot@2026';

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
