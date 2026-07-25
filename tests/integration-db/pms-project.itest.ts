/**
 * tests/integration-db/pms-project.itest.ts
 *
 * PMS 项目型销售骨架 (Phase 1) DB 集成测试 (opt-in, 真库).
 *   验证: 项目 CRUD + 阶段 FSM 守卫 + 干系人决策链 + 规格指定矩阵战况.
 *
 * 运行: npm run test:pms-integration  (需本地真库 localhost:5432 + .env.local DATABASE_URL)
 * 安全: 数据挂唯一租户 TEST_TENANT, beforeEach + afterAll 全清理.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/infra/drizzle-client';
import { pmsProjects, pmsProjectStakeholders, pmsSpecPositions } from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';

import {
  createProject,
  getProject,
  listProjects,
  transitionProjectStage,
  updateProject,
  archiveProject,
} from '@/lib/pms/project-service';
import {
  addStakeholder,
  listStakeholders,
  getDecisionChainHealth,
} from '@/lib/pms/project-stakeholder-service';
import {
  createSpecPosition,
  getSpecCoverage,
} from '@/lib/pms/spec-position-service';

const TEST_TENANT = '__pms_project_itest__';
const ORG_A = 'proj_org_a';
const ORG_B = 'proj_org_b';
const hasDb = !!process.env.DATABASE_URL;

async function cleanup(): Promise<void> {
  await db.delete(pmsSpecPositions).where(eq(pmsSpecPositions.tenantId, TEST_TENANT));
  await db.delete(pmsProjectStakeholders).where(eq(pmsProjectStakeholders.tenantId, TEST_TENANT));
  await db.delete(pmsProjects).where(eq(pmsProjects.tenantId, TEST_TENANT));
}

describe.skipIf(!hasDb)('integration(db) · PMS 项目型销售骨架', () => {
  beforeEach(async () => {
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
  });

  it('创建项目: 默认 lead/active, 自动生成 projectCode', async () => {
    const p = await createProject({
      tenantId: TEST_TENANT,
      orgId: ORG_A,
      projectName: '成都新都香城小学热水系统',
      region: '西南',
      estimatedValue: 2000000,
      createdBy: 'u1',
    });
    expect(p.stage).toBe('lead');
    expect(p.status).toBe('active');
    expect(p.projectCode).toMatch(/^PJ-\d{8}-/);
    expect(p.estimatedValue).toBe(2000000);

    const got = await getProject(TEST_TENANT, p.id);
    expect(got?.projectName).toBe('成都新都香城小学热水系统');
  });

  it('阶段 FSM: 合法推进派生 won; 非法流转抛错', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: 'FSM项目', createdBy: 'u1' });
    // lead → design → tender → awarded (awarded 派生 won)
    await transitionProjectStage({ tenantId: TEST_TENANT, id: p.id, toStage: 'design' });
    await transitionProjectStage({ tenantId: TEST_TENANT, id: p.id, toStage: 'tender' });
    const awarded = await transitionProjectStage({ tenantId: TEST_TENANT, id: p.id, toStage: 'awarded' });
    expect(awarded.stage).toBe('awarded');
    expect(awarded.status).toBe('won');

    // awarded → tender 非法
    await expect(
      transitionProjectStage({ tenantId: TEST_TENANT, id: p.id, toStage: 'tender' }),
    ).rejects.toThrow(/invalid project stage transition/);
  });

  it('列表隔离: visibleOrgIds 限定; 内部全通; 软删除排除', async () => {
    const pa = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: 'A项目', createdBy: 'u1' });
    await createProject({ tenantId: TEST_TENANT, orgId: ORG_B, projectName: 'B项目', createdBy: 'u1' });

    const onlyA = await listProjects({ tenantId: TEST_TENANT, visibleOrgIds: [ORG_A] });
    expect(onlyA.map((x) => x.projectName)).toEqual(['A项目']);

    const all = await listProjects({ tenantId: TEST_TENANT }); // 内部全通
    expect(all.length).toBe(2);

    await archiveProject(TEST_TENANT, pa.id);
    const afterArchive = await listProjects({ tenantId: TEST_TENANT });
    expect(afterArchive.map((x) => x.projectName)).toEqual(['B项目']);
  });

  it('更新项目基本字段', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '原名', createdBy: 'u1' });
    const updated = await updateProject({
      tenantId: TEST_TENANT,
      id: p.id,
      patch: { projectName: '新名', designInstitute: '中建西南院', estimatedValue: 500000 },
    });
    expect(updated.projectName).toBe('新名');
    expect(updated.designInstitute).toBe('中建西南院');
    expect(updated.estimatedValue).toBe(500000);
  });

  it('决策链: 关键角色齐 + 内线 + 经济决策人 → 完整度 100', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '决策链项目', createdBy: 'u1' });
    await addStakeholder({ tenantId: TEST_TENANT, projectId: p.id, role: 'owner', name: '甲方王总', isEconomicBuyer: true, createdBy: 'u1' });
    await addStakeholder({ tenantId: TEST_TENANT, projectId: p.id, role: 'design_engineer', name: '设计李工', isChampion: true, influence: 'high', createdBy: 'u1' });
    await addStakeholder({ tenantId: TEST_TENANT, projectId: p.id, role: 'installer', name: '安装商张总', createdBy: 'u1' });

    const list = await listStakeholders(TEST_TENANT, p.id);
    expect(list.length).toBe(3);

    const health = await getDecisionChainHealth(TEST_TENANT, p.id);
    expect(health.missingCriticalRoles).toEqual([]);
    expect(health.hasChampion).toBe(true);
    expect(health.hasEconomicBuyer).toBe(true);
    expect(health.completeness).toBe(100);
  });

  it('规格指定矩阵: 汇总 spec-in 战况 + winRate', async () => {
    const p = await createProject({ tenantId: TEST_TENANT, orgId: ORG_A, projectName: '规格项目', createdBy: 'u1' });
    await createSpecPosition({ tenantId: TEST_TENANT, projectId: p.id, equipmentFamily: '冷水机组', ourBrandStatus: 'basis_of_design', estimatedValue: 600000, createdBy: 'u1' });
    await createSpecPosition({ tenantId: TEST_TENANT, projectId: p.id, equipmentFamily: '空调箱', ourBrandStatus: 'specified', estimatedValue: 200000, createdBy: 'u1' });
    await createSpecPosition({ tenantId: TEST_TENANT, projectId: p.id, equipmentFamily: '防火阀', ourBrandStatus: 'alternate', estimatedValue: 200000, competitorBrand: '大金', createdBy: 'u1' });

    const cov = await getSpecCoverage(TEST_TENANT, p.id);
    expect(cov.totalPositions).toBe(3);
    expect(cov.wonValue).toBe(800000);
    expect(cov.atRiskValue).toBe(200000);
    expect(cov.totalValue).toBe(1000000);
    expect(cov.specWinRate).toBe(80);
    expect(cov.atRiskCount).toBe(1);
  });
});
