import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { computeYoyFacts } from '@/lib/kpi/bsc-fact-service';
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
