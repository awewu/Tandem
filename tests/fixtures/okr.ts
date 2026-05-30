/**
 * Tests fixtures · OKR domain (Objective / KeyResult / CheckIn)
 *
 * 抽自重复的 makeObj / makeKr 定义 (原散落在 okr-calibration / okr-forecast 等).
 * 调用方:
 *   import { makeObj, makeKr, makeCheckIn, T0 } from '../fixtures/okr';
 *
 * 设计原则:
 *   - **不引入 store 单例**: 仅返回 plain object, 调用方自决是否 setStore + repository.create
 *   - **可覆盖**: 用 spread `...overrides` 让 caller 自定义任何字段
 *   - **稳定时间戳 T0**: 默认 2026-04-01 00:00 UTC, 让快照 / 时序测试可复现
 */

import type { CheckIn, Confidence, KeyResult, Objective } from '../../lib/store';

/** 稳定时间戳: 2026-04-01 UTC. 相对此点算 +day*DAY 让 fixture 时间序列可读 */
export const T0 = new Date('2026-04-01T00:00:00Z').getTime();

/** 1 天毫秒 (用于构造 +N*DAY 的时间戳) */
export const DAY = 86_400_000;

/**
 * 创建测试用 Objective. 必填 id + ownerId, 其余有默认值.
 *
 * @example
 *   makeObj({ id: 'o1', ownerId: 'alice', selfScore: 0.7 })
 */
export function makeObj(o: Partial<Objective> & { id: string; ownerId: string }): Objective {
  return {
    title: 'Test Objective',
    cycleId: '2026Q2',
    parentId: null,
    weight: 100,
    status: 'active' as const,
    confidence: 'on-track' as Confidence,
    visibility: 'public' as const,
    tags: [],
    createdAt: T0,
    updatedAt: T0,
    ...o,
  } as Objective;
}

/**
 * 创建测试用 KeyResult. 必填 id + objectiveId, 其余有默认值.
 *
 * @example
 *   makeKr({ id: 'k1', objectiveId: 'o1', currentValue: 60 })
 *   makeKr({ id: 'k1', objectiveId: 'o1', startValue: 100, targetValue: 200, currentValue: 150 })
 */
export function makeKr(k: Partial<KeyResult> & { id: string; objectiveId: string }): KeyResult {
  return {
    title: 'Test KR',
    ownerId: 'alice',
    type: 'numeric' as const,
    startValue: 0,
    targetValue: 100,
    currentValue: 50,
    unit: '万元',
    weight: 100,
    confidence: 'on-track' as Confidence,
    status: 'active' as const,
    tags: [],
    createdAt: T0,
    updatedAt: T0,
    ...k,
  } as KeyResult;
}

/**
 * 创建测试用 CheckIn. 默认 scope='kr', scopeId='kr_1'.
 *
 * @example
 *   makeCheckIn({ scopeId: 'kr_1', progressAfter: 30, createdAt: T0 + 10 * DAY })
 */
export function makeCheckIn(c: Partial<CheckIn> = {}): CheckIn {
  return {
    id: `c_${Math.random().toString(36).slice(2, 8)}`,
    scope: 'kr' as const,
    scopeId: 'kr_1',
    progressBefore: 0,
    progressAfter: 0,
    confidenceBefore: 'on-track' as Confidence,
    confidenceAfter: 'on-track' as Confidence,
    narrative: { progress: '', blocker: '', next: '' },
    createdBy: 'alice',
    createdAt: T0,
    ...c,
  } as CheckIn;
}
