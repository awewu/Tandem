/**
 * 目标修订签批流 · API 层单测
 *
 * 覆盖:
 *   - POST /api/kpi/target-amendments : 提交成功 / draft 周期拒绝 / 自己名下拒绝 / 重复 pending 拒绝
 *   - PATCH /api/kpi/target-amendments/[id] : owner/admin 批准落地改写 targetValue / 非审批人 403 / 驳回不改值 / 重复审批拒绝
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { Kpi, KpiCycle } from '@/lib/types/kpi';

let currentAuth: AuthContext;

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getRouter: vi.fn(() => ({})),
    getStore: repo.getStore,
  };
});

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return { ...actual, requireAuth: vi.fn(() => currentAuth) };
});

import { GET as listGET, POST as createPOST } from '@/app/api/kpi/target-amendments/route';
import { PATCH as reviewPATCH } from '@/app/api/kpi/target-amendments/[id]/route';

function ctx(userId: string, roles: string[]): AuthContext {
  return { userId, email: `${userId}@t.local`, tenantId: 'default', roles, mfaVerified: true, demo: false };
}

function getReq(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: 'GET' }));
}
function postReq(url: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  );
}
function patchReq(url: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  );
}

async function seedCycle(status: KpiCycle['status'] = 'active'): Promise<KpiCycle> {
  const now = new Date().toISOString();
  return getStore().kpiCycles.create({
    fiscalYear: 2026,
    name: 'FY2026',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status,
    tenantId: 'default',
    targetsLockedAt: status !== 'draft' ? now : undefined,
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
  } as Omit<KpiCycle, 'id'>);
}

async function seedKpi(
  cycleId: string,
  assigneeId: string,
  targetValue = 100,
  parentKpiId?: string,
): Promise<Kpi> {
  const now = new Date().toISOString();
  return getStore().kpis.create({
    cycleId,
    subjectId: 'subj_1',
    level: parentKpiId ? 'individual' : 'department',
    parentKpiId,
    assigneeId,
    title: parentKpiId ? 'Child KPI' : 'Test KPI',
    measureType: 'numeric',
    startValue: 0,
    targetValue,
    currentValue: 50,
    weight: 100,
    dataSource: 'manual',
    scope: 'bonus',
    tenantId: 'default',
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
  } as Omit<Kpi, 'id'>);
}

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('POST /api/kpi/target-amendments', () => {
  it('manager submits a request for a subordinate KPI in a locked cycle', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);

    const res = await createPOST(postReq('http://x/api/kpi/target-amendments', {
      kpiId: kpi.id,
      toTargetValue: 120,
      reason: '市场环境变化, 上调目标',
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.amendment.status).toBe('pending');
    expect(data.amendment.fromTargetValue).toBe(100);
    expect(data.amendment.toTargetValue).toBe(120);

    // KPI targetValue unchanged until approved
    const stillKpi = await getStore().kpis.get(kpi.id);
    expect(stillKpi!.targetValue).toBe(100);
  });

  it('rejects when cycle is not active (draft should use direct PATCH, closed is locked)', async () => {
    const draftCycle = await seedCycle('draft');
    const draftKpi = await seedKpi(draftCycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);

    const draftRes = await createPOST(postReq('http://x/api/kpi/target-amendments', {
      kpiId: draftKpi.id, toTargetValue: 120, reason: 'x',
    }));
    expect(draftRes.status).toBe(400);
    const draftData = await draftRes.json();
    expect(draftData.error).toMatch(/cycle_not_active/);

    const closedCycle = await seedCycle('closed');
    const closedKpi = await seedKpi(closedCycle.id, 'u_employee', 100);
    const closedRes = await createPOST(postReq('http://x/api/kpi/target-amendments', {
      kpiId: closedKpi.id, toTargetValue: 120, reason: 'x',
    }));
    expect(closedRes.status).toBe(400);
    const closedData = await closedRes.json();
    expect(closedData.error).toMatch(/cycle_not_active/);
  });

  it('rejects self-amendment (assignee cannot request their own target change)', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_employee', ['manager']);

    const res = await createPOST(postReq('http://x/api/kpi/target-amendments', {
      kpiId: kpi.id, toTargetValue: 50, reason: 'x',
    }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/self_amend_forbidden/);
  });

  it('rejects a second pending request while one is already pending', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);

    await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    const res2 = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 130, reason: 'y' }));
    expect(res2.status).toBe(409);
  });

  it('requires kpi.write permission', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_random', ['employee']);

    const res = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/kpi/target-amendments/[id] (review)', () => {
  it('owner approves → KPI targetValue is rewritten', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);
    const createRes = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    const { amendment } = await createRes.json();

    currentAuth = ctx('u_owner', ['owner']);
    const res = await reviewPATCH(
      patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'approve' }),
      { params: { id: amendment.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.amendment.status).toBe('approved');

    const updatedKpi = await getStore().kpis.get(kpi.id);
    expect(updatedKpi!.targetValue).toBe(120);
  });

  it('reject leaves targetValue unchanged', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);
    const createRes = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    const { amendment } = await createRes.json();

    currentAuth = ctx('u_admin', ['admin']);
    const res = await reviewPATCH(
      patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'reject', reviewNote: '理由不充分' }),
      { params: { id: amendment.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.amendment.status).toBe('rejected');

    const updatedKpi = await getStore().kpis.get(kpi.id);
    expect(updatedKpi!.targetValue).toBe(100);
  });

  it('non owner/admin cannot approve', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);
    const createRes = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    const { amendment } = await createRes.json();

    currentAuth = ctx('u_manager2', ['manager']);
    const res = await reviewPATCH(
      patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'approve' }),
      { params: { id: amendment.id } },
    );
    expect(res.status).toBe(403);
  });

  it('cannot review an already-reviewed amendment twice', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);
    const createRes = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    const { amendment } = await createRes.json();

    currentAuth = ctx('u_owner', ['owner']);
    await reviewPATCH(patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'approve' }), { params: { id: amendment.id } });
    const res2 = await reviewPATCH(patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'approve' }), { params: { id: amendment.id } });
    expect(res2.status).toBe(400);
  });

  it('rejects approval when cycle is closed', async () => {
    const cycle = await seedCycle('closed');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);
    const createRes = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));
    expect(createRes.status).toBe(400);

    // 模拟一条已存在的 pending amendment (绕过 POST 检查) 来验证 PATCH 侧也拦截
    const amendment = await getStore().kpiTargetAmendments.create({
      kpiId: kpi.id,
      cycleId: cycle.id,
      requestedBy: 'u_manager',
      fromTargetValue: 100,
      toTargetValue: 120,
      reason: 'x',
      status: 'pending',
      tenantId: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    currentAuth = ctx('u_owner', ['owner']);
    const res = await reviewPATCH(
      patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'approve' }),
      { params: { id: amendment.id } },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/cycle_not_active/);
  });

  it('emits cascade warning when approved parent target no longer aligns with children sum', async () => {
    const cycle = await seedCycle('active');
    const parent = await seedKpi(cycle.id, 'u_dept', 100);
    const childA = await seedKpi(cycle.id, 'u_employee_a', 40, parent.id);
    const childB = await seedKpi(cycle.id, 'u_employee_b', 60, parent.id);

    currentAuth = ctx('u_manager', ['manager']);
    const createRes = await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: parent.id, toTargetValue: 150, reason: '上调部门目标' }));
    const { amendment } = await createRes.json();

    currentAuth = ctx('u_owner', ['owner']);
    const res = await reviewPATCH(
      patchReq(`http://x/api/kpi/target-amendments/${amendment.id}`, { decision: 'approve' }),
      { params: { id: amendment.id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.amendment.status).toBe('approved');
    expect(data.cascadeWarning).toBeDefined();
    expect(data.cascadeWarning.childrenSum).toBe(childA.targetValue + childB.targetValue);
    expect(data.cascadeWarning.deltaPct).not.toBe(0);
  });
});

describe('GET /api/kpi/target-amendments', () => {
  it('filters by kpiId', async () => {
    const cycle = await seedCycle('active');
    const kpi = await seedKpi(cycle.id, 'u_employee', 100);
    currentAuth = ctx('u_manager', ['manager']);
    await createPOST(postReq('http://x/api/kpi/target-amendments', { kpiId: kpi.id, toTargetValue: 120, reason: 'x' }));

    const res = await listGET(getReq(`http://x/api/kpi/target-amendments?kpiId=${kpi.id}`));
    const data = await res.json();
    expect(data.amendments).toHaveLength(1);
    expect(data.amendments[0].kpiId).toBe(kpi.id);
  });
});
