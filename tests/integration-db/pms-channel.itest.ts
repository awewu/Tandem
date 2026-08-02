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
  pmsQuotes,
  pmsQuoteTemplates,
  pmsSelectorRulesets,
  pmsSelectorRulesetVersions,
  pmsProductCatalog,
  pmsOpportunities,
  pmsDuplicateChecks,
} from '@/lib/infra/drizzle-schema';
import { and, eq } from 'drizzle-orm';

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
import { createOpportunity } from '@/lib/pms/opportunity-service';
import {
  createQuote,
  getQuote,
  listQuotes,
  updateQuoteDraft,
  issueQuote,
  reviseQuote,
  revokeQuote,
  verifyQuote,
  type QuoteAuthCtx,
} from '@/lib/pms/quote-service';
import { getAuditLog } from '@/lib/audit/log';
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from '@/lib/pms/quote-template-service';
import { createProduct, importProducts, listProducts, updateProduct } from '@/lib/pms/product-catalog-service';
import {
  createRuleSet,
  updateRuleSet,
  publishRuleSet,
  getRuleSet,
  listRuleSets,
  listRuleSetVersions,
  runSelector,
  deleteRuleSet,
} from '@/lib/pms/selector-service';
import { assembleQuotePricingReport } from '@/lib/pms/quote-insights-service';
import { scanQuotePricingAnomalies } from '@/lib/pms/cron-service';
import type { QuoteSystem } from '@/lib/types/pms';

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
  await db.delete(pmsQuotes).where(eq(pmsQuotes.tenantId, TEST_TENANT));
  await db.delete(pmsQuoteTemplates).where(eq(pmsQuoteTemplates.tenantId, TEST_TENANT));
  await db.delete(pmsSelectorRulesetVersions).where(eq(pmsSelectorRulesetVersions.tenantId, TEST_TENANT));
  await db.delete(pmsSelectorRulesets).where(eq(pmsSelectorRulesets.tenantId, TEST_TENANT));
  await db.delete(pmsProductCatalog).where(eq(pmsProductCatalog.tenantId, TEST_TENANT));
  await db.delete(pmsDuplicateChecks).where(eq(pmsDuplicateChecks.tenantId, TEST_TENANT));
  await db.delete(pmsOpportunities).where(eq(pmsOpportunities.tenantId, TEST_TENANT));
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

    const got = (await getPriceApplication(app.id, TEST_TENANT))!;
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
    expect((await getPriceApplication(app.id, TEST_TENANT))!.status).toBe('pending');

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

    const got = (await getRebatePolicy(policy.id, TEST_TENANT))!;
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
    const confirmed = (await getDealerOrder(order.id, TEST_TENANT))!;
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

// ============================================================================
// 报价单三层文档 · 全生命周期 (draft → issue → verify → revise → revoke) + 报备保护绑定 + orgId 隔离
// ============================================================================

const INTERNAL_A: QuoteAuthCtx = { tenantId: TEST_TENANT, userId: 'itest_sales_a', visibleOrgIds: [], isInternal: true, roles: ['manager'] };
const EXTERNAL_B: QuoteAuthCtx = { tenantId: TEST_TENANT, userId: 'itest_dealer_b', visibleOrgIds: [ORG_B], isInternal: false, roles: ['dealer_sales'] };
// 内部普通员工: isInternal 但非选型维护组 → 不得写选型规则集
const INTERNAL_EMPLOYEE: QuoteAuthCtx = { tenantId: TEST_TENANT, userId: 'itest_employee_c', visibleOrgIds: [], isInternal: true, roles: ['employee'] };

let seq = 0;
async function seedProtectedOpportunity(orgId: string): Promise<string> {
  seq += 1;
  const res = await createOpportunity({
    tenantId: TEST_TENANT,
    orgId,
    dealerOrgId: orgId,
    reporterId: 'itest_sales_a',
    customerName: `报价客户_${orgId}_${seq}`,
    projectName: `报价项目_${orgId}_${seq}`,
    status: 'active',
  });
  expect(res.opportunity).toBeDefined();
  return res.opportunity!.id;
}

