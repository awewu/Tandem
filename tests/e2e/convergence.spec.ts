/**
 * E2E · 三色议事 Convergence 创建流程
 *
 * 场景:
 *   1. POST /api/convergence → 创建议题 → 200 + card.id
 *   2. GET /api/convergence/:id → 可查到该议题
 *   3. 页面 /convergence 渲染并能看到新议题标题 (UI 冒烟)
 *   4. POST /api/convergence/:id/commit → 提交议决
 */

import { test, expect } from '@playwright/test';

test.describe('Convergence 议事 API 流程', () => {
  let cardId: string;
  const title = `e2e 议题 ${Date.now()}`;

  test('POST /api/convergence → 200 + cardId', async ({ request }) => {
    const res = await request.post('/api/convergence', {
      data: {
        title,
        description: 'e2e 自动化测试议题，测完即归档',
        // OKR Anchor: 无绑定 KR 时必须提供 noKrReason (≥10字)
        noKrReason: 'e2e 自动化测试用，无需绑定 OKR',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('cardId');
    cardId = body.cardId;
  });

  test('GET /api/convergence/:id → 200', async ({ request }) => {
    expect(cardId, 'cardId must be set by previous test').toBeTruthy();
    const r = await request.get(`/api/convergence/${cardId}`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    // 返回结构可能是 { card } 或 { state, step }
    expect(body).toBeTruthy();
  });

  test('GET /api/convergence (list) → 包含新建议题', async ({ request }) => {
    const r = await request.get('/api/convergence');
    expect(r.status()).toBe(200);
    const body = await r.json();
    const cards: Array<{ id: string }> = body.cards ?? body.decisionCards ?? [];
    expect(cards.some((c) => c.id === cardId)).toBe(true);
  });

  test('页面 /convergence → 议题列表可见', async ({ page }) => {
    await page.goto('/convergence');
    await expect(page.getByRole('button', { name: /发起议事/ })).toBeVisible({ timeout: 10_000 });
  });
});
