/**
 * tests/integration-db/pms.itest.ts
 *
 * PMS 关键路径 DB 集成测试 (opt-in, 真库).
 *   补 docs/PMS-STATUS.md §3 D1 缺口: 173 纯函数单测未覆盖 CRUD/查询/orgId 隔离的真 SQL 路径。
 *
 * 运行: npm run test:pms-integration  (需本地真库 localhost:5432 在线 + .env.local DATABASE_URL)
 * 安全: 所有数据挂唯一租户 TEST_TENANT, beforeAll + afterAll 全清理, 不触碰其它租户数据。
 * 不在默认 `npm test` / pre-commit 内 (文件名 *.itest.ts 不匹配默认 glob)。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/infra/drizzle-client';
import {
  pmsOpportunities,
  pmsFollowUps,
  pmsDuplicateChecks,
  pmsPublicPool,
  pmsAlerts,
  pmsDealerQualifications,
  pmsEquipmentSns,
} from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';

import {
  createOpportunity,
  getOpportunity,
  listOpportunities,
  updateOpportunity,
  archiveOpportunity,
} from '@/lib/pms/opportunity-service';
import { createFollowUp, getOpportunityFollowUps } from '@/lib/pms/follow-up-service';
import { checkDuplicate } from '@/lib/pms/duplicate-check';
import { releaseToPool, claimFromPool, listPublicPool } from '@/lib/pms/public-pool-service';
import { runPmsDailyScan } from '@/lib/pms/cron-service';
import { getOpportunityAnalytics } from '@/lib/pms/analytics-service';

const TEST_TENANT = '__pms_itest__';
const ORG_A = 'itest_org_a';
const ORG_B = 'itest_org_b';
const hasDb = !!process.env.DATABASE_URL;

/** 清空本测试租户在所有涉及表的数据 (幂等) */
async function cleanup(): Promise<void> {
  await db.delete(pmsFollowUps).where(eq(pmsFollowUps.tenantId, TEST_TENANT));
  await db.delete(pmsDuplicateChecks).where(eq(pmsDuplicateChecks.tenantId, TEST_TENANT));
  await db.delete(pmsPublicPool).where(eq(pmsPublicPool.tenantId, TEST_TENANT));
  await db.delete(pmsAlerts).where(eq(pmsAlerts.tenantId, TEST_TENANT));
  await db.delete(pmsDealerQualifications).where(eq(pmsDealerQualifications.tenantId, TEST_TENANT));
  await db.delete(pmsEquipmentSns).where(eq(pmsEquipmentSns.tenantId, TEST_TENANT));
  await db.delete(pmsOpportunities).where(eq(pmsOpportunities.tenantId, TEST_TENANT));
}

function baseOppInput(overrides: Partial<Parameters<typeof createOpportunity>[0]> = {}) {
  return {
    tenantId: TEST_TENANT,
    orgId: ORG_A,
    dealerOrgId: ORG_A,
    reporterId: 'itest_user_1',
    customerName: '北京星光酒店管理有限公司',
    customerPhone: '13800138000',
    customerAddress: '北京市朝阳区建国路88号',
    projectName: '星光酒店中央空调采购项目',
    ...overrides,
  };
}

