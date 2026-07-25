/**
 * tests/integration-db/pms-tender.itest.ts
 *
 * PMS 招投标 + 提交物 + 项目管道 (Phase 2) DB 集成测试 (opt-in, 真库).
 *
 * 运行: npm run test:pms-integration
 * 安全: 唯一租户 TEST_TENANT, beforeEach + afterAll 全清理.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/infra/drizzle-client';
import { pmsProjects, pmsTenders, pmsSubmittals, pmsOpportunities } from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';

import { createProject, getProjectPipeline } from '@/lib/pms/project-service';
import { linkOpportunityToProject } from '@/lib/pms/opportunity-service';
import {
  createTender,
  listTenders,
  transitionTender,
  createSubmittal,
  reviseSubmittal,
  reviewSubmittal,
  listSubmittals,
} from '@/lib/pms/tender-service';

const TEST_TENANT = '__pms_tender_itest__';
const ORG_A = 'tender_org_a';
const hasDb = !!process.env.DATABASE_URL;

async function cleanup(): Promise<void> {
  await db.delete(pmsSubmittals).where(eq(pmsSubmittals.tenantId, TEST_TENANT));
  await db.delete(pmsTenders).where(eq(pmsTenders.tenantId, TEST_TENANT));
  await db.delete(pmsOpportunities).where(eq(pmsOpportunities.tenantId, TEST_TENANT));
  await db.delete(pmsProjects).where(eq(pmsProjects.tenantId, TEST_TENANT));
}

let seq = 0;
async function insertOpp(projectId: string, stage: string, status: string, amount: number): Promise<string> {
  seq += 1;
  const id = `tender_opp_${seq}`;
  await db.insert(pmsOpportunities).values({
    id,
    tenantId: TEST_TENANT,
    orgId: ORG_A,
    dealerOrgId: ORG_A,
    projectId,
    reporterId: 'u1',
    customerName: `客户${seq}`,
    projectName: `报价${seq}`,
    stage,
    status,
    estimatedAmount: amount.toString(),
    dedupeKey: `tender_dk_${seq}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

describe.skipIf(!hasDb)('integration(db) · PMS 招投标 + 提交物 + 管道', () => {
  beforeEach(async () => {
    await cleanup();
    seq = 0;
  });
  afterAll(async () => {
    await cleanup();
  });

  it('招投标 FSM: preparing→submitted→opened→won, 自动打时间戳', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '招标项目', createdBy: 'u1' });
    const t = await createTender({
      tenantId: TEST_TENANT, projectId: p.id, tenderName: '一标段', tenderType: 'open',
      bidAmount: 900000, budgetAmount: 1000000, createdBy: 'u1',
    });
    expect(t.status).toBe('preparing');

    const submitted = await transitionTender({ tenantId: TEST_TENANT, id: t.id, toStatus: 'submitted' });
    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBeTruthy();

    const opened = await transitionTender({ tenantId: TEST_TENANT, id: t.id, toStatus: 'opened' });
    expect(opened.openedAt).toBeTruthy();

    const won = await transitionTender({ tenantId: TEST_TENANT, id: t.id, toStatus: 'won', ourRank: 1, winnerName: '我方' });
    expect(won.status).toBe('won');
    expect(won.ourRank).toBe(1);

    // 非法: won → lost
    await expect(
      transitionTender({ tenantId: TEST_TENANT, id: t.id, toStatus: 'lost' }),
    ).rejects.toThrow(/invalid tender status transition/);

    const list = await listTenders(TEST_TENANT, p.id);
    expect(list.length).toBe(1);
  });

  it('提交物版本管理: revise 自增版本 + supersedes; review 留痕', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '提交物项目', createdBy: 'u1' });
    const v1 = await createSubmittal({
      tenantId: TEST_TENANT, projectId: p.id, docType: 'technical_proposal', title: '技术方案', fileUrl: 'v1.pdf', createdBy: 'u1',
    });
    expect(v1.version).toBe(1);
    expect(v1.status).toBe('draft');

    const submitted = await reviewSubmittal({ tenantId: TEST_TENANT, id: v1.id, status: 'submitted', submittedTo: '甲方' });
    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).toBeTruthy();

    const rejected = await reviewSubmittal({ tenantId: TEST_TENANT, id: v1.id, status: 'revision_required', reviewedBy: 'reviewer', reviewNotes: '需修订' });
    expect(rejected.status).toBe('revision_required');
    expect(rejected.reviewedBy).toBe('reviewer');

    const v2 = await reviseSubmittal({ tenantId: TEST_TENANT, id: v1.id, fileUrl: 'v2.pdf', createdBy: 'u1' });
    expect(v2.version).toBe(2);
    expect(v2.supersedesId).toBe(v1.id);
    expect(v2.status).toBe('draft');

    const all = await listSubmittals(TEST_TENANT, p.id);
    expect(all.length).toBe(2); // 两个版本都保留
  });

  it('项目管道: 聚合归属商机加权预测', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '管道项目', createdBy: 'u1' });
    await insertOpp(p.id, 'bidding', 'active', 1000000); // 0.6 → 600000
    await insertOpp(p.id, 'won', 'won', 300000); // 300000
    await insertOpp(p.id, 'lost', 'lost', 999999); // 0

    const pipe = await getProjectPipeline(TEST_TENANT, p.id);
    expect(pipe.opportunityCount).toBe(3);
    expect(pipe.wonValue).toBe(300000);
    expect(pipe.weightedValue).toBe(900000); // 600000 + 300000
  });

  it('link/unlink 商机到项目: 影响管道归属', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '关联项目', createdBy: 'u1' });
    const oppId = await insertOpp('', 'negotiation', 'active', 500000); // 先不挂项目 (projectId='')

    let pipe = await getProjectPipeline(TEST_TENANT, p.id);
    expect(pipe.opportunityCount).toBe(0);

    await linkOpportunityToProject(oppId, p.id, TEST_TENANT);
    pipe = await getProjectPipeline(TEST_TENANT, p.id);
    expect(pipe.opportunityCount).toBe(1);
    expect(pipe.weightedValue).toBe(400000); // 500000 * 0.8

    await linkOpportunityToProject(oppId, null, TEST_TENANT);
    pipe = await getProjectPipeline(TEST_TENANT, p.id);
    expect(pipe.opportunityCount).toBe(0);
  });
});
