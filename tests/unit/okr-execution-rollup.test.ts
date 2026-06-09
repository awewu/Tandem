/**
 * tests/unit/okr-execution-rollup.test.ts
 *
 * 锁 P0·B3 执行联动闭环 (OKR-EVOLUTION-PLAN §2 "OKRs-E 执行联动" · 2026-06-02):
 *   1. 仅 autoProgressFromInitiatives / milestone KR 被自动驱动 (防腐蚀人工测量的数值型 KR)
 *   2. Initiative 完成率 → KR.currentValue (start + ratio*(target-start))
 *   3. KR 变化后复用 B2 向上 rollup 到 Objective 链 (执行→目标→顶层 一条龙)
 *   4. 不该驱动的 KR 原值不动
 */

import { describe, expect, it } from 'vitest';

import {
  isInitiativeDriven,
  computeKrCurrentValueFromInitiatives,
  syncKrFromInitiatives,
  type ExecutionRollupStore,
} from '@/lib/okr/execution-rollup';
import type { Objective, KeyResult, Initiative } from '@/lib/types/okr-tti';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeObjective(p: Partial<Objective> & { id: string }): Objective {
  return {
    id: p.id,
    cycleId: 'c1',
    level: p.level ?? 'individual',
    parentObjectiveId: p.parentObjectiveId,
    ownerId: 'u1',
    title: p.id,
    visibility: 'public',
    weight: p.weight ?? 100,
    status: 'active',
    confidence: 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    currentProgress: p.currentProgress,
    progressOverride: p.progressOverride ?? null,
    tenantId: 'default',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeKr(p: Partial<KeyResult> & { id: string; objectiveId: string }): KeyResult {
  return {
    id: p.id,
    objectiveId: p.objectiveId,
    ownerId: 'u1',
    coOwnerIds: [],
    title: p.id,
    measureType: p.measureType ?? 'percentage',
    computeMethod: 'latest',
    startValue: p.startValue ?? 0,
    targetValue: p.targetValue ?? 100,
    currentValue: p.currentValue ?? 0,
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: p.weight ?? 1,
    status: p.status ?? 'active',
    autoProgressFromInitiatives: p.autoProgressFromInitiatives,
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeInitiative(p: Partial<Initiative> & { id: string; keyResultId: string }): Initiative {
  return {
    id: p.id,
    keyResultId: p.keyResultId,
    ownerId: 'u1',
    title: p.id,
    decisionCardIds: [],
    status: p.status ?? 'planned',
    tenantId: 'default',
  };
}

function makeStore(
  objectives: Objective[],
  krs: KeyResult[],
  initiatives: Initiative[],
): ExecutionRollupStore & { _krs: Map<string, KeyResult>; _objectives: Map<string, Objective> } {
  const objMap = new Map(objectives.map((o) => [o.id, o]));
  const krMap = new Map(krs.map((k) => [k.id, k]));
  const initList = [...initiatives];
  return {
    _krs: krMap,
    _objectives: objMap,
    objectives: {
      async get(id) {
        return objMap.get(id) ?? null;
      },
      async list() {
        return Array.from(objMap.values());
      },
      async update(id, patch) {
        const cur = objMap.get(id);
        if (cur) objMap.set(id, { ...cur, ...patch });
        return cur;
      },
    },
    keyResults: {
      async get(id) {
        return krMap.get(id) ?? null;
      },
      async list() {
        return Array.from(krMap.values());
      },
      async update(id, patch) {
        const cur = krMap.get(id);
        if (cur) krMap.set(id, { ...cur, ...patch });
        return cur;
      },
    },
    initiatives: {
      async list() {
        return initList;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// §A · 纯计算
// ---------------------------------------------------------------------------

describe('isInitiativeDriven · 驱动门槛', () => {
  it('milestone 类型默认开启', () => {
    expect(isInitiativeDriven({ measureType: 'milestone' })).toBe(true);
  });
  it('显式 autoProgressFromInitiatives=true 开启', () => {
    expect(isInitiativeDriven({ measureType: 'numeric', autoProgressFromInitiatives: true })).toBe(true);
  });
  it('数值型默认关闭 (防腐蚀人工测量)', () => {
    expect(isInitiativeDriven({ measureType: 'numeric' })).toBe(false);
    expect(isInitiativeDriven({ measureType: 'percentage' })).toBe(false);
  });
});

describe('computeKrCurrentValueFromInitiatives', () => {
  it('完成率映射到 start..target 区间', () => {
    const kr = makeKr({ id: 'k', objectiveId: 'o', startValue: 0, targetValue: 100, autoProgressFromInitiatives: true });
    const inits = [
      makeInitiative({ id: 'i1', keyResultId: 'k', status: 'done' }),
      makeInitiative({ id: 'i2', keyResultId: 'k', status: 'in_progress' }),
      makeInitiative({ id: 'i3', keyResultId: 'k', status: 'planned' }),
      makeInitiative({ id: 'i4', keyResultId: 'k', status: 'done' }),
    ];
    // 2/4 = 0.5 → currentValue = 50
    expect(computeKrCurrentValueFromInitiatives(kr, inits)).toEqual({ currentValue: 50, completionRatio: 0.5 });
  });

  it('非空 start/target 区间也正确', () => {
    const kr = makeKr({ id: 'k', objectiveId: 'o', startValue: 10, targetValue: 20, measureType: 'milestone' });
    const inits = [
      makeInitiative({ id: 'i1', keyResultId: 'k', status: 'done' }),
      makeInitiative({ id: 'i2', keyResultId: 'k', status: 'planned' }),
    ];
    // 0.5 → 10 + 0.5*10 = 15
    expect(computeKrCurrentValueFromInitiatives(kr, inits)).toEqual({ currentValue: 15, completionRatio: 0.5 });
  });

  it('未开启驱动 → null', () => {
    const kr = makeKr({ id: 'k', objectiveId: 'o', measureType: 'numeric' });
    const inits = [makeInitiative({ id: 'i1', keyResultId: 'k', status: 'done' })];
    expect(computeKrCurrentValueFromInitiatives(kr, inits)).toBeNull();
  });

  it('无 Initiative → null', () => {
    const kr = makeKr({ id: 'k', objectiveId: 'o', measureType: 'milestone' });
    expect(computeKrCurrentValueFromInitiatives(kr, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §B · 执行联动闭环
// ---------------------------------------------------------------------------

describe('syncKrFromInitiatives · 执行→目标→顶层 闭环', () => {
  it('Initiative 完成驱动 KR.currentValue 并向上 rollup 到父 Objective', async () => {
    const parent = makeObjective({ id: 'o-parent', level: 'team', weight: 100 });
    const child = makeObjective({ id: 'o-child', level: 'individual', parentObjectiveId: 'o-parent', weight: 100 });
    const kr = makeKr({
      id: 'k1',
      objectiveId: 'o-child',
      measureType: 'milestone',
      startValue: 0,
      targetValue: 100,
      currentValue: 0,
      weight: 1,
    });
    const inits = [
      makeInitiative({ id: 'i1', keyResultId: 'k1', status: 'done' }),
      makeInitiative({ id: 'i2', keyResultId: 'k1', status: 'planned' }),
    ];
    const store = makeStore([parent, child], [kr], inits);

    const res = await syncKrFromInitiatives('k1', store, { actorId: 'u1' });

    expect(res).not.toBeNull();
    expect(res!.changed).toBe(true);
    expect(res!.completionRatio).toBe(0.5);
    expect(res!.to).toBe(50);
    // KR 真值写入
    expect(store._krs.get('k1')!.currentValue).toBe(50);
    // 向上 rollup: KR progress 0.5 → child O 0.5 → parent O 0.5
    expect(store._objectives.get('o-child')!.currentProgress).toBeCloseTo(0.5);
    expect(store._objectives.get('o-parent')!.currentProgress).toBeCloseTo(0.5);
    expect(res!.rolledUp.map((r) => r.objectiveId)).toEqual(['o-child', 'o-parent']);
  });

  it('非驱动型 KR (numeric 无 flag) 原值不动, 返回 null', async () => {
    const o = makeObjective({ id: 'o' });
    const kr = makeKr({ id: 'k1', objectiveId: 'o', measureType: 'numeric', currentValue: 42 });
    const inits = [makeInitiative({ id: 'i1', keyResultId: 'k1', status: 'done' })];
    const store = makeStore([o], [kr], inits);

    const res = await syncKrFromInitiatives('k1', store, { actorId: 'u1' });
    expect(res).toBeNull();
    expect(store._krs.get('k1')!.currentValue).toBe(42); // 未被篡改
  });

  it('完成率未变 → changed=false, 不写库', async () => {
    const o = makeObjective({ id: 'o' });
    // 已经是 50 (1/2 done), 再 sync 不应变
    const kr = makeKr({ id: 'k1', objectiveId: 'o', measureType: 'milestone', startValue: 0, targetValue: 100, currentValue: 50 });
    const inits = [
      makeInitiative({ id: 'i1', keyResultId: 'k1', status: 'done' }),
      makeInitiative({ id: 'i2', keyResultId: 'k1', status: 'planned' }),
    ];
    const store = makeStore([o], [kr], inits);
    const res = await syncKrFromInitiatives('k1', store, { actorId: 'u1' });
    expect(res!.changed).toBe(false);
    expect(res!.rolledUp).toEqual([]);
  });

  it('全部完成 → KR 满值, Objective 100%', async () => {
    const o = makeObjective({ id: 'o' });
    const kr = makeKr({ id: 'k1', objectiveId: 'o', measureType: 'milestone', startValue: 0, targetValue: 100, currentValue: 0, weight: 1 });
    const inits = [
      makeInitiative({ id: 'i1', keyResultId: 'k1', status: 'done' }),
      makeInitiative({ id: 'i2', keyResultId: 'k1', status: 'done' }),
    ];
    const store = makeStore([o], [kr], inits);
    const res = await syncKrFromInitiatives('k1', store, { actorId: 'u1' });
    expect(res!.to).toBe(100);
    expect(store._objectives.get('o')!.currentProgress).toBeCloseTo(1.0);
  });
});
