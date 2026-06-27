/**
 * tests/unit/okr-risk.test.ts
 *
 * 锁 lib/okr/risk.ts 进度基准线客观风险 (EVM-lite):
 *   variance = 按时间应完成 (基准) - 实际进度; band 阈值 <=10 绿 / <=25 黄 / >25 红。
 *   边界: 未开始 / 过半 / 超期 / 领先 / span<=0。
 */

import { describe, expect, it } from 'vitest';

import {
  calcScheduleRisk,
  bandForVariance,
  objectiveScheduleRisk,
} from '@/lib/okr/risk';
import type { Cycle, KeyResult, Objective } from '@/lib/store';

const DAY = 24 * 60 * 60 * 1000;
const START = 0;
const END = 100 * DAY; // 100 天周期

describe('bandForVariance', () => {
  it('<=10 绿, (10,25] 黄, >25 红', () => {
    expect(bandForVariance(0)).toBe('on-track');
    expect(bandForVariance(10)).toBe('on-track');
    expect(bandForVariance(11)).toBe('at-risk');
    expect(bandForVariance(25)).toBe('at-risk');
    expect(bandForVariance(26)).toBe('off-track');
    expect(bandForVariance(-30)).toBe('on-track'); // 领先
  });
});

describe('calcScheduleRisk', () => {
  it('周期未开始 → 基准 0, 不报风险', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 0, now: -10 * DAY });
    expect(r.expectedProgress).toBe(0);
    expect(r.timeElapsedRatio).toBe(0);
    expect(r.band).toBe('on-track');
  });

  it('过半且进度匹配 → variance 0, 绿', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 50, now: 50 * DAY });
    expect(r.expectedProgress).toBe(50);
    expect(r.variance).toBe(0);
    expect(r.band).toBe('on-track');
  });

  it('轻微落后 (time 50%, actual 35) → 黄', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 35, now: 50 * DAY });
    expect(r.variance).toBe(15);
    expect(r.band).toBe('at-risk');
  });

  it('严重落后 (time 93%, actual 60) → 红 (对标 Tita V4 项目)', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 60, now: 93 * DAY });
    expect(r.expectedProgress).toBe(93);
    expect(r.variance).toBe(33);
    expect(r.band).toBe('off-track');
  });

  it('领先 (time 50%, actual 80) → variance 负, 绿', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 80, now: 50 * DAY });
    expect(r.variance).toBe(-30);
    expect(r.band).toBe('on-track');
  });

  it('超期 (now > end) → 基准钳制 100', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 60, now: 120 * DAY });
    expect(r.expectedProgress).toBe(100);
    expect(r.timeElapsedRatio).toBe(1);
    expect(r.band).toBe('off-track');
  });

  it('span<=0 (start>=end) → 视为已结束, 基准 100', () => {
    const r = calcScheduleRisk({ startDate: END, endDate: START, actualProgress: 50, now: 50 * DAY });
    expect(r.expectedProgress).toBe(100);
    expect(r.daysTotal).toBe(0);
  });

  it('actualProgress 钳制 [0,100]', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 150, now: 50 * DAY });
    expect(r.actualProgress).toBe(100);
  });

  it('daysElapsed/daysTotal 正确', () => {
    const r = calcScheduleRisk({ startDate: START, endDate: END, actualProgress: 50, now: 30 * DAY });
    expect(r.daysTotal).toBe(100);
    expect(r.daysElapsed).toBe(30);
  });
});

describe('objectiveScheduleRisk', () => {
  const cycle: Cycle = {
    id: 'c1', name: 'Q', type: 'quarter', startDate: START, endDate: END, isActive: true,
  };
  const obj = (p: Partial<Objective>): Objective => ({
    id: 'o1', cycleId: 'c1', ownerId: 'u1', title: 'O', confidence: 'on-track',
    status: 'active', visibility: 'public', tags: [], progressOverride: null,
    createdAt: 0, updatedAt: 0, ...p,
  } as Objective);
  const kr = (p: Partial<KeyResult>): KeyResult => ({
    id: 'k1', objectiveId: 'o1', title: 'KR', type: 'percentage',
    startValue: 0, targetValue: 100, currentValue: 0, weight: 1, unit: '%',
    createdAt: 0, updatedAt: 0, ...p,
  } as KeyResult);

  it('无 cycle → null', () => {
    expect(objectiveScheduleRisk(obj({}), undefined, [], 50 * DAY)).toBeNull();
  });

  it('progressOverride=100 在 50% 时间点 → 领先 绿', () => {
    const r = objectiveScheduleRisk(obj({ progressOverride: 100 }), cycle, [], 50 * DAY);
    expect(r?.actualProgress).toBe(100);
    expect(r?.band).toBe('on-track');
  });

  it('KR 实际 30 在 93% 时间点 → 红', () => {
    const r = objectiveScheduleRisk(
      obj({}), cycle, [kr({ currentValue: 30 })], 93 * DAY,
    );
    expect(r?.actualProgress).toBe(30);
    expect(r?.band).toBe('off-track');
  });
});
