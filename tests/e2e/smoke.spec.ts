/**
 * E2E Smoke · 4 主流程页面冒烟
 *
 * 假设:
 *   - dev server 已启 (ALLOW_DEMO_AUTH=1, demo 模式)
 *   - DATABASE_URL 已通 (或 InMemory)
 *
 * 范围: 页面 200 + 主交互可见, 不做完整业务断言 (那由 vitest + scripts/e2e-v1.ps1 覆盖).
 */

import { test, expect } from '@playwright/test';

test.describe('Tandem · Smoke 4 flows', () => {
  test('① Home 加载, 工作台 4 卡 + Launchpad 渲染', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /我的工作台/ })).toBeVisible();
    await expect(page.getByText(/议事室决议/)).toBeVisible();
    await expect(page.getByText(/快速跳板/)).toBeVisible();
  });

  test('② Convergence 列表页可加载, 发起按钮可见', async ({ page }) => {
    await page.goto('/convergence');
    // 标题或主要按钮之一可见
    const initBtn = page.getByRole('button', { name: /发起议事|新建议事/ }).first();
    const heading = page.getByRole('heading').first();
    await expect(initBtn.or(heading)).toBeVisible();
  });

  test('③ OKR 页可加载, KR 树或空态出现', async ({ page }) => {
    await page.goto('/okr');
    // 任一关键文本可见
    const okr = page.getByText(/Objective|KR|关键结果|目标/).first();
    await expect(okr).toBeVisible();
  });

  test('④ 9-box 页可加载, 坐标系 cells 可见', async ({ page }) => {
    await page.goto('/nine-box');
    // 9-box 页应显示至少一个 cell 标签 (star/core/must_intervene 等中文映射)
    const anyCell = page.getByText(/明星|核心|必须干预|高潜|风险|九宫|9-?box/i).first();
    await expect(anyCell).toBeVisible({ timeout: 10_000 });
  });

  test('⑤ 1on1 页可加载, 列表或新建按钮出现', async ({ page }) => {
    await page.goto('/1on1');
    const title = page.getByText(/1on1 对话|主管.*员工/).first();
    await expect(title).toBeVisible();
  });

  test('⑥ Memories 公司 Memory tab 加载真后端', async ({ page }) => {
    await page.goto('/memories');
    await expect(page.getByRole('tab', { name: /公司 Memory/ })).toBeVisible();
    // 默认 tab = 公司 Memory, 应显示 banner 或类型计数
    await expect(page.getByText(/SOP|案例|红线|价值观/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('⑦ Admin 员工组织真接 /api/org/users', async ({ page }) => {
    await page.goto('/admin/organization');
    await expect(page.getByRole('heading', { name: /员工组织/ })).toBeVisible();
    // 至少 demo seed 用户列表会出现
    await expect(page.getByText(/demo@tandem.local|我 \(Demo\)|Demo/).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Tandem · API smoke', () => {
  test('GET /api/health → 200', async ({ request }) => {
    const r = await request.get('/api/health');
    expect(r.status()).toBe(200);
  });

  test('GET /api/nine-box → 200 + people array', async ({ request }) => {
    const r = await request.get('/api/nine-box');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j).toHaveProperty('people');
    expect(Array.isArray(j.people)).toBeTruthy();
  });

  test('GET /api/tandem/memory/list → 200 + memories array', async ({ request }) => {
    const r = await request.get('/api/tandem/memory/list?limit=5');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j).toHaveProperty('memories');
  });

  test('GET /api/org/users → 200 + users array', async ({ request }) => {
    const r = await request.get('/api/org/users');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j).toHaveProperty('users');
  });
});
