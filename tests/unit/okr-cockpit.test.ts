/**
 * tests/unit/okr-cockpit.test.ts
 *
 * 锁 lib/okr/cockpit.ts 组织级 AI 风险驾驶舱聚合:
 *   - 无激活周期 → 空 (UI 隐藏)
 *   - 按时间基准统计 off-track / at-risk / on-track
 *   - 逾期行动项限定本周期范围
 *   - 三率复用 adoption
 */

import { describe, expect, it } from 'vitest';

import { computeRiskCockpit } from '@/lib/okr/cockpit';
import type { Cycle, Initiative, KeyResult, Objective, Person } from '@/lib/store';

const DAY = 24 * 60 * 60 * 1000;
const START = 0;
const END = 100 * DAY;
const NOW = 93 * DAY; // 周期已过 93%

const cycle: Cycle = {
  id: 'c1', name: 'Q', type: 'quarter', startDate: START, endDate: END, isActive: true,
};

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
    id: 'i1', scope: 'objective', scopeId: 'o1', title: 'I', ownerId: 'u1',
    status: 'todo', priority: 'medium', tags: [], createdAt: 0, updatedAt: 0, ...p,
  } as Initiative;
}
const people: Person[] = [
  { id: 'u1', name: 'A' } as Person,
  { id: 'u2', name: 'B' } as Person,
];

describe('computeRiskCockpit', () => {
  it('无激活周期 → 空, UI 隐藏', () => {
    const c = computeRiskCockpit({ objectives: [obj({})], keyResults: [], initiatives: [], people, cycle: undefined });
    expect(c.activeCycleId).toBeNull();
    expect(c.hasRisk).toBe(false);
    expect(c.totalActiveObjectives).toBe(0);
  });

  it('93% 时间点, 进度 30 → off-track 计数', () => {
    const c = computeRiskCockpit({
      objectives: [obj({ id: 'o1' })],
      keyResults: [kr({ objectiveId: 'o1', currentValue: 30 })],
      initiatives: [], people, cycle, now: NOW,
    });
    expect(c.offTrack).toBe(1);
    expect(c.atRisk).toBe(0);
    expect(c.hasRisk).toBe(true);
    expect(c.topRisks[0]?.objectiveId).toBe('o1');
    expect(c.topRisks[0]?.band).toBe('off-track');
  });

  it('进度匹配时间 → on-track, 不进 topRisks', () => {
    const c = computeRiskCockpit({
      objectives: [obj({ id: 'o1' })],
      keyResults: [kr({ objectiveId: 'o1', currentValue: 93 })],
      initiatives: [], people, cycle, now: NOW,
    });
    expect(c.onTrack).toBe(1);
    expect(c.offTrack).toBe(0);
    expect(c.topRisks).toHaveLength(0);
    expect(c.hasRisk).toBe(false);
  });

  it('topRisks 按落后幅度降序', () => {
    const c = computeRiskCockpit({
      objectives: [obj({ id: 'o1' }), obj({ id: 'o2' })],
      keyResults: [
        kr({ id: 'k1', objectiveId: 'o1', currentValue: 60 }), // variance 33
        kr({ id: 'k2', objectiveId: 'o2', currentValue: 10 }), // variance 83
      ],
      initiatives: [], people, cycle, now: NOW,
    });
    expect(c.offTrack).toBe(2);
    expect(c.topRisks[0]?.objectiveId).toBe('o2'); // 落后更多排前
    expect(c.topRisks[0]!.variance).toBeGreaterThan(c.topRisks[1]!.variance);
  });

  it('逾期行动项: 仅统计本周期范围内未完成且 dueDate 已过', () => {
    const c = computeRiskCockpit({
      objectives: [obj({ id: 'o1' })],
      keyResults: [kr({ id: 'k1', objectiveId: 'o1', currentValue: 50 })],
      initiatives: [
        init({ id: 'i1', scope: 'objective', scopeId: 'o1', dueDate: 10 * DAY, status: 'todo' }),       // 逾期 ✓
        init({ id: 'i2', scope: 'kr', scopeId: 'k1', dueDate: 10 * DAY, status: 'done' }),               // 已完成, 不算
        init({ id: 'i3', scope: 'objective', scopeId: 'o1', dueDate: NOW + 10 * DAY, status: 'todo' }),  // 未到期, 不算
        init({ id: 'i4', scope: 'objective', scopeId: 'oX', dueDate: 10 * DAY, status: 'todo' }),        // 别周期, 不算
      ],
      people, cycle, now: NOW,
    });
    expect(c.overdueInitiatives).toBe(1);
  });

  it('三率复用 adoption: 2 人 1 人有 O → 填写率 50', () => {
    const c = computeRiskCockpit({
      objectives: [obj({ id: 'o1', ownerId: 'u1' })],
      keyResults: [kr({ objectiveId: 'o1', currentValue: 50 })],
      initiatives: [], people, cycle, now: NOW,
    });
    expect(c.coverage).toBe(50);
  });
});