function sampleSystems(): QuoteSystem[] {
  // 省略 unitPrice/amount/subtotal, 交由 recomputeQuote 从 listPrice*discountRate 派生 (单一真值)
  return [
    {
      id: 'sys1',
      name: '生活热水系统',
      items: [
        { id: 'i1', costType: 'equipment', model: '空气源热泵 KFXRS-30', quantity: 2, listPrice: 30000, discountRate: 0.85 },
        { id: 'i2', costType: 'installation', model: '外机安装', quantity: 1, listPrice: 5000 },
      ],
    },
  ] as unknown as QuoteSystem[];
}

describe.skipIf(!hasDb)('integration(db) · PMS 报价单全生命周期', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('createQuote 继承报备归属 + recompute 分项 BOQ (设备51000/安装5000)', async () => {
    const oppId = await seedProtectedOpportunity(ORG_A);
    const q = await createQuote({ opportunityId: oppId, title: '综合能源方案', customerName: '', systems: sampleSystems() }, INTERNAL_A);

    expect(q.status).toBe('draft');
    expect(q.version).toBe(1);
    expect(q.verifyCode).toBeUndefined();
    expect(q.orgId).toBe(ORG_A);
    expect(q.dealerOrgId).toBe(ORG_A);
    // 客户名缺省继承报备
    expect(q.customerName).toBe(`报价客户_${ORG_A}_${seq}`);
    // 设备: 30000*0.85*2 = 51000; 安装: 5000
    expect(q.totals.equipment).toBe(51000);
    expect(q.totals.installation).toBe(5000);
    expect(q.totals.total).toBe(56000);
    expect(q.systems[0].subtotal).toBe(56000);
  });

  it('未报备/无保护期报备不能建报价 (403/409)', async () => {
    // 不存在的报备
    await expect(
      createQuote({ opportunityId: 'nope', title: 't', customerName: 'c', systems: [] }, INTERNAL_A),
    ).rejects.toBeInstanceOf(Response);

    // 非 active 报备 → 409
    const lost = await createOpportunity({
      tenantId: TEST_TENANT, orgId: ORG_A, dealerOrgId: ORG_A, reporterId: 'itest_sales_a',
      customerName: '丢单客户', projectName: '丢单项目', status: 'lost',
    });
    await expect(
      createQuote({ opportunityId: lost.opportunity!.id, title: 't', customerName: 'c', systems: [] }, INTERNAL_A),
    ).rejects.toBeInstanceOf(Response);
  });

  it('issue 生成唯一验真码 → verify 零登录回真伪 (不露价)', async () => {
    const oppId = await seedProtectedOpportunity(ORG_A);
    const draft = await createQuote({ opportunityId: oppId, title: '方案A', customerName: 'C', systems: sampleSystems() }, INTERNAL_A);
    const issued = await issueQuote(draft.id, INTERNAL_A);

    expect(issued.status).toBe('issued');
    expect(issued.verifyCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(issued.issuedAt).toBeTruthy();

    const view = await verifyQuote(issued.verifyCode!);
    expect(view.valid).toBe(true);
    expect(view.status).toBe('issued');
    expect(view.quoteTitle).toBe('方案A');
    // 验真视图不露价: 无 totals/systems/金额字段
    expect(view).not.toHaveProperty('totals');
    expect(view).not.toHaveProperty('systems');
  });

  it('已签发不可直接改, revise 出 version+1 新草稿; 旧 issued 被 superseded', async () => {
    const oppId = await seedProtectedOpportunity(ORG_A);
    const v1 = await issueQuote(
      (await createQuote({ opportunityId: oppId, title: 'V1', customerName: 'C', systems: sampleSystems() }, INTERNAL_A)).id,
      INTERNAL_A,
    );

    // 已签发直接改 → 409
    await expect(updateQuoteDraft(v1.id, { title: 'X' }, INTERNAL_A)).rejects.toBeInstanceOf(Response);

    // 出新版本 → draft, version 2
    const v2draft = await reviseQuote(v1.id, INTERNAL_A);
    expect(v2draft.status).toBe('draft');
    expect(v2draft.version).toBe(2);

    // 签发 v2 → v1 应被置为 superseded
    const v2 = await issueQuote(v2draft.id, INTERNAL_A);
    expect(v2.status).toBe('issued');
    const v1after = await getQuote(v1.id, INTERNAL_A);
    expect(v1after?.status).toBe('superseded');

    // 验旧码 → superseded, 不再 valid
    const oldView = await verifyQuote(v1.verifyCode!);
    expect(oldView.valid).toBe(false);
    expect(oldView.status).toBe('superseded');
  });

  it('revoke 后验真回作废且 invalid', async () => {
    const oppId = await seedProtectedOpportunity(ORG_A);
    const issued = await issueQuote(
      (await createQuote({ opportunityId: oppId, title: '待作废', customerName: 'C', systems: sampleSystems() }, INTERNAL_A)).id,
      INTERNAL_A,
    );
    await revokeQuote(issued.id, INTERNAL_A);
    const view = await verifyQuote(issued.verifyCode!);
    expect(view.valid).toBe(false);
    expect(view.status).toBe('revoked');
  });

  it('验真查无此码 → invalid, 不抛错', async () => {
    const view = await verifyQuote('ZZZZ-ZZZZ-ZZZZ');
    expect(view.valid).toBe(false);
    expect(view.message).toContain('查无');
  });

  it('orgId 隔离: 外部经销商看不到别组织报价 (getQuote null / listQuotes 空)', async () => {
    const oppA = await seedProtectedOpportunity(ORG_A);
    const q = await createQuote({ opportunityId: oppA, title: 'A私有', customerName: 'C', systems: sampleSystems() }, INTERNAL_A);

    // ORG_B 经销商读 ORG_A 的报价 → null
    expect(await getQuote(q.id, EXTERNAL_B)).toBeNull();
    const list = await listQuotes({}, EXTERNAL_B);
    expect(list.every((x) => x.orgId !== ORG_A)).toBe(true);
    // 内部可见
    expect(await getQuote(q.id, INTERNAL_A)).not.toBeNull();
  });

  it('生命周期全程留审计: create/issue/revise/revoke 均写 pms.quote.* (targetId 精确匹配)', async () => {
    const oppId = await seedProtectedOpportunity(ORG_A);
    const draft = await createQuote(
      { opportunityId: oppId, title: '审计留痕', customerName: 'C', systems: sampleSystems() },
      INTERNAL_A,
    );
    const issued = await issueQuote(draft.id, INTERNAL_A);
    const v2draft = await reviseQuote(issued.id, INTERNAL_A);
    await revokeQuote(issued.id, INTERNAL_A);

    const log = getAuditLog();
    const created = await log.list({ tenantId: TEST_TENANT, action: 'pms.quote.created', targetId: draft.id });
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(created[0].actorId).toBe(INTERNAL_A.userId);
    expect(created[0].metadata?.opportunityId).toBe(oppId);

    const issuedAudit = await log.list({ tenantId: TEST_TENANT, action: 'pms.quote.issued', targetId: draft.id });
    expect(issuedAudit.length).toBeGreaterThanOrEqual(1);
    expect(issuedAudit[0].metadata?.verifyCode).toBe(issued.verifyCode);

    const revised = await log.list({ tenantId: TEST_TENANT, action: 'pms.quote.revised', targetId: v2draft.id });
    expect(revised.length).toBeGreaterThanOrEqual(1);
    expect(revised[0].metadata?.fromQuoteId).toBe(issued.id);

    const revoked = await log.list({ tenantId: TEST_TENANT, action: 'pms.quote.revoked', targetId: issued.id });
    expect(revoked.length).toBeGreaterThanOrEqual(1);
    expect(revoked[0].metadata?.prevStatus).toBe('issued');
  });
});

