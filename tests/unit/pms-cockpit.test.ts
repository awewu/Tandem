import { describe, it, expect } from 'vitest';
import {
  sortExceptions,
  daysBetween,
  buildProjectStageFunnel,
  detectStalledProjects,
  detectTenderDeadlines,
  detectSpecAtRisk,
  detectChainGaps,
  detectTargetGaps,
  detectContractBacklog,
  COCKPIT_THRESHOLDS,
} from '@/lib/pms/cockpit-service';

const NOW = new Date('2026-07-25T00:00:00.000Z');
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86400000).toISOString();
}
function daysAhead(n: number): string {
  return new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);
}

describe('cockpit · sortExceptions', () => {
  it('orders by severity then amount desc', () => {
    const sorted = sortExceptions([
      { id: 'a', severity: 'warning', category: 'sales', type: 't', title: '', detail: '', amount: 100 },
      { id: 'b', severity: 'critical', category: 'sales', type: 't', title: '', detail: '', amount: 50 },
      { id: 'c', severity: 'critical', category: 'sales', type: 't', title: '', detail: '', amount: 900 },
      { id: 'd', severity: 'info', category: 'finance', type: 't', title: '', detail: '' },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('cockpit · daysBetween', () => {
  it('computes floor day diff', () => {
    expect(daysBetween(NOW, new Date(NOW.getTime() - 3 * 86400000))).toBe(3);
    expect(daysBetween(new Date(NOW.getTime() - 3 * 86400000), NOW)).toBe(-3);
  });
});

describe('cockpit · buildProjectStageFunnel', () => {
  it('buckets by stage, splits lost', () => {
    const { funnel, lostCount, lostValue } = buildProjectStageFunnel([
      { stage: 'lead', estimatedValue: 100 },
      { stage: 'design', estimatedValue: 200 },
      { stage: 'design', estimatedValue: 300 },
      { stage: 'lost', estimatedValue: 500 },
    ]);
    expect(funnel.find((f) => f.stage === 'design')).toMatchObject({ count: 2, value: 500 });
    expect(funnel.find((f) => f.stage === 'lead')).toMatchObject({ count: 1, value: 100 });
    expect(lostCount).toBe(1);
    expect(lostValue).toBe(500);
    // lost 不进主漏斗轴
    expect(funnel.some((f) => f.stage === ('lost' as any))).toBe(false);
  });
});

describe('cockpit · detectStalledProjects', () => {
  const base = { projectName: 'P', stage: 'design' as const, estimatedValue: 1000 };
  it('flags active project idle beyond threshold, critical at 2x', () => {
    const out = detectStalledProjects([
      { id: 'p1', ...base, updatedAt: daysAgo(35) },
      { id: 'p2', ...base, updatedAt: daysAgo(70) },
      { id: 'p3', ...base, updatedAt: daysAgo(5) },
    ], NOW);
    expect(out.map((e) => e.id)).toEqual(['stalled:p1', 'stalled:p2']);
    expect(out[0].severity).toBe('warning');
    expect(out[1].severity).toBe('critical');
  });
  it('ignores closed/lost projects', () => {
    const out = detectStalledProjects([
      { id: 'c', projectName: 'C', stage: 'closed', estimatedValue: 1, updatedAt: daysAgo(90) },
      { id: 'l', projectName: 'L', stage: 'lost', estimatedValue: 1, updatedAt: daysAgo(90) },
    ], NOW);
    expect(out).toHaveLength(0);
  });
});

describe('cockpit · detectTenderDeadlines', () => {
  it('flags soon/overdue preparing tenders', () => {
    const out = detectTenderDeadlines([
      { id: 't1', projectId: 'p1', tenderName: 'T1', submitDeadline: daysAhead(1), budgetAmount: 100 },
      { id: 't2', projectId: 'p2', tenderName: 'T2', submitDeadline: daysAhead(30), budgetAmount: 100 },
      { id: 't3', projectId: 'p3', tenderName: 'T3', submitDeadline: daysAgo(2).slice(0, 10), budgetAmount: 100 },
      { id: 't4', projectId: 'p4', tenderName: 'T4', submitDeadline: null },
    ], NOW);
    const ids = out.map((e) => e.id);
    expect(ids).toContain('tender:t1'); // 1天后 → critical
    expect(ids).toContain('tender:t3'); // 逾期 → critical
    expect(ids).not.toContain('tender:t2'); // 30天后 → 不告警
    expect(ids).not.toContain('tender:t4'); // 无截止日
    expect(out.find((e) => e.id === 'tender:t1')!.severity).toBe('critical');
  });
});

describe('cockpit · detectSpecAtRisk', () => {
  it('flags at-risk value above threshold, critical at 4x', () => {
    const out = detectSpecAtRisk([
      { projectId: 'p1', projectName: 'P1', atRiskValue: 600000 },
      { projectId: 'p2', projectName: 'P2', atRiskValue: 2100000 },
      { projectId: 'p3', projectName: 'P3', atRiskValue: 100000 },
    ]);
    expect(out.map((e) => e.id)).toEqual(['spec:p1', 'spec:p2']);
    expect(out.find((e) => e.id === 'spec:p2')!.severity).toBe('critical');
  });
});

describe('cockpit · detectChainGaps', () => {
  it('flags high-value active projects with missing roles', () => {
    const projects = [
      { id: 'p1', projectName: 'P1', stage: 'design' as const, estimatedValue: 2000000 },
      { id: 'p2', projectName: 'P2', stage: 'design' as const, estimatedValue: 500000 }, // 低于高价值门槛
    ];
    const chain = new Map([
      ['p1', { roles: ['owner'], hasChampion: false, hasEconomicBuyer: false }],
    ]);
    const out = detectChainGaps(projects, chain);
    expect(out.map((e) => e.id)).toEqual(['chain:p1']);
    expect(out[0].detail).toContain('无决策人');
  });
  it('skips complete chains', () => {
    const projects = [{ id: 'p1', projectName: 'P1', stage: 'design' as const, estimatedValue: 2000000 }];
    const chain = new Map([
      ['p1', { roles: ['owner', 'design_engineer', 'installer'], hasChampion: true, hasEconomicBuyer: true }],
    ]);
    expect(detectChainGaps(projects, chain)).toHaveLength(0);
  });
});

describe('cockpit · detectTargetGaps', () => {
  it('flags below-threshold achievement, critical below critical rate', () => {
    const out = detectTargetGaps([
      { id: 't1', dimension: 'region', dimensionValue: '西南', period: '2026-07', targetValue: 1000, actualValue: 500, achievementRate: 50 },
      { id: 't2', dimension: 'region', dimensionValue: '华南', period: '2026-07', targetValue: 1000, actualValue: 300, achievementRate: 30 },
      { id: 't3', dimension: 'region', dimensionValue: '华中', period: '2026-07', targetValue: 1000, actualValue: 900, achievementRate: 90 },
    ], NOW);
    expect(out.map((e) => e.id)).toEqual(['target:t1', 'target:t2']);
    expect(out.find((e) => e.id === 't1' || e.id === 'target:t1')!.severity).toBe('warning');
    expect(out.find((e) => e.id === 'target:t2')!.severity).toBe('critical');
    expect(COCKPIT_THRESHOLDS.targetGapRate).toBe(60);
  });
});

describe('cockpit · detectContractBacklog', () => {
  it('flags pending backlog, critical at 5+', () => {
    expect(detectContractBacklog({ count: 0, amount: 0 })).toHaveLength(0);
    expect(detectContractBacklog({ count: 2, amount: 100 })[0].severity).toBe('warning');
    expect(detectContractBacklog({ count: 6, amount: 100 })[0].severity).toBe('critical');
  });
});
