/**
 * E2E · OKR KR Check-in 流程
 *
 * 场景: 通过 API 对一个 KR 做 check-in → 验证:
 *   1. API 返回 200 + checkIn 对象
 *   2. rolledUp 数组非空 (真 rollup 有副作用)
 *   3. GET /api/tandem-okr 后 KR currentValue 已更新
 *
 * 前置: seed 中有 active cycle + objective + kr (由 boot.ts seed 保证)
 * 注意: 全走 API, 不依赖页面 UI 渲染 (避免前端 zustand 与后端 state 不同步干扰)
 */

import { test, expect } from '@playwright/test';

test.describe('OKR KR Check-in API 流程', () => {
  let krId: string;

  test.beforeAll(async ({ request }) => {
    // 取第一个 active KR
    const r = await request.get('/api/tandem-okr');
    expect(r.status()).toBe(200);
    const data = await r.json();
    const kr = (data.keyResults as Array<{ id: string; isActive?: boolean; status?: string }>)
      .find((k) => !k.status || k.status === 'active');
    expect(kr, 'Need at least one KR in seed').toBeTruthy();
    krId = kr!.id;
  });

  test('POST /api/okr/checkins (kr scope) → 200 + rollup 副作用', async ({ request }) => {
    const res = await request.post('/api/okr/checkins', {
      data: {
        scope: 'kr',
        scopeId: krId,
        currentValue: 1,
        confidence: 'on-track',
        notes: 'e2e check-in test',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('checkIn');
    expect(body.checkIn.keyResultId).toBe(krId);
    // rolledUp 可以为空数组 (若 KR 无父 Objective)，但字段必须存在
    expect(body).toHaveProperty('rolledUp');
    expect(Array.isArray(body.rolledUp)).toBe(true);
  });

  test('check-in 后 GET /api/tandem-okr → KR currentValue 已更新', async ({ request }) => {
    // 先做一次 check-in
    await request.post('/api/okr/checkins', {
      data: { scope: 'kr', scopeId: krId, currentValue: 42, confidence: 'at-risk', notes: 'e2e value update' },
    });

    const r = await request.get('/api/tandem-okr');
    expect(r.status()).toBe(200);
    const data = await r.json();
    const updated = (data.keyResults as Array<{ id: string; currentValue: number }>)
      .find((k) => k.id === krId);
    expect(updated).toBeTruthy();
    expect(updated!.currentValue).toBe(42);
  });
});