// ============================================================================
// 报价方案模板库 · CRUD + recompute + 共享/组织可见性
// ============================================================================

describe.skipIf(!hasDb)('integration(db) · PMS 报价方案模板库', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('createTemplate recompute systems + 缺名/缺组织报错', async () => {
    const t = await createTemplate({ orgId: ORG_A, name: '热水标准方案', category: '生活热水', systems: sampleSystems() }, INTERNAL_A);
    expect(t.name).toBe('热水标准方案');
    expect(t.orgId).toBe(ORG_A);
    expect(t.isShared).toBe(false);
    // recompute: 系统小计 56000
    expect(t.systems[0].subtotal).toBe(56000);

    await expect(createTemplate({ orgId: ORG_A, name: '', systems: [] }, INTERNAL_A)).rejects.toBeInstanceOf(Response);
    await expect(createTemplate({ orgId: '', name: 'x', systems: [] }, INTERNAL_A)).rejects.toBeInstanceOf(Response);
  });

  it('update / 软删 (archived 后 get 返回 null, list 不含)', async () => {
    const t = await createTemplate({ orgId: ORG_A, name: 'v1', systems: sampleSystems() }, INTERNAL_A);
    const upd = await updateTemplate(t.id, { name: 'v2', category: '空调' }, INTERNAL_A);
    expect(upd.name).toBe('v2');
    expect(upd.category).toBe('空调');

    await deleteTemplate(t.id, INTERNAL_A);
    expect(await getTemplate(t.id, INTERNAL_A)).toBeNull();
    const list = await listTemplates({}, INTERNAL_A);
    expect(list.find((x) => x.id === t.id)).toBeUndefined();
  });

  it('组织可见性: 外部只见本组织 + 共享模板, 写别组织被拒', async () => {
    const privA = await createTemplate({ orgId: ORG_A, name: 'A私有', systems: sampleSystems() }, INTERNAL_A);
    const shared = await createTemplate({ orgId: ORG_A, name: '全租户共享', isShared: true, systems: sampleSystems() }, INTERNAL_A);
    const ownB = await createTemplate({ orgId: ORG_B, name: 'B私有', systems: sampleSystems() }, EXTERNAL_B);

    const bList = await listTemplates({}, EXTERNAL_B);
    const bIds = bList.map((x) => x.id);
    expect(bIds).toContain(ownB.id); // 本组织
    expect(bIds).toContain(shared.id); // 共享
    expect(bIds).not.toContain(privA.id); // 别组织私有 → 不可见

    // 外部读别组织私有 → null
    expect(await getTemplate(privA.id, EXTERNAL_B)).toBeNull();
    // 外部在别组织下建模板 → 403
    await expect(createTemplate({ orgId: ORG_A, name: 'x', systems: [] }, EXTERNAL_B)).rejects.toBeInstanceOf(Response);
  });
});

