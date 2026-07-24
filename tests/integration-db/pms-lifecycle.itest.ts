/**
 * tests/integration-db/pms-lifecycle.itest.ts
 *
 * PMS L2C + FSM 生命周期 DB 集成测试 (opt-in, 真库).
 *   扩展 D1 覆盖: 合同→交付工单→交付任务 / 设备SN全生命周期 / 维保FSM。
 *
 * 运行: npm run test:pms-integration  (需本地真库 localhost:5432)
 * 安全: 唯一租户 TEST_TENANT + 全清理, 不触碰其它租户。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/infra/drizzle-client';
import {
  pmsOpportunities,
  pmsContracts,
  pmsDeliveryOrders,
  pmsDeliveryTasks,
  pmsEquipmentSns,
  pmsMaintenanceRecords,
  pmsAlerts,
} from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';

import { createOpportunity } from '@/lib/pms/opportunity-service';
import {
  createContract,
  approveContract,
  rejectContract,
  getContract,
  listContracts,
} from '@/lib/pms/contract-service';
import {
  listDeliveryOrders,
  getDeliveryOrder,
  transitionDeliveryOrder,
  createDeliveryTask,
  listDeliveryTasks,
  completeDeliveryTask,
} from '@/lib/pms/delivery-order-service';
import {
  registerSN,
  getSN,
  getSNByCode,
  transitionSN,
  listChildSNs,
} from '@/lib/pms/equipment-sn-service';
import {
  createMaintenance,
  assignMaintenance,
  transitionMaintenance,
  getMaintenance,
} from '@/lib/pms/maintenance-service';

const TEST_TENANT = '__pms_itest_lc__';
const ORG_A = 'itest_lc_org_a';
const ORG_B = 'itest_lc_org_b';
const hasDb = !!process.env.DATABASE_URL;

async function cleanup(): Promise<void> {
  await db.delete(pmsDeliveryTasks).where(eq(pmsDeliveryTasks.tenantId, TEST_TENANT));
  await db.delete(pmsDeliveryOrders).where(eq(pmsDeliveryOrders.tenantId, TEST_TENANT));
  await db.delete(pmsContracts).where(eq(pmsContracts.tenantId, TEST_TENANT));
  await db.delete(pmsMaintenanceRecords).where(eq(pmsMaintenanceRecords.tenantId, TEST_TENANT));
  await db.delete(pmsEquipmentSns).where(eq(pmsEquipmentSns.tenantId, TEST_TENANT));
  await db.delete(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
  await db.delete(pmsOpportunities).where(eq(pmsOpportunities.tenantId, TEST_TENANT));
}

/** 建一个商机 (合同交付工单需从中取 orgId/address) */
async function seedOpportunity(orgId = ORG_A): Promise<string> {
  const { opportunity } = await createOpportunity({
    tenantId: TEST_TENANT,
    orgId,
    dealerOrgId: orgId,
    reporterId: 'itest_lc_user',
    customerName: `客户_${orgId}_${Math.random().toString(36).slice(2, 8)}`,
    customerAddress: '某市某区某路1号',
    projectName: `项目_${Math.random().toString(36).slice(2, 8)}`,
  });
  return opportunity!.id;
}

describe.skipIf(!hasDb)('integration(db) · PMS 合同生命周期', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('createContract → approveContract 生效并自动创建交付工单', async () => {
    const oppId = await seedOpportunity(ORG_A);
    const contract = await createContract({
      tenantId: TEST_TENANT,
      opportunityId: oppId,
      customerName: '星光酒店',
      totalAmount: 500000,
    });
    expect(contract.status).toBe('draft');

    const res = await approveContract({
      tenantId: TEST_TENANT,
      contractId: contract.id,
      approverId: 'itest_approver',
    });
    expect(res.status).toBe('approved');
    expect(res.effectiveDate).toBeDefined();
    expect(res.deliveryOrder.alreadyExists).toBe(false);

    // 合同已生效
    const got = await getContract(contract.id, TEST_TENANT);
    expect(got.status).toBe('approved');
    expect(got.approvedBy).toBe('itest_approver');

    // 交付工单自动创建, orgId 取自商机
    const orders = await listDeliveryOrders({ tenantId: TEST_TENANT });
    expect(orders).toHaveLength(1);
    expect(orders[0].contractId).toBe(contract.id);
    expect(orders[0].orgId).toBe(ORG_A);
    expect(orders[0].status).toBe('pending');

    // 排产告警已埋点
    const alerts = await db.select().from(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
    expect(alerts.some((a) => a.type === 'contract_approved')).toBe(true);
  });

  it('approveContract 幂等: 二次审批已生效合同被拒 (状态机守卫)', async () => {
    const oppId = await seedOpportunity();
    const contract = await createContract({
      tenantId: TEST_TENANT, opportunityId: oppId, customerName: 'X', totalAmount: 1000,
    });
    await approveContract({ tenantId: TEST_TENANT, contractId: contract.id, approverId: 'a' });
    await expect(
      approveContract({ tenantId: TEST_TENANT, contractId: contract.id, approverId: 'a' }),
    ).rejects.toThrow(/not approvable/);
  });

  it('rejectContract 驳回 → 不产生交付工单', async () => {
    const oppId = await seedOpportunity();
    const contract = await createContract({
      tenantId: TEST_TENANT, opportunityId: oppId, customerName: 'Y', totalAmount: 2000,
    });
    const res = await rejectContract({ tenantId: TEST_TENANT, contractId: contract.id, approverId: 'a' });
    expect(res.status).toBe('rejected');
    const orders = await listDeliveryOrders({ tenantId: TEST_TENANT });
    expect(orders).toHaveLength(0);
  });
});

