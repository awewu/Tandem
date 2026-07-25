/**
 * tests/integration-db/pms-performance-target.itest.ts
 *
 * PMS 业绩目标汇总引擎 (batch2) DB 集成测试 (opt-in, 真库).
 *   验证: 按 维度×周期 从真实商机聚合成交额/单数 + 达成率 + 同比/环比.
 *
 * 运行: npm run test:pms-integration  (需本地真库 localhost:5432 + .env.local DATABASE_URL)
 * 安全: 数据挂唯一租户 TEST_TENANT, beforeEach + afterAll 全清理.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/infra/drizzle-client';
import { pmsOpportunities, pmsPerformanceTargets } from '@/lib/infra/drizzle-schema';
import { eq } from 'drizzle-orm';

import {
  createTarget,
  rollupTarget,
  rollupAllTargets,
} from '@/lib/pms/performance-target-service';

const TEST_TENANT = '__pms_perf_itest__';
const ORG_A = 'perf_org_a';
const hasDb = !!process.env.DATABASE_URL;

async function cleanup(): Promise<void> {
  await db.delete(pmsPerformanceTargets).where(eq(pmsPerformanceTargets.tenantId, TEST_TENANT));
  await db.delete(pmsOpportunities).where(eq(pmsOpportunities.tenantId, TEST_TENANT));
}

let seq = 0;
/** 直插一条已成交/在跑商机, 精确控制 createdAt / 维度列 (绕过 createOpportunity 的 now 时间戳与查重) */
async function insertOpp(params: {
  status: string;
  amount: number;
  createdAt: Date;
  region?: string;
  channel?: string;
  productSeriesCode?: string;
  orgId?: string;
}): Promise<void> {
  seq += 1;
  const id = `perf_opp_${seq}`;
  await db.insert(pmsOpportunities).values({
    id,
    tenantId: TEST_TENANT,
    orgId: params.orgId ?? ORG_A,
    dealerOrgId: params.orgId ?? ORG_A,
    reporterId: 'perf_user_1',
    customerName: `客户${seq}`,
    projectName: `项目${seq}`,
    stage: 'contracted',
    status: params.status,
    estimatedAmount: params.amount.toString(),
    region: params.region,
    channel: params.channel,
    productSeriesCode: params.productSeriesCode,
    dedupeKey: `perf_dk_${seq}`,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  });
}