// ============================================================================
// 产品主数据批量导入 · 幂等 upsert
// ============================================================================

describe.skipIf(!hasDb)('integration(db) · PMS 产品主数据导入', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('首次导入 created; 重导同键 updated 不重插; 缺列 failed', async () => {
    const rows = [
      { series: 'Rheem 热泵', model: 'HP-12', modelCode: 'HP12INV', category: 'heat_pump', unit: '台', listPrice: 28000 },
      { series: 'Rheem 热泵', model: 'HP-16', modelCode: 'HP16INV', category: 'heat_pump', unit: '台', listPrice: 35000 },
      { series: '', model: '', modelCode: 'BAD' }, // 缺系列/型号 → failed
    ];
    const r1 = await importProducts(TEST_TENANT, rows);
    expect(r1.total).toBe(3);
    expect(r1.created).toBe(2);
    expect(r1.updated).toBe(0);
    expect(r1.failed).toHaveLength(1);

    const list1 = await listProducts({ tenantId: TEST_TENANT });
    expect(list1).toHaveLength(2);

    // 重导入同键 (改价) → updated, 不新增行
    const r2 = await importProducts(TEST_TENANT, [
      { series: 'Rheem 热泵', model: 'HP-12 变频', modelCode: 'HP12INV', listPrice: 26800 },
    ]);
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);

    const list2 = await listProducts({ tenantId: TEST_TENANT });
    expect(list2).toHaveLength(2); // 仍 2 行 (幂等)
    const hp12 = list2.find((p) => p.modelCode === 'HP12INV');
    expect(hp12?.listPrice).toBe(26800); // 已更新
    expect(hp12?.model).toBe('HP-12 变频');
  });

  it('updateProduct 全字段局部更新 + 停用/启用', async () => {
    const p = await createProduct(TEST_TENANT, {
      series: '独立库系列',
      model: 'LIB-1',
      modelCode: 'LIB1',
      unit: '台',
      listPrice: 10000,
      costPrice: 6000,
      minPrice: 8000,
      source: 'manual',
    });

    // 局部更新: 只改价与规格, 不动 model
    const u1 = await updateProduct(TEST_TENANT, p.id, {
      listPrice: 9500,
      specification: '12kW',
      category: 'heat_pump',
    });
    expect(u1.listPrice).toBe(9500);
    expect(u1.specification).toBe('12kW');
    expect(u1.model).toBe('LIB-1'); // 未传 → 保留

    // 停用 → 默认(status=active)列表不含
    await updateProduct(TEST_TENANT, p.id, { status: 'archived' });
    const active = await listProducts({ tenantId: TEST_TENANT, status: 'active' });
    expect(active.find((x) => x.id === p.id)).toBeUndefined();

    // 全量列表仍含 (归档)
    const all = await listProducts({ tenantId: TEST_TENANT });
    expect(all.find((x) => x.id === p.id)?.status).toBe('archived');

    // 更新不存在 → 抛错
    await expect(updateProduct(TEST_TENANT, 'no_such_id', { listPrice: 1 })).rejects.toThrow(/not found/);
  });
});

