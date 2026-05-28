/**
 * Mobile responsive smoke · 验证手机端核心页面能否 render + 关键元素可见.
 *
 * Viewports:
 *   - iPhone SE   (375 × 667)   最严苛: Apple 最小现役屏幕
 *   - iPhone 14   (390 × 844)   主流
 *   - iPad mini   (768 × 1024)  平板
 *
 * 失败 = 当前 shell 布局对该 viewport 不友好.
 * 通过 = 至少核心内容可见, 用户能完成基本任务.
 */

import { test, expect, devices } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iPhone-SE', viewport: { width: 375, height: 667 } },
  { name: 'iPhone-14', viewport: { width: 390, height: 844 } },
  { name: 'iPad-mini', viewport: { width: 768, height: 1024 } },
];

const PAGES = [
  { path: '/',                       must: /我的工作台/ },
  { path: '/okr',                    must: /Objective|KR|关键结果|目标/ },
  { path: '/convergence',            must: /发起议事/ },
  { path: '/persona/training',       must: /分身训练|养料|训练/ },
  { path: '/kpi',                    must: /绩效|KPI|对账/ },
  { path: '/1on1',                   must: /1on1|对话|主管/ },
];

for (const vp of VIEWPORTS) {
  test.describe(`Mobile · ${vp.name} (${vp.viewport.width}×${vp.viewport.height})`, () => {
    test.use({ viewport: vp.viewport });

    for (const p of PAGES) {
      test(`${p.path} 能渲染关键内容`, async ({ page }) => {
        await page.goto(p.path);
        // 不期待完美布局, 只要核心文本能 visible (即没被裁/覆盖)
        await expect(page.getByText(p.must).first()).toBeVisible({ timeout: 8000 });

        // 额外检查: 页面没出现 React Error boundary 兜底
        const errorBanner = page.getByText(/出错了|something went wrong|application error/i);
        await expect(errorBanner).toHaveCount(0);
      });
    }
  });
}
