/**
 * Unit tests for KpiCausalLink 业务层 (B-019).
 * Pure-function tests — detectCycle / assertValidLink / buildStrategyMap.
 * No DB / Next / boot.
 */

import { describe, it, expect } from 'vitest';
import {
  detectCycle,
  assertValidLink,
  buildStrategyMap,
  CausalLinkError,
} from '@/lib/kpi/causal-links';
import type { Kpi, KpiSubject, KpiCausalLink } from '@/lib/types/kpi';

type KpiLike = Pick<Kpi, 'id' | 'bscPerspective' | 'subjectId' | 'cycleId'>;
type SubjLike = Pick<KpiSubject, 'id' | 'bscPerspective'>;
type LinkLike = Pick<KpiCausalLink, 'fromKpiId' | 'toKpiId'>;

const k = (id: string, p?: Kpi['bscPerspective'], cycleId = 'cy1'): KpiLike => ({
  id,
  bscPerspective: p,
  subjectId: `subj-${id}`,
  cycleId,
});

describe('detectCycle', () => {
  it('flags self-link as cycle', () => {
    expect(detectCycle([], 'a', 'a')).toBe(true);
  });

  it('flags a back-edge that closes a loop', () => {
    // a→b, b→c exists; adding c→a closes a cycle
    const links: LinkLike[] = [
      { fromKpiId: 'a', toKpiId: 'b' },
      { fromKpiId: 'b', toKpiId: 'c' },
    ];
    expect(detectCycle(links, 'c', 'a')).toBe(true);
  });

  it('allows a DAG edge', () => {
    const links: LinkLike[] = [
      { fromKpiId: 'a', toKpiId: 'b' },
      { fromKpiId: 'a', toKpiId: 'c' },
    ];
    expect(detectCycle(links, 'b', 'c')).toBe(false);
  });
});

describe('assertValidLink', () => {
  const subjects: SubjLike[] = [];

  it('rejects self-link', () => {
    expect(() =>
      assertValidLink({
        fromKpi: k('a', 'growth'),
        toKpi: k('a', 'growth'),
        subjects,
        existingLinks: [],
      }),
    ).toThrowError(CausalLinkError);
  });

  it('rejects cross-cycle link', () => {
    expect.assertions(1);
    try {
      assertValidLink({
        fromKpi: k('a', 'growth', 'cy1'),
        toKpi: k('b', 'process', 'cy2'),
        subjects,
        existingLinks: [],
      });
    } catch (e) {
      expect((e as CausalLinkError).code).toBe('cross_cycle');
    }
  });

  it('accepts a valid BSC upstream→downstream direction', () => {
    const r = assertValidLink({
      fromKpi: k('a', 'growth'),
      toKpi: k('b', 'process'),
      subjects,
      existingLinks: [],
    });
    expect(r.fromPerspective).toBe('growth');
    expect(r.toPerspective).toBe('process');
  });

  it('rejects reverse direction (financial→growth)', () => {
    expect.assertions(1);
    try {
      assertValidLink({
        fromKpi: k('a', 'financial'),
        toKpi: k('b', 'growth'),
        subjects,
        existingLinks: [],
      });
    } catch (e) {
      expect((e as CausalLinkError).code).toBe('invalid_direction');
    }
  });

  it('allows reverse direction when allowAnyDirection=true (议事室特批)', () => {
    expect(() =>
      assertValidLink({
        fromKpi: k('a', 'financial'),
        toKpi: k('b', 'growth'),
        subjects,
        existingLinks: [],
        allowAnyDirection: true,
      }),
    ).not.toThrow();
  });

  it('rejects an edge that forms a cycle', () => {
    expect(() =>
      assertValidLink({
        fromKpi: k('c', 'customer'),
        toKpi: k('a', 'growth'),
        subjects,
        existingLinks: [
          { fromKpiId: 'a', toKpiId: 'b' },
          { fromKpiId: 'b', toKpiId: 'c' },
        ],
        allowAnyDirection: true, // isolate cycle check from direction check
      }),
    ).toThrowError(CausalLinkError);
  });

  it('passes when perspectives missing (defers to UI prompt)', () => {
    expect(() =>
      assertValidLink({
        fromKpi: k('a', undefined),
        toKpi: k('b', undefined),
        subjects,
        existingLinks: [],
      }),
    ).not.toThrow();
  });
});

describe('buildStrategyMap', () => {
  const fullKpi = (id: string, p: Kpi['bscPerspective'], weight = 10): Kpi =>
    ({
      id,
      cycleId: 'cy1',
      subjectId: `s-${id}`,
      bscPerspective: p,
      level: 'company',
      assigneeId: 'u1',
      title: `KPI ${id}`,
      measureType: 'numeric',
      startValue: 0,
      targetValue: 100,
      currentValue: 0,
      weight,
      dataSource: 'pending',
      scope: 'bonus',
      tenantId: 'default',
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }) as Kpi;

  const link = (id: string, from: string, to: string): KpiCausalLink => ({
    id,
    cycleId: 'cy1',
    fromKpiId: from,
    toKpiId: to,
    strength: 0.6,
    validated: false,
    tenantId: 'default',
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  it('groups nodes into 4 BSC lanes in order', () => {
    const kpis = [
      fullKpi('g', 'growth'),
      fullKpi('p', 'process'),
      fullKpi('c', 'customer'),
      fullKpi('f', 'financial'),
    ];
    const map = buildStrategyMap('cy1', kpis, [], [link('l1', 'g', 'p')]);
    expect(map.lanes.map((l) => l.perspective)).toEqual([
      'growth',
      'process',
      'customer',
      'financial',
    ]);
    expect(map.lanes[0].nodes).toHaveLength(1);
    expect(map.unclassified).toHaveLength(0);
  });

  it('marks edge direction validity', () => {
    const kpis = [fullKpi('g', 'growth'), fullKpi('f', 'financial')];
    // growth→financial is valid downstream
    const valid = buildStrategyMap('cy1', kpis, [], [link('l1', 'g', 'f')]);
    expect(valid.edges[0].directionValid).toBe(true);
    // financial→growth is reverse
    const reverse = buildStrategyMap('cy1', kpis, [], [link('l2', 'f', 'g')]);
    expect(reverse.edges[0].directionValid).toBe(false);
  });

  it('puts unclassified KPIs in the unclassified bucket', () => {
    const kpis = [fullKpi('x', undefined as unknown as Kpi['bscPerspective'])];
    const map = buildStrategyMap('cy1', kpis, [], []);
    expect(map.unclassified).toHaveLength(1);
  });
});
