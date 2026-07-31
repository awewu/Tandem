import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { computeYoyFacts, computeQoqFact } from '@/lib/kpi/bsc-fact-service';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { Kpi, KpiCycle } from '@/lib/types/kpi';

const TENANT = 'default';

function makeCycle(overrides: Partial<KpiCycle>): Omit<KpiCycle, 'id'> {
  return {
    fiscalYear: 2026,
    name: 'FY2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
    tenantId: TENANT,
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Omit<KpiCycle, 'id'>;
}

function makeKpi(overrides: Partial<Kpi>): Omit<Kpi, 'id'> {
  return {
    cycleId: 'c1',
    subjectId: 'subj-rev',
    level: 'individual',
    assigneeId: 'emp-1',
    title: 'Revenue',
    measureType: 'currency',
    startValue: 0,
    targetValue: 100,
    currentValue: 100,
    weight: 50,
    dataSource: 'erp',
    scope: 'bonus',
    tenantId: TENANT,
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Omit<Kpi, 'id'>;
}

beforeAll(() => {
  setStore(createInMemoryStore());
});

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('computeYoyFacts', () => {
  it('returns null yoy when no prior fiscal year cycle exists', async () => {
    const store = getStore();
    const cycle = await store.kpiCycles.create(makeCycle({ fiscalYear: 2026 }));
    const kpi = await store.kpis.create(makeKpi({ cycleId: cycle.id, currentValue: 120 }));

    const facts = await computeYoyFacts(TENANT, [kpi]);
    const fact = facts.get(kpi.id)!;
    expect(fact.yoyPct).toBeNull();
    expect(fact.priorActual).toBeNull();
    expect(fact.priorFiscalYear).toBeNull();
  });

  it('computes real yoy from matching prior-year KPI (same subject+assignee+level)', async () => {
    const store = getStore();
    const priorCycle = await store.kpiCycles.create(makeCycle({ fiscalYear: 2025, name: 'FY2025' }));
    const priorKpi = await store.kpis.create(
      makeKpi({ cycleId: priorCycle.id, currentValue: 100, targetValue: 100 }),
    );
    const currentCycle = await store.kpiCycles.create(makeCycle({ fiscalYear: 2026 }));
    const currentKpi = await store.kpis.create(
      makeKpi({ cycleId: currentCycle.id, currentValue: 130, targetValue: 140 }),
    );

    const facts = await computeYoyFacts(TENANT, [currentKpi]);
    const fact = facts.get(currentKpi.id)!;
    expect(fact.priorKpiId).toBe(priorKpi.id);
    expect(fact.priorActual).toBe(100);
    expect(fact.priorFiscalYear).toBe(2025);
    expect(fact.yoyPct).toBeCloseTo(30, 5); // (130-100)/100*100
  });

  it('does not fabricate a match across different assignee/subject/level', async () => {
    const store = getStore();
    const priorCycle = await store.kpiCycles.create(makeCycle({ fiscalYear: 2025, name: 'FY2025' }));
    await store.kpis.create(
      makeKpi({ cycleId: priorCycle.id, assigneeId: 'someone-else', currentValue: 999 }),
    );
    const currentCycle = await store.kpiCycles.create(makeCycle({ fiscalYear: 2026 }));
    const currentKpi = await store.kpis.create(makeKpi({ cycleId: currentCycle.id, currentValue: 130 }));

    const facts = await computeYoyFacts(TENANT, [currentKpi]);
    const fact = facts.get(currentKpi.id)!;
    expect(fact.priorActual).toBeNull();
    expect(fact.priorFiscalYear).toBe(2025); // 周期存在, 但匹配不到同一 assignee 的 KPI
    expect(fact.yoyPct).toBeNull();
  });

  it('returns empty map for empty input', async () => {
    const facts = await computeYoyFacts(TENANT, []);
    expect(facts.size).toBe(0);
  });
});

describe('computeQoqFact', () => {
  it('returns all-null for empty snapshots', () => {
    const fact = computeQoqFact([]);
    expect(fact).toEqual({ currentQuarterValue: null, priorQuarterValue: null, qoqPct: null });
  });

  it('computes real QoQ across calendar quarter boundary (Q2 vs Q1 end)', () => {
    const snapshots = [
      { date: '2026-03-31', value: 100 }, // Q1 末
      { date: '2026-04-15', value: 110 },
      { date: '2026-06-30', value: 130 }, // Q2 末
    ];
    const fact = computeQoqFact(snapshots, '2026-06-30');
    expect(fact.priorQuarterValue).toBe(100);
    expect(fact.currentQuarterValue).toBe(130);
    expect(fact.qoqPct).toBeCloseTo(30, 5); // (130-100)/100*100
  });

  it('returns null priorQuarterValue when no snapshot exists before/at prior quarter end', () => {
    const snapshots = [{ date: '2026-04-05', value: 50 }]; // 只有 Q2 数据, 无 Q1
    const fact = computeQoqFact(snapshots, '2026-04-05');
    expect(fact.currentQuarterValue).toBe(50);
    expect(fact.priorQuarterValue).toBeNull();
    expect(fact.qoqPct).toBeNull();
  });

  it('handles year rollover (Q1 vs prior year Q4)', () => {
    const snapshots = [
      { date: '2025-12-31', value: 80 }, // 2025 Q4 末
      { date: '2026-02-10', value: 88 }, // 2026 Q1
    ];
    const fact = computeQoqFact(snapshots, '2026-02-10');
    expect(fact.priorQuarterValue).toBe(80);
    expect(fact.currentQuarterValue).toBe(88);
    expect(fact.qoqPct).toBeCloseTo(10, 5);
  });

  it('defaults asOfDate to the latest snapshot date when omitted', () => {
    const snapshots = [
      { date: '2026-03-31', value: 100 },
      { date: '2026-05-20', value: 120 },
    ];
    const fact = computeQoqFact(snapshots);
    expect(fact.currentQuarterValue).toBe(120);
    expect(fact.priorQuarterValue).toBe(100);
  });
});
