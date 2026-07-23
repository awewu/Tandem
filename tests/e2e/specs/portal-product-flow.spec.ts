import { test, expect } from '@playwright/test';

/**
 * E2E 烟测：统一门户 → 产品目录底座 → 返回门户
 * 前置：./scripts/dev-start-all.sh 已启动所有服务
 */

test('portal -> product-catalog -> return-to-portal flow', async ({ page }) => {
  // 1. 登录页
  await page.goto('http://localhost:4000/?returnUrl=/hub');
  await page.locator('input[type="text"]').fill('13900000000');
  await page.locator('input[type="password"]').fill('Super@2026');
  await page.locator('button:has-text("登录")').click();

  // 2. 进入统一门户
  await page.waitForURL('http://localhost:4000/hub', { timeout: 10000 });
  await expect(page.getByRole('heading', { name: '组团一 · 品牌厂家功能组' })).toBeVisible();

  // 3. 点击"产品目录"卡片进入底座
  const productCard = page.locator('a[href*="4016"]').first();
  await expect(productCard).toBeVisible({ timeout: 5000 });
  await productCard.click();

  // 4. 产品目录底座页面
  await page.waitForURL(/:4016\/$/, { timeout: 10000 });
  await expect(page.locator('text=产品目录').first()).toBeVisible();
  await expect(page.locator('text=瑞美变频风冷热泵').or(page.locator('text=瑞美空气能热水器')).first()).toBeVisible();

  // 5. 返回门户按钮
  const returnBtn = page.locator('a:has-text("返回门户")');
  await expect(returnBtn).toBeVisible({ timeout: 5000 });
  await returnBtn.click();

  // 6. 回到门户
  await page.waitForURL('http://localhost:4000/hub', { timeout: 10000 });
  await expect(page.locator('text=产品目录').first()).toBeVisible();
});