// ============================================================================
// 报价定价洞察 · 破限价 / 异常低价 (真库 issued 报价 + catalog 限价)
// ============================================================================

function itemSystems(productCatalogId: string, model: string, unitPrice: number): QuoteSystem[] {
  return [
    {
      id: 'sys',
      name: '系统',
      subtotal: unitPrice,
      items: [
        { id: 'it', costType: 'equipment', productCatalogId, model, quantity: 1, listPrice: unitPrice, unitPrice, amount: unitPrice },
      ],
    },
  ];
}

describe.skipIf(!hasDb)('integration(db) · PMS 报价定价洞察', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('汇总已签发报价 → 破限价标 critical + 分产品统计', async () => {
    // 1. 导入一个带最低限价的产品
    await importProducts(TEST_TENANT, [
      { series: '洞察系列', model: 'INS-100', modelCode: 'INS100', category: 'heat_pump', unit: '台', listPrice: 1000, minPrice: 800 },
    ]);
    const prod = (await listProducts({ tenantId: TEST_TENANT })).find((p) => p.modelCode === 'INS100')!;
    expect(prod).toBeDefined();

    // 2. 三份独立报备(名称显著不同, 规避模糊查重)各签发一份报价, 单价 1000 / 1000 / 600 (600 破限价 800)
    const cases: Array<[string, number]> = [['华东医院项目', 1000], ['华南酒店项目', 1000], ['华北工厂项目', 600]];
    for (const [name, price] of cases) {
      const opp = await createOpportunity({
        tenantId: TEST_TENANT, orgId: ORG_A, dealerOrgId: ORG_A, reporterId: 'itest_sales_a',
        customerName: name, projectName: name, status: 'active',
      });
      expect(opp.opportunity).toBeDefined();
      const draft = await createQuote(
        { opportunityId: opp.opportunity!.id, title: `洞察-${price}`, customerName: 'C', systems: itemSystems(prod.id, 'INS-100', price) },
        INTERNAL_A,
      );
      await issueQuote(draft.id, INTERNAL_A);
    }

    // 3. 汇总
    const report = await assembleQuotePricingReport(TEST_TENANT);
    expect(report.quoteCount).toBe(3);
    const stat = report.productStats.find((s) => s.productKey === prod.id)!;
    expect(stat.count).toBe(3);
    expect(stat.median).toBe(1000);
    expect(stat.floor).toBe(800);

    const belowFloor = report.anomalies.filter((a) => a.type === 'below_floor');
    expect(belowFloor).toHaveLength(1);
    expect(belowFloor[0].severity).toBe('critical');
    expect(belowFloor[0].unitPrice).toBe(600);
  });

  it('P4 每日扫描: critical 异常低价 → 沉淀 quote_price_anomaly 告警 (dedup 幂等)', async () => {
    await importProducts(TEST_TENANT, [
      { series: '预警系列', model: 'ALERT-1', modelCode: 'ALERT1', category: 'heat_pump', unit: '台', listPrice: 1000, minPrice: 800 },
    ]);
    const prod = (await listProducts({ tenantId: TEST_TENANT })).find((p) => p.modelCode === 'ALERT1')!;

    // 一份破限价报价 (600 < 800)
    const opp = await createOpportunity({
      tenantId: TEST_TENANT, orgId: ORG_A, dealerOrgId: ORG_A, reporterId: 'itest_sales_a',
      customerName: '破线医院', projectName: '破线医院', status: 'active',
    });
    const draft = await createQuote(
      { opportunityId: opp.opportunity!.id, title: '破线', customerName: 'C', systems: itemSystems(prod.id, 'ALERT-1', 600) },
      INTERNAL_A,
    );
    await issueQuote(draft.id, INTERNAL_A);

    // 首次扫描 → 建 1 条告警
    const n1 = await scanQuotePricingAnomalies(TEST_TENANT);
    expect(n1).toBe(1);
    const alerts = await db
      .select()
      .from(pmsAlerts)
      .where(and(eq(pmsAlerts.tenantId, TEST_TENANT), eq(pmsAlerts.type, 'quote_price_anomaly')));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('high');
    expect(alerts[0].entityId).toBe(`${draft.id}:${prod.id}`);

    // 再次扫描 → dedup, 不重复建
    const n2 = await scanQuotePricingAnomalies(TEST_TENANT);
    expect(n2).toBe(0);
  });
});

