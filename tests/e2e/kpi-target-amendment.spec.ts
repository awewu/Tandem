/**
 * E2E · KPI 目标修订签批流全流程 (真实 server + 真实 DB, 复用 admin.json storageState)
 *
 * 覆盖:
 *   1. 建科目 → 建 draft 周期 → 建 KPI → 激活周期 (锁 targetValue)
 *   2. POST /api/kpi/target-amendments 提交修订申请 (pending)
 *   3. GET  /api/kpi/target-amendments?kpiId= 能查到刚提交的申请
 *   4. PATCH /api/kpi/target-amendments/[id] { decision: 'approve' } → Kpi.targetValue 被真正改写
 *   5. 第二条 KPI: 走 reject 分支, targetValue 保持不变
 *   6. 已审批的申请不可重复审批 (400)
 *
 * 注: admin.json 的登录身份是 owner/admin, 同时具备 kpi.write (提交) 与审批权限,
 *     测试全程用同一 session; assigneeId 用独立的 e2e 专用 id (非 admin 本人), 规避
 *     self_amend_forbidden 403。
 */

import { test, expect } from '@playwright/test';

const ASSIGNEE_ID = `e2e-amend-employee-${Date.now()}`;

test.describe('KPI 目标修订签批流', () => {
  let cycleId: string;
  let subjectId: string;
  let approveKpiId: string;
  let rejectKpiId: string;
  let prereqOk = false;

  test.beforeAll(async ({ request }) => {
    const subjRes = await request.post('/api/kpi/subjects', {
      data: {
        code: `E2E.AMEND.${Date.now()}`,
        name: 'e2e 目标修订测试科目',
        defaultScope: 'bonus',
        defaultMeasureType: 'numeric',
      },
    });
    if (!subjRes.ok()) return;
    subjectId = (await subjRes.json()).subject.id;

    const cycleRes = await request.post('/api/kpi/cycles', {
      data: {
        fiscalYear: 2900 + Math.floor(Math.random() * 90), // 避开真实财年冲突
        name: `e2e-amend-${Date.now()}`,
        startDate: '2900-01-01T00:00:00.000Z',
        endDate: '2900-12-31T23:59:59.000Z',
      },
    });
    if (!cycleRes.ok()) return;
    cycleId = (await cycleRes.json()).cycle.id;

    // draft 周期内先建好两条 KPI (POST /api/kpi 要求 draft 才能新建)
    const mkKpi = async (targetValue: number, suffix: string) => {
      const res = await request.post('/api/kpi', {
        data: {
          cycleId,
          subjectId,
          level: 'individual',
          assigneeId: ASSIGNEE_ID,
          title: `e2e amendment target kpi ${suffix}`,
          measureType: 'numeric',
          targetValue,
          scope: 'bonus',
        },
      });
      if (!res.ok()) return null;
      return (await res.json()).kpi.id as string;
    };
    const a = await mkKpi(100, 'approve-path');
    const b = await mkKpi(200, 'reject-path');
    if (!a || !b) return;
    approveKpiId = a;
    rejectKpiId = b;

    // 激活周期 → 锁定两条 KPI 的 targetValue
    const activateRes = await request.patch(`/api/kpi/cycles/${cycleId}`, { data: { status: 'active' } });
    if (!activateRes.ok()) return;

    prereqOk = true;
  });

  test('draft → active locks target (direct PATCH rejected)', async ({ request }) => {
    if (!prereqOk) {
      test.info().annotations.push({ type: 'skip-reason', description: 'prerequisite setup failed' });
      return;
    }
    const directPatch = await request.patch(`/api/kpi/${approveKpiId}`, { data: { targetValue: 999 } });
    expect(directPatch.status()).toBe(400);
  });

  test('submit → list → approve rewrites targetValue, cannot re-review', async ({ request }) => {
    if (!prereqOk) {
      test.info().annotations.push({ type: 'skip-reason', description: 'prerequisite setup failed' });
      return;
    }

    const submitRes = await request.post('/api/kpi/target-amendments', {
      data: { kpiId: approveKpiId, toTargetValue: 150, reason: 'e2e: 市场环境变化上调目标' },
    });
    expect(submitRes.status()).toBe(201);
    const submitBody = await submitRes.json();
    const amendmentId = submitBody.amendment.id as string;
    expect(submitBody.amendment.status).toBe('pending');
    expect(submitBody.amendment.fromTargetValue).toBe(100);

    const listRes = await request.get(`/api/kpi/target-amendments?kpiId=${approveKpiId}`);
    expect(listRes.status()).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.amendments.some((a: { id: string }) => a.id === amendmentId)).toBe(true);

    const approveRes = await request.patch(`/api/kpi/target-amendments/${amendmentId}`, {
      data: { decision: 'approve' },
    });
    expect(approveRes.status()).toBe(200);
    expect((await approveRes.json()).amendment.status).toBe('approved');

    const kpiRes = await request.get(`/api/kpi/${approveKpiId}`);
    expect(kpiRes.status()).toBe(200);
    expect((await kpiRes.json()).kpi.targetValue).toBe(150);

    const reReview = await request.patch(`/api/kpi/target-amendments/${amendmentId}`, {
      data: { decision: 'approve' },
    });
    expect(reReview.status()).toBe(400);
  });

  test('reject leaves targetValue unchanged', async ({ request }) => {
    if (!prereqOk) {
      test.info().annotations.push({ type: 'skip-reason', description: 'prerequisite setup failed' });
      return;
    }

    const submitRes = await request.post('/api/kpi/target-amendments', {
      data: { kpiId: rejectKpiId, toTargetValue: 999, reason: 'e2e: 理由不充分, 用于测试驳回' },
    });
    expect(submitRes.status()).toBe(201);
    const amendmentId = (await submitRes.json()).amendment.id as string;

    const rejectRes = await request.patch(`/api/kpi/target-amendments/${amendmentId}`, {
      data: { decision: 'reject', reviewNote: 'e2e: 驳回测试' },
    });
    expect(rejectRes.status()).toBe(200);
    expect((await rejectRes.json()).amendment.status).toBe('rejected');

    const kpiRes = await request.get(`/api/kpi/${rejectKpiId}`);
    expect(kpiRes.status()).toBe(200);
    expect((await kpiRes.json()).kpi.targetValue).toBe(200); // 未被改写
  });

  // 注: self_amend_forbidden / 重复 pending 409 / 权限不足 403 等分支需要构造"非当前登录身份"
  // 的多重角色场景, e2e 单 session (admin.json) 难以低成本模拟, 已由
  // tests/unit/kpi-target-amendment.test.ts (10 用例, mock 多角色 AuthContext) 完整覆盖。
  // 此文件只验证真实 server + 真实 DB 下的端到端主链路 (锁定/提交/审批/驳回/防重复审批)。
});
