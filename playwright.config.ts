/**
 * Playwright config · 4 主流程 e2e
 *
 * 启用步骤:
 *   1. @playwright/test 已加为 devDep
 *   2. 首次运行需安装浏览器: `npx playwright install chromium`
 *   3. 启 dev server (端口 3001 推荐): `npm run dev -- -p 3001`
 *   4. 跑测试: `npm run test:e2e`
 *
 * 设计原则:
 *   - 默认 demo / dev 模式 (ALLOW_DEMO_AUTH=1) — bypass auth
 *   - baseURL 走 env 覆盖, 默认 localhost:3001
 *   - headless on, 失败截图 + trace 到 ./playwright-report
 */

import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

const PORT = process.env.PORT ?? '3005';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const AUTH_FILE = join(__dirname, '.auth', 'admin.json');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // 1) 一次性登录 -> 把 cookie 存到 .auth/admin.json
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts$/,
    },
    // 2) 正式 spec, 复用上面的 storageState
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 800 },
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
    },
  ],
});
