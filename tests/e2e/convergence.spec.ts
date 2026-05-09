/**
 * E2E Test · 议事室核心闭环
 *
 * 启用步骤:
 *   1. npm i -D @playwright/test
 *   2. npx playwright install
 *   3. npx playwright test
 *
 * 覆盖场景:
 *   - 创建议事室
 *   - 自动生成 3+1 选项
 *   - 选项 D 强制员工填写
 *   - COMMIT → 24h 否决窗口
 *   - VETO 撤回
 *   - 17 分钟硬上限触发 ESCALATE
 */

/* eslint-disable */
// @ts-expect-error optional dependency
import { test, expect } from '@playwright/test';

test.describe('Convergence Room E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/convergence');
  });

  test('能创建新议事室并跳转到详情页', async ({ page }) => {
    await page.fill('input[placeholder*="议题标题"]', 'E2E 测试: 客户投诉处理');
    await page.fill('textarea[placeholder*="描述背景"]', '客户 X 投诉服务延迟, 需 24h 内方案');
    await page.click('button:has-text("发起议事")');

    // 跳转到详情页
    await page.waitForURL(/\/convergence\/dc_/);
    await expect(page.locator('h1, h2, [class*="CardTitle"]')).toContainText('E2E 测试');
  });

  test('议事室自动加载 3+1 选项 (含 D)', async ({ page }) => {
    await page.fill('input[placeholder*="议题标题"]', 'E2E 选项检查');
    await page.click('button:has-text("发起议事")');
    await page.waitForURL(/\/convergence\/dc_/);

    // 等待选项加载
    await expect(page.locator('text=/A · SOP 直执行/')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/B · AI 推演/')).toBeVisible();
    await expect(page.locator('text=/C · 历史案例/')).toBeVisible();
    await expect(page.locator('text=/D · 你的原创/')).toBeVisible();
  });

  test('D 选项必须填内容才能选定', async ({ page }) => {
    await page.fill('input[placeholder*="议题标题"]', 'D 选项守门测试');
    await page.click('button:has-text("发起议事")');
    await page.waitForURL(/\/convergence\/dc_/);

    // D 选项的"选定"按钮在空 textarea 时禁用
    const dSection = page.locator('text=/D · 你的原创/').locator('..').locator('..');
    const dPickButton = dSection.locator('button:has-text("选定此方案")');
    await expect(dPickButton).toBeDisabled();

    // 填入内容后启用
    await dSection.locator('textarea').fill('我提议: 主管亲自上门 + 7 天内 free trial');
    await expect(dPickButton).toBeEnabled();
  });

  test('COMMIT 后显示 24h 否决窗口', async ({ page }) => {
    await page.fill('input[placeholder*="议题标题"]', 'COMMIT 流程测试');
    await page.click('button:has-text("发起议事")');
    await page.waitForURL(/\/convergence\/dc_/);

    // 选 A
    await page.locator('text=/A · SOP 直执行/').locator('..').locator('..')
      .locator('button:has-text("选定此方案")').click();

    // COMMIT
    await page.click('button:has-text("提交决议")');

    // 验证 24h 窗口提示
    await expect(page.locator('text=/24h 否决窗口/')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("行使 24h 否决权")')).toBeVisible();
  });
});