describe.skipIf(!hasDb)('integration(db) · PMS 交付工单 FSM', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  async function seedApprovedOrderId(orgId = ORG_A): Promise<string> {
    const oppId = await seedOpportunity(orgId);
    const contract = await createContract({
      tenantId: TEST_TENANT, opportunityId: oppId, customerName: 'C', totalAmount: 100,
    });
    const res = await approveContract({ tenantId: TEST_TENANT, contractId: contract.id, approverId: 'a' });
    return res.deliveryOrder.id;
  }

  it('工单状态机: pending → scheduled → delivered → completed', async () => {
    const orderId = await seedApprovedOrderId();

    const t1 = await transitionDeliveryOrder({
      tenantId: TEST_TENANT, orderId, toStatus: 'scheduled', scheduledDeliveryDate: '2026-08-01',
    });
    expect(t1.to).toBe('scheduled');

    const t2 = await transitionDeliveryOrder({ tenantId: TEST_TENANT, orderId, toStatus: 'delivered' });
    expect(t2.to).toBe('delivered');
    expect(t2.actualDeliveryDate).toBeDefined();

    const t3 = await transitionDeliveryOrder({ tenantId: TEST_TENANT, orderId, toStatus: 'completed' });
    expect(t3.to).toBe('completed');
  });

  it('工单非法流转被拒: pending → completed', async () => {
    const orderId = await seedApprovedOrderId();
    await expect(
      transitionDeliveryOrder({ tenantId: TEST_TENANT, orderId, toStatus: 'completed' }),
    ).rejects.toThrow(/illegal transition/);
  });

  it('工单 orgId 隔离: 仅可见 ORG_B 看不到 ORG_A 工单', async () => {
    const orderId = await seedApprovedOrderId(ORG_A);
    expect(await getDeliveryOrder(orderId, TEST_TENANT, [ORG_B])).toBeNull();
    expect(await getDeliveryOrder(orderId, TEST_TENANT, [ORG_A])).not.toBeNull();
    const listB = await listDeliveryOrders({ tenantId: TEST_TENANT, visibleOrgIds: [ORG_B] });
    expect(listB.map((o) => o.id)).not.toContain(orderId);
  });

  it('交付任务: create → list → complete', async () => {
    const orderId = await seedApprovedOrderId();
    const task = await createDeliveryTask({
      tenantId: TEST_TENANT,
      deliveryOrderId: orderId,
      type: 'installation',
      assignedTo: 'itest_installer',
      assigneeType: 'dealer',
      description: '现场安装中央空调主机',
      dueDate: '2026-08-05',
    });
    expect(task.status).toBe('pending');

    const list = await listDeliveryTasks({ tenantId: TEST_TENANT, deliveryOrderId: orderId });
    expect(list).toHaveLength(1);

    const done = await completeDeliveryTask({ tenantId: TEST_TENANT, taskId: task.id });
    expect(done.status).toBe('completed');
    expect(done.completedAt).toBeDefined();
  });
});

