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
    // 直接断言 /convergence 的核心 CTA: "发起议事 (17 min)"
    await expect(page.getByRole('button', { name: /发起议事/ })).toBeVisible();
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

  test('⑥ 组织记忆 tab 加载真后端', async ({ page }) => {
    await page.goto('/memories');
    await expect(page.getByRole('tab', { name: /组织记忆/ })).toBeVisible();
    // 默认 tab = 组织记忆, 应显示 banner 或类型计数
    await expect(page.getByText(/SOP|案例|红线|价值观/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('⑦ Admin 员工组织真接 /api/org/users', async ({ page }) => {
    await page.goto('/admin/organization');
    await expect(page.getByRole('heading', { name: /员工组织/ })).toBeVisible();
    // 等用户列表 client fetch (/api/org/users) 落定再断言.
    await page.waitForLoadState('networkidle');
    // 至少 seed 用户列表会出现; 取可见匹配 (避开 nav 头像里的同名隐藏元素).
    await expect(
      page.getByText(/demo@tandem.local|我 \(Demo\)|Demo/).and(page.locator(':visible')).first(),
    ).toBeVisible({ timeout: 10_000 });
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

  test('B-027 价值观锚 API: POST 加规则 → GET 可见 → DELETE 归档', async ({ request }) => {
    const userId = 'demo-user';
    const base = `/api/persona/${userId}/constitution`;
    const text = `e2e 临时原则 ${Date.now()}`;

    // POST 加一条
    const post = await request.post(base, { data: { text } });
    expect(post.status()).toBe(200);
    const created = await post.json();
    const rule = created.constitution?.rules?.find((r: { text: string }) => r.text === text);
    expect(rule).toBeTruthy();

    // GET 应含该 active 规则
    const get = await request.get(base);
    expect(get.status()).toBe(200);
    const got = await get.json();
    expect(
      got.constitution.rules.some(
        (r: { id: string; archivedAt?: string }) => r.id === rule.id && !r.archivedAt,
      ),
    ).toBeTruthy();

    // DELETE 归档 (软删) — 清理 e2e 残留
    const del = await request.delete(`${base}?ruleId=${rule.id}&reason=e2e-cleanup`);
    expect(del.status()).toBe(200);
    const after = await del.json();
    expect(
      after.constitution.rules.find((r: { id: string }) => r.id === rule.id)?.archivedAt,
    ).toBeTruthy();
  });
});

test.describe('B-027 · 价值观锚 UI 流程', () => {
  test('训练台增删价值观锚: 添加可见 → 归档移除', async ({ page }) => {
    await page.goto('/persona/training');

    // 卡片标题可见
    await expect(page.getByRole('heading', { name: /价值观锚/ })).toBeVisible({ timeout: 10_000 });

    // 等首屏 client fetch (constitution GET + 养料 context) 落定 — 确保 React 已
    // hydration 再交互. 否则 fill/Enter 会打到 hydration 前的 SSR DOM 上, 受控
    // input 捕获不到值 (hydration 后被重置为空) → 规则加不进去, 测试假性失败.
    await page.waitForLoadState('networkidle');

    const text = `e2e UI 原则 ${Date.now()}`;
    const input = page.getByPlaceholder(/不可妥协原则|已达上限/);
    await expect(input).toBeEditable();
    await input.fill(text);
    // 断言受控 input 已捕获该值 (hydration 完成的确证), 再触发提交.
    await expect(input).toHaveValue(text);
    await input.press('Enter');

    // 新规则出现在列表
    const ruleItem = page.getByText(text, { exact: false });
    await expect(ruleItem).toBeVisible({ timeout: 10_000 });

    // 归档 (确认弹窗自动接受) — 清理残留
    page.on('dialog', (d) => d.accept());
    await page
      .locator('li', { hasText: text })
      .getByTitle('归档此原则')
      .click();

    // 规则从 active 列表消失
    await expect(ruleItem).toHaveCount(0, { timeout: 10_000 });
  });
});