describe.skipIf(!hasDb)('integration(db) · PMS 业绩目标汇总引擎', () => {
  beforeEach(async () => {
    await cleanup();
    seq = 0;
  });
  afterAll(async () => {
    await cleanup();
  });

  it('region 维度月度: 聚合成交额/单数 + 达成率 + 同比环比', async () => {
    // 当期 2026-03 华东: 2 单成交 300000 + 200000 = 500000
    await insertOpp({ status: 'won', amount: 300000, region: '华东', createdAt: new Date(Date.UTC(2026, 2, 5)) });
    await insertOpp({ status: 'won', amount: 200000, region: '华东', createdAt: new Date(Date.UTC(2026, 2, 20)) });
    // 当期华东 active (未成交) → 不计入
    await insertOpp({ status: 'active', amount: 999999, region: '华东', createdAt: new Date(Date.UTC(2026, 2, 10)) });
    // 当期华北成交 → 维度过滤应排除
    await insertOpp({ status: 'won', amount: 500000, region: '华北', createdAt: new Date(Date.UTC(2026, 2, 12)) });
    // 环比基期 2026-02 华东: 400000
    await insertOpp({ status: 'won', amount: 400000, region: '华东', createdAt: new Date(Date.UTC(2026, 1, 15)) });
    // 同比基期 2025-03 华东: 250000
    await insertOpp({ status: 'won', amount: 250000, region: '华东', createdAt: new Date(Date.UTC(2025, 2, 15)) });

    const target = await createTarget({
      tenantId: TEST_TENANT,
      dimension: 'region',
      dimensionValue: '华东',
      period: '2026-03',
      periodType: 'monthly',
      targetType: 'revenue',
      targetValue: 1000000,
      createdBy: 'perf_user_1',
    });

    const rolled = await rollupTarget({ tenantId: TEST_TENANT, id: target.id });
    expect(rolled.actualValue).toBe(500000);
    expect(rolled.actualCount).toBe(2);
    expect(rolled.achievementRate).toBe(50); // 500000 / 1000000
    expect(rolled.yoyGrowth).toBe(100); // (500000-250000)/250000
    expect(rolled.momGrowth).toBe(25); // (500000-400000)/400000
  });

  it('org 维度无值: 租户全量聚合当期成交 (跨维度合计)', async () => {
    await insertOpp({ status: 'won', amount: 500000, region: '华东', createdAt: new Date(Date.UTC(2026, 2, 5)) });
    await insertOpp({ status: 'won', amount: 300000, region: '华北', createdAt: new Date(Date.UTC(2026, 2, 8)) });
    await insertOpp({ status: 'won', amount: 200000, region: '华南', createdAt: new Date(Date.UTC(2026, 2, 9)) });
    await insertOpp({ status: 'active', amount: 111111, region: '华东', createdAt: new Date(Date.UTC(2026, 2, 10)) });

    const target = await createTarget({
      tenantId: TEST_TENANT,
      dimension: 'org',
      period: '2026-03',
      periodType: 'monthly',
      targetType: 'revenue',
      targetValue: 2000000,
      createdBy: 'perf_user_1',
    });

    const rolled = await rollupTarget({ tenantId: TEST_TENANT, id: target.id });
    expect(rolled.actualValue).toBe(1000000); // 500000+300000+200000
    expect(rolled.actualCount).toBe(3);
    expect(rolled.achievementRate).toBe(50);
    expect(rolled.yoyGrowth).toBeUndefined(); // 无同比基期数据 → prev=0 → null → undefined
  });

  it('product_line 维度对齐 productSeriesCode; 季度周期聚合', async () => {
    // 2026 Q2 = 4-6 月; RH-HP 系列成交 2 单
    await insertOpp({ status: 'won', amount: 280000, productSeriesCode: 'RH-HP', createdAt: new Date(Date.UTC(2026, 3, 10)) });
    await insertOpp({ status: 'won', amount: 350000, productSeriesCode: 'RH-HP', createdAt: new Date(Date.UTC(2026, 5, 20)) });
    // 不同系列 → 排除
    await insertOpp({ status: 'won', amount: 120000, productSeriesCode: 'EH-WH', createdAt: new Date(Date.UTC(2026, 4, 1)) });
    // 季度外 (7 月) → 排除
    await insertOpp({ status: 'won', amount: 999999, productSeriesCode: 'RH-HP', createdAt: new Date(Date.UTC(2026, 6, 1)) });

    const target = await createTarget({
      tenantId: TEST_TENANT,
      dimension: 'product_line',
      dimensionValue: 'RH-HP',
      period: '2026-Q2',
      periodType: 'quarterly',
      targetType: 'revenue',
      targetValue: 700000,
      createdBy: 'perf_user_1',
    });

    const rolled = await rollupTarget({ tenantId: TEST_TENANT, id: target.id });
    expect(rolled.actualValue).toBe(630000); // 280000+350000
    expect(rolled.actualCount).toBe(2);
    expect(rolled.achievementRate).toBe(90); // 630000/700000
  });

  it('rollupAllTargets: 批量汇总匹配周期的全部目标', async () => {
    await insertOpp({ status: 'won', amount: 100000, region: '华东', createdAt: new Date(Date.UTC(2026, 2, 5)) });
    await insertOpp({ status: 'won', amount: 200000, region: '华北', createdAt: new Date(Date.UTC(2026, 2, 6)) });

    await createTarget({ tenantId: TEST_TENANT, dimension: 'region', dimensionValue: '华东', period: '2026-03', periodType: 'monthly', targetType: 'revenue', targetValue: 100000, createdBy: 'u' });
    await createTarget({ tenantId: TEST_TENANT, dimension: 'region', dimensionValue: '华北', period: '2026-03', periodType: 'monthly', targetType: 'revenue', targetValue: 400000, createdBy: 'u' });

    const rolled = await rollupAllTargets({ tenantId: TEST_TENANT, period: '2026-03', periodType: 'monthly' });
    expect(rolled).toHaveLength(2);
    const east = rolled.find((t) => t.dimensionValue === '华东')!;
    const north = rolled.find((t) => t.dimensionValue === '华北')!;
    expect(east.actualValue).toBe(100000);
    expect(east.achievementRate).toBe(100);
    expect(north.actualValue).toBe(200000);
    expect(north.achievementRate).toBe(50);
  });
});