// ============================================================================
// 选型配置器 (P3) · 规则集 CRUD + 发布 + runSelector(引擎+目录快照) + 权限
// ============================================================================

describe.skipIf(!hasDb)('integration(db) · PMS 选型配置器', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('创建/更新/发布 规则集; 外部不可写; 未发布外部不可见', async () => {
    const rs = await createRuleSet({ name: '商用热水选型', category: 'heat_pump' }, INTERNAL_A);
    expect(rs.status).toBe('draft');
    expect(rs.version).toBe(1);

    // 外部经销商不可写
    await expect(createRuleSet({ name: '外部越权' }, EXTERNAL_B)).rejects.toBeInstanceOf(Response);

    // 未发布 → 外部不可见
    expect(await getRuleSet(rs.id, EXTERNAL_B)).toBeNull();

    // 配置工况 + 规则后发布
    await updateRuleSet(
      rs.id,
      {
        inputFields: [{ key: 'demandPoints', label: '用水点数', type: 'number', required: true }],
        rules: [
          {
            id: 'r1',
            label: '主机',
            when: [],
            product: { matchBy: 'model', model: 'SEL-100' },
            quantity: { mode: 'perInput', inputField: 'demandPoints', divisor: 20, min: 1 },
          },
        ],
      },
      INTERNAL_A,
    );
    const published = await publishRuleSet(rs.id, INTERNAL_A);
    expect(published.status).toBe('published');
    expect(published.version).toBe(2);
    expect(published.publishedAt).toBeDefined();

    // 发布后 → 外部可见
    expect((await getRuleSet(rs.id, EXTERNAL_B))?.status).toBe('published');
    const list = await listRuleSets({ status: 'published' }, EXTERNAL_B);
    expect(list.find((x) => x.id === rs.id)).toBeDefined();
  });

  it('写权收窄: 内部普通 employee 不可维护; 且 update/publish/delete 均写 pms.selector.* 审计', async () => {
    // 普通 employee (isInternal 但非维护组) → 建/改/发/删 全 403
    await expect(createRuleSet({ name: '员工越权' }, INTERNAL_EMPLOYEE)).rejects.toBeInstanceOf(Response);

    const rs = await createRuleSet(
      {
        name: '审计留痕规则集',
        rules: [{ id: 'r1', when: [], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'fixed', value: 1 } }],
      },
      INTERNAL_A,
    );
    // employee 改别人已存在的规则集 → 403
    await expect(updateRuleSet(rs.id, { name: '改名越权' }, INTERNAL_EMPLOYEE)).rejects.toBeInstanceOf(Response);
    await expect(publishRuleSet(rs.id, INTERNAL_EMPLOYEE)).rejects.toBeInstanceOf(Response);
    await expect(deleteRuleSet(rs.id, INTERNAL_EMPLOYEE)).rejects.toBeInstanceOf(Response);

    // 维护组正常写 → 留痕
    await updateRuleSet(rs.id, { description: '补充说明' }, INTERNAL_A);
    await publishRuleSet(rs.id, INTERNAL_A);
    await deleteRuleSet(rs.id, INTERNAL_A);

    const log = getAuditLog();
    const updated = await log.list({ tenantId: TEST_TENANT, action: 'pms.selector.updated', targetId: rs.id });
    expect(updated.length).toBeGreaterThanOrEqual(1);
    expect(updated[0].actorId).toBe(INTERNAL_A.userId);
    const published = await log.list({ tenantId: TEST_TENANT, action: 'pms.selector.published', targetId: rs.id });
    expect(published.length).toBeGreaterThanOrEqual(1);
    expect(published[0].metadata?.version).toBe(2);
    const deleted = await log.list({ tenantId: TEST_TENANT, action: 'pms.selector.deleted', targetId: rs.id });
    expect(deleted.length).toBeGreaterThanOrEqual(1);
  });

  it('runSelector 载入目录快照并产出推荐系统; 未命中产品 fail-soft 告警', async () => {
    await createProduct(TEST_TENANT, {
      series: '选型系列', model: 'SEL-100', modelCode: 'SEL100', unit: '台', listPrice: 30000, source: 'manual',
    });
    const catProd = (await listProducts({ tenantId: TEST_TENANT })).find((p) => p.modelCode === 'SEL100')!;

    const rs = await createRuleSet(
      {
        name: '可运行规则集',
        systemName: '生活热水系统',
        inputFields: [{ key: 'demandPoints', label: '用水点数', type: 'number', required: true }],
        rules: [
          { id: 'r1', label: '主机', when: [], product: { matchBy: 'model', model: 'SEL-100' }, quantity: { mode: 'perInput', inputField: 'demandPoints', divisor: 20, min: 1 } },
          { id: 'r2', label: '缺件', when: [], product: { matchBy: 'model', model: 'GHOST', fallbackModel: '定制件' }, quantity: { mode: 'fixed', value: 1 } },
        ],
      },
      INTERNAL_A,
    );
    await publishRuleSet(rs.id, INTERNAL_A);

    const result = await runSelector(rs.id, { demandPoints: 60 }, INTERNAL_A);
    expect(result.system.name).toBe('生活热水系统');
    // 溯源: 推荐系统记录来源规则集/版本 (发布后 version=2)
    expect(result.system.sourceRuleSetId).toBe(rs.id);
    expect(result.system.sourceRuleSetVersion).toBe(2);
    expect(result.system.sourceRuleSetName).toBe('可运行规则集');
    const main = result.system.items.find((i) => i.model === 'SEL-100')!;
    expect(main).toBeDefined();
    expect(main.productCatalogId).toBe(catProd.id);
    expect(main.quantity).toBe(3); // ceil(60/20)
    expect(main.listPrice).toBe(30000);
    // 未命中产品 → 占位行 + 告警
    expect(result.warnings.some((w) => w.includes('未在产品目录命中'))).toBe(true);
    expect(result.system.items.find((i) => i.model === '定制件')).toBeDefined();
  });

  it('软删后不可见, runSelector 报错', async () => {
    const rs = await createRuleSet(
      { name: '待删规则集', rules: [{ id: 'r1', when: [], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'fixed', value: 1 } }] },
      INTERNAL_A,
    );
    await publishRuleSet(rs.id, INTERNAL_A);
    await deleteRuleSet(rs.id, INTERNAL_A);
    expect(await getRuleSet(rs.id, INTERNAL_A)).toBeNull();
    await expect(runSelector(rs.id, {}, INTERNAL_A)).rejects.toBeInstanceOf(Response);
  });

  it('配置校验: 畸形规则/字段被拒 (400)', async () => {
    // 规则引用了不存在的输入字段
    await expect(
      createRuleSet(
        {
          name: '坏引用',
          inputFields: [{ key: 'a', label: 'A', type: 'number' }],
          rules: [{ id: 'r1', when: [{ field: 'ghost', op: 'gte', value: 1 }], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'fixed', value: 1 } }],
        },
        INTERNAL_A,
      ),
    ).rejects.toBeInstanceOf(Response);
    // enum 缺 options
    await expect(
      createRuleSet(
        { name: '坏枚举', inputFields: [{ key: 'a', label: 'A', type: 'enum' }], rules: [] },
        INTERNAL_A,
      ),
    ).rejects.toBeInstanceOf(Response);
    // perInput 引用不存在字段
    await expect(
      createRuleSet(
        { name: '坏数量', rules: [{ id: 'r1', when: [], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'perInput', inputField: 'nope' } }] },
        INTERNAL_A,
      ),
    ).rejects.toBeInstanceOf(Response);
  });

  it('版本快照: 每次发布冻结一版; listRuleSetVersions 最新在前', async () => {
    const rs = await createRuleSet(
      { name: '多版规则集', rules: [{ id: 'r1', when: [], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'fixed', value: 1 } }] },
      INTERNAL_A,
    );
    await publishRuleSet(rs.id, INTERNAL_A); // v2
    await updateRuleSet(rs.id, { rules: [
      { id: 'r1', when: [], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'fixed', value: 2 } },
    ] }, INTERNAL_A);
    await publishRuleSet(rs.id, INTERNAL_A); // v3

    const versions = await listRuleSetVersions(rs.id, INTERNAL_A);
    expect(versions.map((v) => v.version)).toEqual([3, 2]);
    expect(versions[0].publishedBy).toBe(INTERNAL_A.userId);
    expect(versions[0].rules.length).toBe(1);
  });

  it('乐观锁: expectedUpdatedAt 过期 → 409', async () => {
    const rs = await createRuleSet(
      { name: '并发规则集', rules: [{ id: 'r1', when: [], product: { matchBy: 'model', model: 'X' }, quantity: { mode: 'fixed', value: 1 } }] },
      INTERNAL_A,
    );
    // 用一个陈旧的时间戳 → 冲突
    await expect(
      updateRuleSet(rs.id, { name: '改名', expectedUpdatedAt: '1999-01-01T00:00:00.000Z' }, INTERNAL_A),
    ).rejects.toBeInstanceOf(Response);
    // 用真实 updatedAt → 通过
    const fresh = await getRuleSet(rs.id, INTERNAL_A);
    const ok = await updateRuleSet(rs.id, { name: '改名OK', expectedUpdatedAt: fresh!.updatedAt }, INTERNAL_A);
    expect(ok.name).toBe('改名OK');
  });
});
