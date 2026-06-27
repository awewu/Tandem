/**
 * tests/unit/okr-adoption.test.ts
 *
 * 锁 lib/okr/adoption.ts 组织级三率 + 分布 (对标 Tita OKR 仪表盘):
 *   填写率 / 对齐率 / 执行分解率, 每人 O 数分布, 每 O 的 KR 数分布。
 */

import { describe, expect, it } from 'vitest';

import {
  computeAdoptionRates,
  objectivesPerPersonDist,
  krsPerObjectiveDist,
} from '@/lib/okr/adoption';
import type { Initiative, KeyResult, Objective, Person } from '@/lib/store';

const person = (id: string): Person => ({ id, name: id } as Person);
const obj = (p: Partial<Objective> & { id: string; ownerId: string }): Objective => ({
  cycleId: 'c1', title: p.id, confidence: 'on-track', status: 'active',
  visibility: 'public', tags: [], progressOverride: null, parentId: null,
  createdAt: 0, updatedAt: 0, ...p,
} as Objective);
const kr = (id: string, objectiveId: string): KeyResult => ({
  id, objectiveId, title: id, type: 'percentage',
  startValue: 0, targetValue: 100, currentValue: 0, weight: 1, unit: '%',
  createdAt: 0, updatedAt: 0,
} as KeyResult);
const init = (id: string, scope: 'objective' | 'kr', scopeId: string): Initiative => ({
  id, scope, scopeId, title: id, ownerId: 'u1', status: 'todo',
  priority: 'medium', tags: [], createdAt: 0, updatedAt: 0,
} as Initiative);

describe('computeAdoptionRates', () => {
  it('填写率 = 有 O 的人 / 总人数', () => {
    const people = [person('u1'), person('u2'), person('u3'), person('u4')];
    const objectives = [obj({ id: 'o1', ownerId: 'u1' }), obj({ id: 'o2', ownerId: 'person:u2' })];
    const r = computeAdoptionRates({ objectives, keyResults: [], initiatives: [], people });
    expect(r.peopleWithOkr).toBe(2); // u1 (裸 id) + u2 (person: 前缀)
    expect(r.coverage).toBe(50);
  });

  it('对齐率 = parentId 非空 O / 总 O', () => {
    const objectives = [
      obj({ id: 'o1', ownerId: 'u1', parentId: 'root' }),
      obj({ id: 'o2', ownerId: 'u2', parentId: null }),
    ];
    const r = computeAdoptionRates({ objectives, keyResults: [], initiatives: [], people: [person('u1')] });
    expect(r.alignedObjectives).toBe(1);
    expect(r.alignment).toBe(50);
  });

  it('执行分解率: 有 KR 且 KR/O 上有 Initiative 才算拆到位', () => {
    const objectives = [
      obj({ id: 'o1', ownerId: 'u1' }), // 有 KR + KR 上有 initiative ✓
      obj({ id: 'o2', ownerId: 'u1' }), // 有 KR 但无 initiative ✗
      obj({ id: 'o3', ownerId: 'u1' }), // 无 KR ✗
      obj({ id: 'o4', ownerId: 'u1' }), // 有 KR + O 上有 initiative ✓
    ];
    const keyResults = [kr('k1', 'o1'), kr('k2', 'o2'), kr('k4', 'o4')];
    const initiatives = [init('i1', 'kr', 'k1'), init('i4', 'objective', 'o4')];
    const r = computeAdoptionRates({ objectives, keyResults, initiatives, people: [person('u1')] });
    expect(r.brokenDownObjectives).toBe(2);
    expect(r.breakdown).toBe(50);
  });

  it('空数据不崩 (除零保护)', () => {
    const r = computeAdoptionRates({ objectives: [], keyResults: [], initiatives: [], people: [] });
    expect(r).toMatchObject({ coverage: 0, alignment: 0, breakdown: 0 });
  });
});

describe('objectivesPerPersonDist', () => {
  it('按 0 / 1 / 2-4 / 5+ 分桶', () => {
    const people = [person('u1'), person('u2'), person('u3'), person('u4')];
    const objectives = [
      obj({ id: 'a', ownerId: 'u2' }), // u2 = 1
      obj({ id: 'b', ownerId: 'u3' }), obj({ id: 'c', ownerId: 'u3' }), // u3 = 2
      ...['d', 'e', 'f', 'g', 'h'].map((id) => obj({ id, ownerId: 'u4' })), // u4 = 5
    ];
    const dist = objectivesPerPersonDist(objectives, people);
    expect(dist).toEqual({ none: 1, one: 1, twoToFour: 1, fivePlus: 1 });
  });
});

describe('krsPerObjectiveDist', () => {
  it('按 0 / 1-2 / 3-5 / 5+ 分桶', () => {
    const objectives = ['o1', 'o2', 'o3', 'o4'].map((id) => obj({ id, ownerId: 'u1' }));
    const keyResults = [
      kr('k1', 'o2'), // o2 = 1
      kr('k2', 'o3'), kr('k3', 'o3'), kr('k4', 'o3'), // o3 = 3
      ...Array.from({ length: 6 }, (_, i) => kr(`x${i}`, 'o4')), // o4 = 6
    ];
    const dist = krsPerObjectiveDist(objectives, keyResults);
    expect(dist).toEqual({ none: 1, oneToTwo: 1, threeToFive: 1, fivePlus: 1 });
  });
});
