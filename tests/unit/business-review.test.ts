/**
 * tests/unit/business-review.test.ts · 月度经营回顾 锁
 *
 *   1. 无 active cycle → 空 summary, markdown 仍有结构 (fail-soft)
 *   2. 有 cycle + 3 objectives 分桶 (onTrack/atRisk/behind) 正确
 *   3. behind ≥ 1 → suggestedTopics 含 high severity "目标已落后"
 *   4. decisions 按 convergenceState 分桶 (COMMIT/VETOED/CONVERGING)
 *   5. markdown 包含核心段标题
 *   6. windowDays 过滤决议
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { generateMonthlyBusinessReview } from '@/lib/persona/business-review';
import type { Cycle, Objective, KeyResult } from '@/lib/types/okr-tti';
import type { DecisionCard } from '@/lib/types/decision-card';

const NOW = new Date('2026-06-15T12:00:00Z').getTime();
const DAYS_AGO = (n: number) => new Date(NOW - n * 86400_000).toISOString();

function makeCycle(over: Partial<Cycle> = {}): Cycle {
  return {
    id: 'cyc_q2',
    name: '2026 Q2',
    period: 'quarter',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    isActive: true,
    ...over,
  } as Cycle;
}

function makeObjective(over: Partial<Objective> = {}): Objective {
  return {
    id: 'o1',
    cycleId: 'cyc_q2',
    title: 'Default Objective',
    level: 'company',
    ownerUserId: 'admin',
    status: 'active',
    confidence: 'on-track',
    currentProgress: 0.7,
    progressOverride: null,
    tags: [],
    createdAt: DAYS_AGO(30),
    updatedAt: DAYS_AGO(1),
    tenantId: 'default',
    ...over,
  } as Objective;
}

function makeKr(over: Partial<KeyResult> = {}): KeyResult {
  return {
    id: 'k1',
    objectiveId: 'o1',
    ownerId: 'admin',
    coOwnerIds: [],
    title: 'KR 1',
    measureType: 'numeric',
    computeMethod: 'absolute',
    startValue: 0,
    targetValue: 100,
    currentValue: 50,
    weight: 1,
    confidence: 'on-track',
    riskStatus: 'on_track',
    status: 'active',
    createdAt: DAYS_AGO(30),
    updatedAt: DAYS_AGO(1),
    tenantId: 'default',
    ...over,
  } as KeyResult;
}

function makeCard(over: Partial<DecisionCard> = {}): DecisionCard {
  return {
    id: 'dc1',
    schemaVersion: 'tandem.v1',
    title: 'Default Decision',
    decisionClass: 'simple',
    convergenceState: 'COMMIT',
    elapsedSeconds: 60,
    options: [],
    actionItems: [],
    createdBy: 'admin',
    createdAt: DAYS_AGO(5),
    watermark: { isProxy: false },
    ...over,
  } as DecisionCard;
}

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('business-review · fail-soft 路径', () => {
  it('无 active cycle → summary 全 0, markdown 仍有结构', async () => {
    const r = await generateMonthlyBusinessReview({ periodEnd: new Date(NOW).toISOString() });
    expect(r.summary.activeObjectives).toBe(0);
    expect(r.summary.onTrack).toBe(0);
    expect(r.markdown).toContain('# 月度经营回顾');
    expect(r.markdown).toContain('## 1. 经营总览');
    expect(r.markdown).toContain('## 2. OKR 健康提议');
    expect(r.markdown).toContain('## 3. 决议活动');
    expect(r.markdown).toContain('## 4. 建议本月讨论议题');
  });
});

describe('business-review · summary 分桶', () => {
  it('3 个 objective 分桶 onTrack/atRisk/behind 正确', async () => {
    const store = getStore();
    await store.cycles.create(makeCycle() as never);
    await store.objectives.create(makeObjective({ id: 'o-ok', confidence: 'on-track', currentProgress: 0.8 }) as never);
    await store.objectives.create(makeObjective({ id: 'o-risk', confidence: 'at-risk', currentProgress: 0.4 }) as never);
    await store.objectives.create(makeObjective({ id: 'o-bad', confidence: 'off-track', currentProgress: 0.1 }) as never);

    const r = await generateMonthlyBusinessReview({ periodEnd: new Date(NOW).toISOString() });
    expect(r.summary.activeObjectives).toBe(3);
    expect(r.summary.onTrack).toBe(1);
    expect(r.summary.atRisk).toBe(1);
    expect(r.summary.behind).toBe(1);
    expect(r.summary.overallProgressPct).toBeGreaterThan(0);
  });

  it('behind ≥ 1 → suggestedTopics 含 high severity "目标已落后"', async () => {
    const store = getStore();
    await store.cycles.create(makeCycle() as never);
    await store.objectives.create(makeObjective({ id: 'o-bad', confidence: 'off-track', currentProgress: 0.1 }) as never);
    await store.keyResults.create(makeKr({ objectiveId: 'o-bad', confidence: 'off-track', currentValue: 10 }) as never);

    const r = await generateMonthlyBusinessReview({ periodEnd: new Date(NOW).toISOString() });
    const high = r.suggestedTopics.filter((t) => t.severity === 'high');
    expect(high.length).toBeGreaterThan(0);
    expect(high.some((t) => t.title.includes('落后') || t.title.includes('停滞'))).toBe(true);
  });
});

describe('business-review · 决议活动', () => {
  it('decisions 按 convergenceState 分桶 + topRecent 时间倒序', async () => {
    const store = getStore();
    await store.decisionCards.create(makeCard({ id: 'd1', convergenceState: 'COMMIT', createdAt: DAYS_AGO(1) }) as never);
    await store.decisionCards.create(makeCard({ id: 'd2', convergenceState: 'COMMIT', createdAt: DAYS_AGO(3) }) as never);
    await store.decisionCards.create(makeCard({ id: 'd3', convergenceState: 'VETOED', createdAt: DAYS_AGO(5) }) as never);
    await store.decisionCards.create(makeCard({ id: 'd4', convergenceState: 'CONVERGE', createdAt: DAYS_AGO(7) }) as never);

    const r = await generateMonthlyBusinessReview({ periodEnd: new Date(NOW).toISOString(), windowDays: 30 });
    expect(r.decisions.total).toBe(4);
    expect(r.decisions.byOutcome.adopted).toBe(2);
    expect(r.decisions.byOutcome.overruled).toBe(1);
    expect(r.decisions.byOutcome.pending).toBe(1);
    expect(r.decisions.topRecent[0].id).toBe('d1'); // 最新
  });

  it('windowDays 过滤窗口外的决议', async () => {
    const store = getStore();
    await store.decisionCards.create(makeCard({ id: 'd-in', createdAt: DAYS_AGO(5) }) as never);
    await store.decisionCards.create(makeCard({ id: 'd-out', createdAt: DAYS_AGO(60) }) as never);

    const r = await generateMonthlyBusinessReview({ periodEnd: new Date(NOW).toISOString(), windowDays: 30 });
    expect(r.decisions.total).toBe(1);
    expect(r.decisions.topRecent[0].id).toBe('d-in');
  });
});

describe('business-review · markdown 完整性', () => {
  it('markdown 含周期标签 + ID', async () => {
    const store = getStore();
    await store.cycles.create(makeCycle({ name: '2026 Q2' }) as never);
    const r = await generateMonthlyBusinessReview({ periodEnd: new Date(NOW).toISOString(), windowDays: 30 });
    expect(r.markdown).toContain('2026 Q2');
    expect(r.markdown).toContain(r.id);
    expect(r.markdown).toContain('参谋');
    expect(r.markdown).toContain('advisory');
  });
});
