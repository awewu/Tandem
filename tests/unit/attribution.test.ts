/**
 * tests/unit/attribution.test.ts · #11 学习归因 pass (P0 · 2026-07-20)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { runAttributionPass, listAttributions } from '@/lib/persona/attribution';

beforeEach(() => setStore(createInMemoryStore()));

const DAY = 24 * 60 * 60 * 1000;

async function seedReport(proposalOver: Record<string, unknown> = {}, reportAgeDays = 10): Promise<string> {
  const createdAt = new Date(Date.now() - reportAgeDays * DAY).toISOString();
  const report = {
    id: `cbref_${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    tenantId: 'default',
    windowStart: createdAt,
    windowEnd: new Date().toISOString(),
    versionId: 'cbv_v1_seed',
    metricsSummary: {},
    strengths: [],
    failurePatterns: [],
    proposedChanges: { rationale: '' },
    approvalStatus: 'pending',
    optimizationProposals: [
      {
        id: 'okropt_kr1',
        kind: 'kr_at_risk',
        title: '承压 KR',
        targetType: 'key_result',
        targetId: 'kr1',
        metrics: { progressPct: 20, confidence: 'at-risk' },
        recommendation: 'x',
        rationale: 'y',
        status: 'acknowledged',
        ...proposalOver,
      },
    ],
  };
  await getStore().companyBrainReflections.create(report as never);
  return report.createdAt;
}

async function seedCheckIn(reportCreatedAt: string, offsetDays: number, before: number, after: number): Promise<void> {
  await getStore().checkIns.create({
    id: `ci_${Math.random().toString(36).slice(2, 8)}`,
    scope: 'kr',
    scopeId: 'kr1',
    authorId: 'u1',
    progressBefore: before,
    progressAfter: after,
    confidenceBefore: 'at-risk',
    confidenceAfter: 'on-track',
    createdAt: new Date(new Date(reportCreatedAt).getTime() + offsetDays * DAY).toISOString(),
  } as never);
}

describe('runAttributionPass', () => {
  it('acknowledged 预警 + 窗口内 KR 改善 → positive', async () => {
    const rc = await seedReport();
    await seedCheckIn(rc, 1, 0.2, 0.3);
    await seedCheckIn(rc, 5, 0.3, 0.6);

    const s = await runAttributionPass({ windowDays: 30 });
    expect(s.samples).toBe(1);
    expect(s.positive).toBe(1);

    const attribs = await listAttributions();
    expect(attribs).toHaveLength(1);
    expect(attribs[0].verdict).toBe('positive');
    expect(attribs[0].sourceType).toBe('okr_proposal');
    expect(attribs[0].progressDelta).toBeCloseTo(0.4, 5);
  });

  it('窗口内进度倒退 → negative', async () => {
    const rc = await seedReport();
    await seedCheckIn(rc, 1, 0.5, 0.5);
    await seedCheckIn(rc, 8, 0.5, 0.4);
    const s = await runAttributionPass({ windowDays: 30 });
    expect(s.negative).toBe(1);
  });

  it('窗口内无 check-in → insufficient_data', async () => {
    await seedReport();
    const s = await runAttributionPass({ windowDays: 30 });
    expect(s.samples).toBe(1);
    expect(s.insufficient).toBe(1);
  });

  it('未 acknowledged 的提议 → 不归因', async () => {
    await seedReport({ status: 'pending' });
    const s = await runAttributionPass({ windowDays: 30 });
    expect(s.samples).toBe(0);
  });

  it('幂等: 重复跑不重复落', async () => {
    const rc = await seedReport();
    await seedCheckIn(rc, 1, 0.2, 0.6);
    await runAttributionPass({ windowDays: 30 });
    const s2 = await runAttributionPass({ windowDays: 30 });
    expect(s2.samples).toBe(0);
    expect(await listAttributions()).toHaveLength(1);
  });
});
