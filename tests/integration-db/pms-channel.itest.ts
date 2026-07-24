/**
 * tests/integration-db/pms-channel.itest.ts
 *
 * PMS 渠道/DMS 层 DB 集成测试 (opt-in, 真库).
 *   扩展 D1 覆盖: 价格申请分级审批 / 返利政策+计提+结算 / 经销商在线订货 FSM。
 *
 * 运行: npm run test:pms-integration  (需本地真库 localhost:5432)
 * 安全: 唯一租户 TEST_TENANT + 全清理, 不触碰其它租户。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/infra/drizzle-client';
import {
  pmsPriceApplications,
  pmsApprovals,
  pmsRebatePolicies,
  pmsRebateAccruals,
  pmsDealerOrders,
  pmsAlerts,
} from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';

import {
  createPriceApplication,
  decidePriceApplication,
  getPriceApplication,
  listPriceApplications,
} from '@/lib/pms/price-application-service';
import {
  createRebatePolicy,
  getRebatePolicy,
  listRebatePolicies,
  createRebateAccrual,
  listRebateAccruals,
  settleRebateAccrual,
} from '@/lib/pms/rebate-service';
import {
  createDealerOrder,
  getDealerOrder,
  listDealerOrders,
  transitionDealerOrder,
} from '@/lib/pms/dealer-order-service';

const TEST_TENANT = '__pms_itest_ch__';
const ORG_A = 'itest_ch_org_a';
const ORG_B = 'itest_ch_org_b';
const hasDb = !!process.env.DATABASE_URL;

async function cleanup(): Promise<void> {
  await db.delete(pmsApprovals).where(eq(pmsApprovals.tenantId, TEST_TENANT));
  await db.delete(pmsPriceApplications).where(eq(pmsPriceApplications.tenantId, TEST_TENANT));
  await db.delete(pmsRebateAccruals).where(eq(pmsRebateAccruals.tenantId, TEST_TENANT));
  await db.delete(pmsRebatePolicies).where(eq(pmsRebatePolicies.tenantId, TEST_TENANT));
  await db.delete(pmsDealerOrders).where(eq(pmsDealerOrders.tenantId, TEST_TENANT));
  await db.delete(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
}

describe.skipIf(!hasDb)('integration(db) · PMS 价格申请分级审批', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('低折扣(3%) → level 1, 区域经理可批', async () => {
    const app = await createPriceApplication({
      tenantId: TEST_TENANT,
      opportunityId: 'opp_ch_1',
      applicantId: 'itest_dealer',
      productId: 'prod_1',
      listPrice: 100000,
      requestedPrice: 97000,
      reason: '大客户批量',
    });
    expect(app.discountRate).toBe(3);
    expect(app.requiredLevel).toBe(1);
    expect(app.status).toBe('pending');

    // 提交告警埋点
    const alerts = await db.select().from(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
    expect(alerts.some((a) => a.type === 'price_approval_required')).toBe(true);

    const res = await decidePriceApplication({
      tenantId: TEST_TENANT,
      applicationId: app.id,
      approverId: 'itest_region_mgr',
      approverLevel: 1,
      decision: 'approved',
    });
    expect(res.status).toBe('approved');
    expect(res.approvedPrice).toBe(97000);

    const got = await getPriceApplication(app.id, TEST_TENANT);
    expect(got.status).toBe('approved');

    // 审批留痕落库
    const approvals = await db.select().from(pmsApprovals).where(eq(pmsApprovals.tenantId, TEST_TENANT));
    expect(approvals).toHaveLength(1);
    expect(approvals[0].entityType).toBe('price_application');
    expect(approvals[0].entityId).toBe(app.id);
  });

  it('高折扣(20%) → level 3, level 2 审批人越权被拒', async () => {
    const app = await createPriceApplication({
      tenantId: TEST_TENANT,
      opportunityId: 'opp_ch_2',
      applicantId: 'itest_dealer',
      productId: 'prod_2',
      listPrice: 100000,
      requestedPrice: 80000,
      reason: '战略项目',
    });
    expect(app.discountRate).toBe(20);
    expect(app.requiredLevel).toBe(3);

    await expect(
      decidePriceApplication({
        tenantId: TEST_TENANT,
        applicationId: app.id,
        approverId: 'itest_director',
        approverLevel: 2,
        decision: 'approved',
      }),
    ).rejects.toThrow(/insufficient approval authority/);

    // 仍是 pending
    expect((await getPriceApplication(app.id, TEST_TENANT)).status).toBe('pending');

    // 总经理 (level 3) 可批
    const res = await decidePriceApplication({
      tenantId: TEST_TENANT,
      applicationId: app.id,
      approverId: 'itest_gm',
      approverLevel: 3,
      decision: 'approved',
    });
    expect(res.status).toBe('approved');
  });

  it('重复审批已决单被拒', async () => {
    const app = await createPriceApplication({
      tenantId: TEST_TENANT, opportunityId: 'o', applicantId: 'd', productId: 'p',
      listPrice: 100, requestedPrice: 98, reason: 'r',
    });
    await decidePriceApplication({
      tenantId: TEST_TENANT, applicationId: app.id, approverId: 'a', approverLevel: 1, decision: 'approved',
    });
    await expect(
      decidePriceApplication({
        tenantId: TEST_TENANT, applicationId: app.id, approverId: 'a', approverLevel: 1, decision: 'rejected',
      }),
    ).rejects.toThrow(/already decided/);
  });

  it('列表过滤: 按 applicantId', async () => {
    await createPriceApplication({
      tenantId: TEST_TENANT, opportunityId: 'o', applicantId: 'dealer_x', productId: 'p',
      listPrice: 100, requestedPrice: 95, reason: 'r',
    });
    await createPriceApplication({
      tenantId: TEST_TENANT, opportunityId: 'o', applicantId: 'dealer_y', productId: 'p',
      listPrice: 100, requestedPrice: 95, reason: 'r',
    });
    const xOnly = await listPriceApplications({ tenantId: TEST_TENANT, applicantId: 'dealer_x' });
    expect(xOnly).toHaveLength(1);
    expect(xOnly[0].applicantId).toBe('dealer_x');
  });
});

describe.skipIf(!hasDb)('integration(db) · PMS 返利政策+计提+结算', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('createRebatePolicy → get → list', async () => {
    const policy = await createRebatePolicy(TEST_TENANT, {
      name: '2026 中央空调阶梯返利',
      productLine: 'HVAC',
      tiers: [
        { minAmount: 0, maxAmount: 1000000, rebateRate: 2 },
        { minAmount: 1000000, rebateRate: 5 },
      ],
      effectiveDate: '2026-01-01',
      expiryDate: '2026-12-31',
      createdBy: 'itest_admin',
    });
    expect(policy.id).toBeDefined();

    const got = await getRebatePolicy(policy.id, TEST_TENANT);
    expect(got).not.toBeNull();
    expect(got.name).toBe('2026 中央空调阶梯返利');
    expect(got.tiers).toHaveLength(2);

    const list = await listRebatePolicies(TEST_TENANT, 'active');
    expect(list.map((p) => p.id)).toContain(policy.id);
  });

  it('返利计提 → 结算 (pending → settled), 重复结算被拒', async () => {
    const policy = await createRebatePolicy(TEST_TENANT, {
      name: 'P', tiers: [{ minAmount: 0, rebateRate: 3 }], effectiveDate: '2026-01-01', createdBy: 'a',
    });
    const accrual = await createRebateAccrual(TEST_TENANT, {
      dealerOrgId: ORG_A,
      policyId: policy.id,
      period: '2026-Q1',
      salesAmount: 500000,
      rebateAmount: 15000,
    });
    expect(accrual.id).toBeDefined();

    const pending = await listRebateAccruals(TEST_TENANT, { dealerOrgId: ORG_A, status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].rebateAmount).toBe(15000);

    const settled = await settleRebateAccrual({
      tenantId: TEST_TENANT, accrualId: accrual.id, settledBy: 'itest_finance',
    });
    expect(settled.status).toBe('settled');

    await expect(
      settleRebateAccrual({ tenantId: TEST_TENANT, accrualId: accrual.id, settledBy: 'x' }),
    ).rejects.toThrow(/already settled/);
  });
});

describe.skipIf(!hasDb)('integration(db) · PMS 经销商在线订货 FSM', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('createDealerOrder 计算总额 + 埋点, FSM pending→confirmed→shipped→completed', async () => {
    const order = await createDealerOrder({
      tenantId: TEST_TENANT,
      dealerOrgId: ORG_A,
      items: [
        { productId: 'p1', quantity: 3, unitPrice: 1200 },
        { productId: 'p2', quantity: 2, unitPrice: 800 },
      ],
    });
    expect(order.totalAmount).toBe(3 * 1200 + 2 * 800); // 5200
    expect(order.status).toBe('pending');

    // 提交告警埋点
    const alerts = await db.select().from(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
    expect(alerts.some((a) => a.type === 'dealer_order_confirmation_required')).toBe(true);

    const c = await transitionDealerOrder({ tenantId: TEST_TENANT, id: order.id, toStatus: 'confirmed', actorId: 'itest_ops' });
    expect(c.to).toBe('confirmed');
    const confirmed = await getDealerOrder(order.id, TEST_TENANT);
    expect(confirmed.confirmedBy).toBe('itest_ops');

    const s = await transitionDealerOrder({ tenantId: TEST_TENANT, id: order.id, toStatus: 'shipped' });
    expect(s.to).toBe('shipped');
    const done = await transitionDealerOrder({ tenantId: TEST_TENANT, id: order.id, toStatus: 'completed' });
    expect(done.to).toBe('completed');
  });

  it('订货单非法流转被拒: pending → shipped', async () => {
    const order = await createDealerOrder({
      tenantId: TEST_TENANT, dealerOrgId: ORG_A, items: [{ productId: 'p', quantity: 1, unitPrice: 100 }],
    });
    await expect(
      transitionDealerOrder({ tenantId: TEST_TENANT, id: order.id, toStatus: 'shipped' }),
    ).rejects.toThrow(/illegal order transition/);
  });

  it('dealerOrgId 隔离: 按 dealerOrgId 过滤只返回本组织订单', async () => {
    await createDealerOrder({ tenantId: TEST_TENANT, dealerOrgId: ORG_A, items: [{ productId: 'p', quantity: 1, unitPrice: 10 }] });
    await createDealerOrder({ tenantId: TEST_TENANT, dealerOrgId: ORG_B, items: [{ productId: 'p', quantity: 1, unitPrice: 10 }] });
    const aOnly = await listDealerOrders({ tenantId: TEST_TENANT, dealerOrgId: ORG_A });
    expect(aOnly).toHaveLength(1);
    expect(aOnly[0].dealerOrgId).toBe(ORG_A);
  });
});
