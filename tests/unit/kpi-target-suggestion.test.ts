/**
 * 目标自动生成引擎 · 单测
 *
 *   - lib/kpi/target-suggestion-engine.ts 纯函数
 *   - app/api/kpi/target-suggestions/route.ts API 层 (真实历史周期匹配)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { suggestTargets } from '@/lib/kpi/target-suggestion-engine';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { Kpi, KpiCycle, KpiSubject } from '@/lib/types/kpi';

describe('suggestTargets (pure function)', () => {
  it('applies per-code growth rate over the real prior actual', () => {
    const out = suggestTargets({
      priorYearActuals: [
        { subjectId: 's1', subjectCode: 'FIN.REV', assigneeId: 'u1', level: 'company', priorActual: 1000000 },
      ],
      growthRateByCode: { 'FIN.REV': 0.15 },
    });
    expect(out).toHaveLength(1);
    expect(out[0].growthRateUsed).toBe(0.15);
    expect(out[0].suggestedTarget).toBe(1150000);
  });

  it('falls back to defaultGrowthRate for unlisted codes', () => {
    const out = suggestTargets({
      priorYearActuals: [
        { subjectId: 's2', subjectCode: 'CUST.NPS', assigneeId: 'u1', level: 'company', priorActual: 80 },
      ],
      growthRateByCode: { 'FIN.REV': 0.15 },
      defaultGrowthRate: 0.05,
    });
    expect(out[0].growthRateUsed).toBe(0.05);
    expect(out[0].suggestedTarget).toBe(84);
  });

  it('defaults growth rate to 0 (flat) when nothing specified', () => {
    const out = suggestTargets({
      priorYearActuals: [
        { subjectId: 's3', subjectCode: 'X', assigneeId: 'u1', level: 'individual', priorActual: 50 },
      ],
    });
    expect(out[0].growthRateUsed).toBe(0);
    expect(out[0].suggestedTarget).toBe(50);
  });

  it('returns empty array for empty input (no fabricated suggestions)', () => {
    expect(suggestTargets({ priorYearActuals: [] })).toEqual([]);
  });
});

let currentAuth: AuthContext;

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getRouter: vi.fn(() => ({})),
    getStore: repo.getStore,
  };
});

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return { ...actual, requireAuth: vi.fn(() => currentAuth) };
});

import { POST as suggestPOST } from '@/app/api/kpi/target-suggestions/route';

function ctx(userId: string, roles: string[]): AuthContext {
  return { userId, email: `${userId}@t.local`, tenantId: 'default', roles, mfaVerified: true, demo: false };
}
function postReq(url: string, body: unknown): NextRequest {
  return new NextRequest(
    new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  );
}

async function seedCycle(fiscalYear: number, status: KpiCycle['status'] = 'draft'): Promise<KpiCycle> {
  const now = new Date().toISOString();
  return getStore().kpiCycles.create({
    fiscalYear,
    name: `FY${fiscalYear}`,
    startDate: `${fiscalYear}-01-01T00:00:00Z`,
    endDate: `${fiscalYear}-12-31T23:59:59Z`,
    status,
    tenantId: 'default',
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
  } as Omit<KpiCycle, 'id'>);
}

async function seedSubject(code: string): Promise<KpiSubject> {
  const now = new Date().toISOString();
  return getStore().kpiSubjects.create({
    code,
    name: code,
    level: 1,
    defaultScope: 'bonus',
    defaultMeasureType: 'numeric',
    active: true,
    tenantId: 'default',
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
  } as Omit<KpiSubject, 'id'>);
}

async function seedKpi(cycleId: string, subjectId: string, assigneeId: string, currentValue: number): Promise<Kpi> {
  const now = new Date().toISOString();
  return getStore().kpis.create({
    cycleId,
    subjectId,
    level: 'company',
    assigneeId,
    title: 'x',
    measureType: 'numeric',
    startValue: 0,
    targetValue: 100,
    currentValue,
    weight: 100,
    dataSource: 'manual',
    scope: 'bonus',
    tenantId: 'default',
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
  } as Omit<Kpi, 'id'>);
}

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('POST /api/kpi/target-suggestions', () => {
  it('matches prior fiscal year actuals and applies growth rate', async () => {
    const subject = await seedSubject('FIN.REV');
    const priorCycle = await seedCycle(2025, 'closed');
    await seedKpi(priorCycle.id, subject.id, 'u1', 1000000);
    const newCycle = await seedCycle(2026, 'draft');

    currentAuth = ctx('u_hr', ['steward']);
    const res = await suggestPOST(postReq('http://x/api/kpi/target-suggestions', {
      cycleId: newCycle.id,
      growthRateByCode: { 'FIN.REV': 0.1 },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.priorFiscalYear).toBe(2025);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0].subjectCode).toBe('FIN.REV');
    expect(data.suggestions[0].suggestedTarget).toBe(1100000);
    expect(data.suggestions[0].alreadySet).toBe(false);
  });

  it('flags alreadySet when a KPI already exists in the new cycle for that combo', async () => {
    const subject = await seedSubject('FIN.REV');
    const priorCycle = await seedCycle(2025, 'closed');
    await seedKpi(priorCycle.id, subject.id, 'u1', 1000000);
    const newCycle = await seedCycle(2026, 'draft');
    await seedKpi(newCycle.id, subject.id, 'u1', 0);

    currentAuth = ctx('u_hr', ['steward']);
    const res = await suggestPOST(postReq('http://x/api/kpi/target-suggestions', { cycleId: newCycle.id }));
    const data = await res.json();
    expect(data.suggestions[0].alreadySet).toBe(true);
  });

  it('returns empty suggestions with a note when no prior fiscal year cycle exists', async () => {
    const newCycle = await seedCycle(2026, 'draft');
    currentAuth = ctx('u_hr', ['steward']);
    const res = await suggestPOST(postReq('http://x/api/kpi/target-suggestions', { cycleId: newCycle.id }));
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(data.priorCycleId).toBeNull();
    expect(data.note).toMatch(/无真实基准/);
  });

  it('requires kpi.write permission', async () => {
    const newCycle = await seedCycle(2026, 'draft');
    currentAuth = ctx('u_random', ['employee']);
    const res = await suggestPOST(postReq('http://x/api/kpi/target-suggestions', { cycleId: newCycle.id }));
    expect(res.status).toBe(403);
  });
});
