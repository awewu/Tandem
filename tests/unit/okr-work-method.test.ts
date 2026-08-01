/**
 * tests/unit/okr-work-method.test.ts
 *
 * 锁 lib/okr/work-method.ts 工作法分桶 (单一真值 weekOf, 防漂移):
 *   backlog / overdue / this-week / next-4-weeks / later, 及已完成项不计遗留。
 */

import { describe, expect, it } from 'vitest';

import {
  startOfWeek,
  bucketByWeekOf,
  initiativesForObjective,
  reportPlanInitiativesForKr,
  buildWorkMethod,
} from '@/lib/okr/work-method';
import type { Initiative, KeyResult, Objective } from '@/lib/store';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-24T10:00:00').getTime(); // 周三

function obj(p: Partial<Objective>): Objective {
  return {
    id: 'o1', cycleId: 'c1', ownerId: 'u1', title: 'O', confidence: 'on-track',
    status: 'active', visibility: 'public', tags: [], progressOverride: null,
    createdAt: 0, updatedAt: 0, ...p,
  } as Objective;
}
function kr(p: Partial<KeyResult>): KeyResult {
  return {
    id: 'k1', objectiveId: 'o1', title: 'KR', type: 'percentage',
    startValue: 0, targetValue: 100, currentValue: 0, weight: 1, unit: '%',
    createdAt: 0, updatedAt: 0, ...p,
  } as KeyResult;
}
function init(p: Partial<Initiative>): Initiative {
  return {
    id: 'i1', scope: 'kr', scopeId: 'k1', title: 'I', ownerId: 'u1',
    status: 'todo', priority: 'medium', tags: [], createdAt: 0, updatedAt: 0, ...p,
  } as Initiative;
}

describe('startOfWeek', () => {
  it('返回所在周的周一 00:00', () => {
    const monday = startOfWeek(NOW);
    expect(new Date(monday).getDay()).toBe(1); // 周一
    expect(new Date(monday).getHours()).toBe(0);
    // 同一周任意时刻 → 同一周一
    expect(startOfWeek(NOW + 2 * DAY)).toBe(monday);
  });
});

describe('bucketByWeekOf', () => {
  const thisWeek = startOfWeek(NOW);
  it('未设 weekOf → backlog', () => {
    expect(bucketByWeekOf(undefined, NOW)).toBe('backlog');
    expect(bucketByWeekOf(null, NOW)).toBe('backlog');
  });
  it('过去的周 → overdue', () => {
    expect(bucketByWeekOf(thisWeek - 7 * DAY, NOW)).toBe('overdue');
  });
  it('本周 → this-week', () => {
    expect(bucketByWeekOf(thisWeek, NOW)).toBe('this-week');
    expect(bucketByWeekOf(NOW, NOW)).toBe('this-week'); // 任意本周时刻
  });
  it('未来 1-4 周 → next-4-weeks', () => {
    expect(bucketByWeekOf(thisWeek + 7 * DAY, NOW)).toBe('next-4-weeks');
    expect(bucketByWeekOf(thisWeek + 4 * 7 * DAY, NOW)).toBe('next-4-weeks');
  });
  it('4 周以后 → later', () => {
    expect(bucketByWeekOf(thisWeek + 5 * 7 * DAY, NOW)).toBe('later');
  });
});

describe('initiativesForObjective', () => {
  it('收集挂 O 的 + 挂其 KR 的行动项', () => {
    const o = obj({ id: 'o1' });
    const krs = [kr({ id: 'k1', objectiveId: 'o1' }), kr({ id: 'kX', objectiveId: 'oOther' })];
    const inits = [
      init({ id: 'i1', scope: 'kr', scopeId: 'k1' }),       // ✓
      init({ id: 'i2', scope: 'objective', scopeId: 'o1' }), // ✓
      init({ id: 'i3', scope: 'kr', scopeId: 'kX' }),        // ✗ 别的 O
    ];
    const got = initiativesForObjective(o, krs, inits).map((i) => i.id);
    expect(got).toEqual(['i1', 'i2']);
  });
});

describe('reportPlanInitiativesForKr', () => {
  const thisWeek = startOfWeek(NOW);

  it('日报计划提示包含遗留和本周 KR 行动项, 排除未来和已关闭项', () => {
    const got = reportPlanInitiativesForKr('k1', [
      init({ id: 'this-week', scopeId: 'k1', weekOf: thisWeek }),
      init({ id: 'overdue', scopeId: 'k1', weekOf: thisWeek - 7 * DAY }),
      init({ id: 'future', scopeId: 'k1', weekOf: thisWeek + 7 * DAY }),
      init({ id: 'done', scopeId: 'k1', weekOf: thisWeek, status: 'done' }),
      init({ id: 'other-kr', scopeId: 'k2', weekOf: thisWeek }),
    ], NOW).map((i) => i.id);

    expect(got).toEqual(['this-week', 'overdue']);
  });
});

describe('buildWorkMethod', () => {
  const o = obj({ id: 'o1' });
  const krs = [kr({ id: 'k1', objectiveId: 'o1' })];
  const thisWeek = startOfWeek(NOW);

  it('分桶 + thisWeekFocus = 遗留 + 本周, planningHorizon 包含本周', () => {
    const v = buildWorkMethod({
      objective: o, keyResults: krs, now: NOW,
      initiatives: [
        init({ id: 'a', weekOf: thisWeek }),               // this-week
        init({ id: 'b', weekOf: thisWeek - 7 * DAY }),       // overdue
        init({ id: 'c', weekOf: thisWeek + 7 * DAY }),       // next-4-weeks
        init({ id: 'd' }),                                   // backlog (无 weekOf)
      ],
    });
    expect(v.counts['this-week']).toBe(1);
    expect(v.counts.overdue).toBe(1);
    expect(v.counts['next-4-weeks']).toBe(1);
    expect(v.counts.backlog).toBe(1);
    expect(v.thisWeekFocus.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(v.planningHorizon.map((i) => i.id)).toEqual(['a', 'c', 'd']);
  });

  it('已完成项即便 weekOf 在过去, 也不计入遗留', () => {
    const v = buildWorkMethod({
      objective: o, keyResults: krs, now: NOW,
      initiatives: [init({ id: 'done1', weekOf: thisWeek - 14 * DAY, status: 'done' })],
    });
    expect(v.counts.overdue).toBe(0);
  });
});