describe.skipIf(!hasDb)('integration(db) · PMS 关键路径', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  it('商机 CRUD roundtrip: create → get → list → update → archive', async () => {
    const { opportunity, duplicateCheck } = await createOpportunity(baseOppInput());
    expect(duplicateCheck).toBeUndefined();
    expect(opportunity).toBeDefined();
    const id = opportunity!.id;

    // get 回读
    const got = (await getOpportunity(id, TEST_TENANT))!;
    expect(got).not.toBeNull();
    expect(got.customerName).toBe('北京星光酒店管理有限公司');
    expect(got.stage).toBe('initial_contact');
    expect(got.status).toBe('active');

    // list 命中
    const list = await listOpportunities({ tenantId: TEST_TENANT });
    expect(list.map((o) => o.id)).toContain(id);

    // update 生效
    await updateOpportunity(id, { stage: 'quoted', estimatedAmount: 250000 }, TEST_TENANT);
    const afterUpdate = (await getOpportunity(id, TEST_TENANT))!;
    expect(afterUpdate.stage).toBe('quoted');
    expect(afterUpdate.estimatedAmount).toBe(250000);

    // archive 软删 → list 不再返回
    await archiveOpportunity(id, TEST_TENANT);
    const afterArchive = await listOpportunities({ tenantId: TEST_TENANT });
    expect(afterArchive.map((o) => o.id)).not.toContain(id);
    // get 仍可读到 (软删不物理删除)
    const stillReadable = (await getOpportunity(id, TEST_TENANT))!;
    expect(stillReadable).not.toBeNull();
    expect(stillReadable.archivedAt).toBeDefined();
  });

  it('orgId 隔离: 外部经销商 visibleOrgIds 过滤跨组织商机', async () => {
    const { opportunity } = await createOpportunity(baseOppInput({ orgId: ORG_A, dealerOrgId: ORG_A }));
    const id = opportunity!.id;

    // 可见 ORG_A → 命中
    const visibleToA = await listOpportunities({ tenantId: TEST_TENANT, visibleOrgIds: [ORG_A] });
    expect(visibleToA.map((o) => o.id)).toContain(id);
    expect(await getOpportunity(id, TEST_TENANT, [ORG_A])).not.toBeNull();

    // 仅可见 ORG_B → 隔离 (list 空 + get 返回 null)
    const visibleToB = await listOpportunities({ tenantId: TEST_TENANT, visibleOrgIds: [ORG_B] });
    expect(visibleToB.map((o) => o.id)).not.toContain(id);
    expect(await getOpportunity(id, TEST_TENANT, [ORG_B])).toBeNull();

    // 内部角色 (visibleOrgIds undefined) → 全通
    expect(await getOpportunity(id, TEST_TENANT, undefined)).not.toBeNull();
  });

  it('智能查重: 完全相同的第二次报备被判 duplicate 并阻断', async () => {
    const first = await createOpportunity(baseOppInput());
    expect(first.opportunity).toBeDefined();

    // 完全相同 → 五维 (名/址/话/项目) 累计 0.85 ≥ 0.80 → duplicate
    const second = await createOpportunity(baseOppInput({ reporterId: 'itest_user_2' }));
    expect(second.opportunity).toBeUndefined();
    expect(second.duplicateCheck?.status).toBe('duplicate');

    // 只创建了 1 个商机
    const list = await listOpportunities({ tenantId: TEST_TENANT });
    expect(list).toHaveLength(1);

    // 查重记录已落库
    const checks = await db
      .select()
      .from(pmsDuplicateChecks)
      .where(eq(pmsDuplicateChecks.tenantId, TEST_TENANT));
    expect(checks.length).toBeGreaterThanOrEqual(1);
  });

  it('智能查重: 完全无关的报备判 pass', async () => {
    await createOpportunity(baseOppInput());
    const res = await checkDuplicate({
      tenantId: TEST_TENANT,
      customerName: '上海东方厨具股份',
      customerAddress: '上海市浦东新区世纪大道1号',
      customerPhone: '13900139000',
      projectName: '东方工厂食堂设备',
    });
    expect(res.status).toBe('pass');
  });

  it('跟进记录: createFollowUp 更新商机 lastFollowUpAt', async () => {
    const { opportunity } = await createOpportunity(baseOppInput());
    const id = opportunity!.id;

    const before = (await getOpportunity(id, TEST_TENANT))!;
    expect(before.lastFollowUpAt).toBeUndefined();

    await createFollowUp({
      tenantId: TEST_TENANT,
      opportunityId: id,
      userId: 'itest_user_1',
      stage: 'following',
      content: '已电话联系客户, 约定下周现场勘查',
    });

    const after = (await getOpportunity(id, TEST_TENANT))!;
    expect(after.lastFollowUpAt).toBeDefined();

    const history = await getOpportunityFollowUps(id, TEST_TENANT);
    expect(history).toHaveLength(1);
    expect(history[0].content).toContain('现场勘查');
  });

  it('公海池: releaseToPool → listPublicPool → claimFromPool 改归属', async () => {
    const { opportunity } = await createOpportunity(baseOppInput({ orgId: ORG_A, dealerOrgId: ORG_A }));
    const oppId = opportunity!.id;

    // 释放到公海 (无保护期, 立即可认领)
    const rel = await releaseToPool({
      tenantId: TEST_TENANT,
      opportunityId: oppId,
      releasedBy: 'itest_user_1',
      releasedReason: 'manual_release',
      protectionDays: 0,
    });
    expect(rel.alreadyInPool).toBe(false);

    // 幂等: 再次释放返回同条目
    const rel2 = await releaseToPool({
      tenantId: TEST_TENANT,
      opportunityId: oppId,
      releasedBy: 'itest_user_1',
      releasedReason: 'manual_release',
    });
    expect(rel2.alreadyInPool).toBe(true);
    expect(rel2.poolEntryId).toBe(rel.poolEntryId);

    // 商机状态变为 released → 默认 list (未过滤 status) 仍含; 公海列表命中
    const pool = await listPublicPool({ tenantId: TEST_TENANT });
    expect(pool.map((p) => p.opportunityId)).toContain(oppId);

    // ORG_B 认领 → 商机改归属 ORG_B + 重新激活
    const claim = await claimFromPool({
      tenantId: TEST_TENANT,
      poolEntryId: rel.poolEntryId,
      claimerUserId: 'itest_user_b',
      claimerOrgId: ORG_B,
    });
    expect(claim.opportunityId).toBe(oppId);

    const reassigned = (await getOpportunity(oppId, TEST_TENANT))!;
    expect(reassigned.orgId).toBe(ORG_B);
    expect(reassigned.status).toBe('active');

    // 已认领 → 默认公海列表 (仅未认领) 不再返回
    const poolAfter = await listPublicPool({ tenantId: TEST_TENANT });
    expect(poolAfter.map((p) => p.opportunityId)).not.toContain(oppId);
  });

  it('每日扫描 smoke: runPmsDailyScan 不抛错并返回结构', async () => {
    await createOpportunity(baseOppInput());
    const summary = await runPmsDailyScan(TEST_TENANT);
    expect(summary).toMatchObject({
      poolReleased: expect.any(Number),
      poolWarned: expect.any(Number),
      qualificationAlerts: expect.any(Number),
      warrantyAlerts: expect.any(Number),
      escalated: expect.any(Number),
    });
  });

  it('分析看板: SQL group by 聚合 (状态/阶段/区域/管道/赢单率)', async () => {
    // active 100000 (北京, initial_contact)
    await createOpportunity(baseOppInput({
      customerName: '甲公司', projectName: '甲项目', region: '北京', stage: 'initial_contact',
      status: 'active', estimatedAmount: 100000,
    }));
    // active 250000 (上海, quoted)
    await createOpportunity(baseOppInput({
      customerName: '乙公司', projectName: '乙项目', region: '上海', stage: 'quoted',
      status: 'active', estimatedAmount: 250000,
    }));
    // won 300000 (北京, closed)
    await createOpportunity(baseOppInput({
      customerName: '丙公司', projectName: '丙项目', region: '北京', stage: 'closed',
      status: 'won', estimatedAmount: 300000,
    }));

    const a = await getOpportunityAnalytics({ tenantId: TEST_TENANT });
    expect(a.total).toBe(3);
    expect(a.byStatus.active).toBe(2);
    expect(a.byStatus.won).toBe(1);
    expect(a.totalPipeline).toBe(350000); // 仅 active 金额合计
    expect(a.wonAmount).toBe(300000);
    expect(a.won).toBe(1);
    expect(a.lost).toBe(0);
    expect(a.winRate).toBe(100);
    expect(a.byRegion['北京']).toBe(2);
    expect(a.byRegion['上海']).toBe(1);
    // 漏斗按标准阶段顺序
    const initial = a.funnel.find((f) => f.stage === 'initial_contact')!;
    expect(initial.count).toBe(1);

    // orgId 隔离下的聚合: 仅可见 ORG_B → 全空
    const b = await getOpportunityAnalytics({ tenantId: TEST_TENANT, visibleOrgIds: [ORG_B] });
    expect(b.total).toBe(0);
    expect(b.totalPipeline).toBe(0);
  });
});