describe.skipIf(!hasDb)('integration(db) · PMS 设备 SN 生命周期', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('registerSN → shipped → installed 计算保修到期', async () => {
    const sn = await registerSN({
      tenantId: TEST_TENANT,
      snCode: 'SN-ITEST-0001',
      productId: 'prod_1',
      productModel: 'HVAC-X100',
      batchNumber: 'BATCH-A',
    });
    expect(sn.status).toBe('in_stock');

    const t1 = await transitionSN({
      tenantId: TEST_TENANT, snId: sn.id, toStatus: 'shipped', deliveryOrderId: 'do_x',
    });
    expect(t1.to).toBe('shipped');
    expect(t1.deliveryOrderId).toBe('do_x');

    const t2 = await transitionSN({
      tenantId: TEST_TENANT, snId: sn.id, toStatus: 'installed', installedAt: '2026-01-15', warrantyMonths: 24,
    });
    expect(t2.to).toBe('installed');
    expect(t2.warrantyExpiresAt).toBe('2028-01-15');

    // 按 SN 码回读
    const byCode = await getSNByCode('SN-ITEST-0001', TEST_TENANT);
    expect(byCode.id).toBe(sn.id);
    expect(byCode.warrantyExpiresAt).toBe('2028-01-15');
  });

  it('registerSN 重复 snCode 抛错 (唯一约束)', async () => {
    await registerSN({
      tenantId: TEST_TENANT, snCode: 'SN-DUP', productId: 'p', productModel: 'M',
    });
    await expect(
      registerSN({ tenantId: TEST_TENANT, snCode: 'SN-DUP', productId: 'p', productModel: 'M' }),
    ).rejects.toThrow(/already exists/);
  });

  it('SN 非法流转被拒: in_stock → installed', async () => {
    const sn = await registerSN({
      tenantId: TEST_TENANT, snCode: 'SN-ITEST-ILLEGAL', productId: 'p', productModel: 'M',
    });
    await expect(
      transitionSN({ tenantId: TEST_TENANT, snId: sn.id, toStatus: 'installed' }),
    ).rejects.toThrow(/illegal SN transition/);
  });

  it('父子 SN 资产层级: listChildSNs', async () => {
    const parent = await registerSN({
      tenantId: TEST_TENANT, snCode: 'SN-PARENT', productId: 'p', productModel: 'MainUnit',
    });
    await registerSN({
      tenantId: TEST_TENANT, snCode: 'SN-CHILD-1', productId: 'c1', productModel: 'Compressor', parentSNId: parent.id,
    });
    await registerSN({
      tenantId: TEST_TENANT, snCode: 'SN-CHILD-2', productId: 'c2', productModel: 'Fan', parentSNId: parent.id,
    });
    const children = await listChildSNs(parent.id, TEST_TENANT);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.snCode).sort()).toEqual(['SN-CHILD-1', 'SN-CHILD-2']);
  });
});

describe.skipIf(!hasDb)('integration(db) · PMS 维保 FSM', () => {
  beforeAll(cleanup);
  afterAll(cleanup);
  beforeEach(cleanup);

  it('维保闭环: create(pending) → assign → in_progress → completed', async () => {
    const rec = await createMaintenance({
      tenantId: TEST_TENANT,
      equipmentSNId: 'sn_x',
      type: 'repair',
      reportedBy: 'itest_customer',
      description: '空调不制冷',
    });
    expect(rec.status).toBe('pending');

    // 报修埋点告警
    const alerts = await db.select().from(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
    expect(alerts.some((a) => a.type === 'maintenance_reported')).toBe(true);

    const a = await assignMaintenance({ tenantId: TEST_TENANT, id: rec.id, assignedTo: 'itest_tech' });
    expect(a.status).toBe('assigned');

    const p = await transitionMaintenance({ tenantId: TEST_TENANT, id: rec.id, toStatus: 'in_progress' });
    expect(p.to).toBe('in_progress');

    const c = await transitionMaintenance({
      tenantId: TEST_TENANT, id: rec.id, toStatus: 'completed', customerFeedback: '已修复, 满意',
    });
    expect(c.to).toBe('completed');
    expect(c.completedAt).toBeDefined();

    const got = await getMaintenance(rec.id, TEST_TENANT);
    expect(got.customerFeedback).toBe('已修复, 满意');
  });

  it('维保非法流转被拒: pending → completed (跳过派工)', async () => {
    const rec = await createMaintenance({
      tenantId: TEST_TENANT, equipmentSNId: 'sn_y', type: 'maintenance', reportedBy: 'u', description: '保养',
    });
    await expect(
      transitionMaintenance({ tenantId: TEST_TENANT, id: rec.id, toStatus: 'completed' }),
    ).rejects.toThrow(/illegal maintenance transition/);
  });
});
