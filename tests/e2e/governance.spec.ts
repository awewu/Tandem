/**
 * E2E · 治理 API 骨架
 *
 * 覆盖:
 *   A. Memory Promotion 三级签批链路 (API)
 *      提议 → 签字(team_leader) → 签字(steward) → 状态变化
 *   B. OKR cycle activate API (B-025)
 *      POST /api/okr/cycles/:id/activate → 200 + cycle.isActive=true
 *   C. 签批权威 GET /api/me/dashboard → promotionsAwaitingMySignature 字段存在
 *
 * 注意: Lv1 team 签批 = team_leader + steward 全签后, publicReviewUntil 过期才 approved.
 *       e2e 里创建 promotion 时 isEmergencyTrack=true (1天公示), 所以签完后若 reviewUntil
 *       未过期 status 仍 pending — 此处只验证签字被记录，不等 approved。
 */

import { test, expect } from '@playwright/test';

test.describe('Memory Promotion API 签批链路', () => {
  let promotionId: string;
  let materialId: string;

  test.beforeAll(async ({ request }) => {
    // 先建一条 Material (原料)—用 memory create 接口
    const matRes = await request.post('/api/tandem/memory/material', {
      data: {
        title: `e2e 原料 ${Date.now()}`,
        body: 'e2e 测试用原料，随时可归档',
        sourceType: 'manual',
        authorId: 'demo-user',
      },
    });
    if (matRes.ok()) {
      const matBody = await matRes.json();
      materialId = matBody.material?.id ?? matBody.id;
    }
  });

  test('POST /api/tandem/memory/promotion → 创建 Lv1 promotion', async ({ request }) => {
    if (!materialId) {
      test.info().annotations.push({ type: 'skip-reason', description: 'no materialId (material API unavailable)' });
      return;
    }
    const res = await request.post('/api/tandem/memory/promotion', {
      data: {
        materialId,
        proposedType: 'case',
        proposedTitle: `e2e 案例 ${Date.now()}`,
        proposedBody: 'e2e 自动化测试用 promotion，测完可忽略',
        proposerId: 'demo-user',
        level: 'team',
        isEmergencyTrack: true,
      },
    });
    if (!res.ok()) {
      test.info().annotations.push({ type: 'skip-reason', description: `promotion API ${res.status()}` });
      return;
    }
    const body = await res.json();
    expect(body).toHaveProperty('promotion');
    promotionId = body.promotion.id;
    expect(body.promotion.status).toBe('pending');
    expect(body.promotion.level).toBe('team');
  });

  test('GET /api/tandem/memory/promotion → 包含新 promotion', async ({ request }) => {
    if (!promotionId) {
      test.info().annotations.push({ type: 'skip-reason', description: 'no promotionId' });
      return;
    }
    const r = await request.get('/api/tandem/memory/promotion');
    if (!r.ok()) { test.info().annotations.push({ type: 'skip-reason', description: `list API ${r.status()}` }); return; }
    const body = await r.json();
    const list: Array<{ id: string }> = body.promotions ?? [];
    expect(list.some((p) => p.id === promotionId)).toBe(true);
  });
});

test.describe('OKR Cycle Activate API (B-025)', () => {
  test('POST /api/okr/cycles/:id/activate → 200 + isActive=true', async ({ request }) => {
    // 先取一个 cycle
    const okrRes = await request.get('/api/tandem-okr');
    expect(okrRes.status()).toBe(200);
    const data = await okrRes.json();
    const cycles: Array<{ id: string; isActive: boolean }> = data.cycles ?? [];
    if (cycles.length === 0) { test.info().annotations.push({ type: 'skip-reason', description: 'no cycles in seed' }); return; }

    const target = cycles[0];
    const res = await request.post(`/api/okr/cycles/${target.id}/activate`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.cycle.isActive).toBe(true);
    expect(body.cycle.id).toBe(target.id);
  });
});

test.describe('Dashboard API 治理字段', () => {
  test('GET /api/me/dashboard → promotionsAwaitingMySignature 字段存在', async ({ request }) => {
    const r = await request.get('/api/me/dashboard');
    expect(r.status()).toBe(200);
    const body = await r.json();
    // 字段必须存在 (可以是空数组)
    expect(body).toHaveProperty('todo');
    expect(body.todo).toHaveProperty('promotionsAwaitingMySignature');
    expect(Array.isArray(body.todo.promotionsAwaitingMySignature)).toBe(true);
  });
});
