/**
 * tests/unit/okr-rollup.test.ts
 *
 * 锁 P0·B2 真 rollup 闭环 (OKR-EVOLUTION-PLAN §1.3 假闭环修复 · 2026-06-02):
 *   1. computeObjectiveProgress 按 KR 加权 + 子 O 加权 正确计算
 *   2. propagateRollupFromKr 真把进度从 KR 向上传播到 Objective 及其所有祖先 (公司←团队←个人)
 *   3. progressOverride (人工覆盖) 优先, 且向上聚合用 effective 值
 *   4. 防环守卫
 *
 * 这是"真闭环断言": 一条 KR check-in 后, 顶层 Objective.currentProgress 必须自动变化,
 * 而不是停留在"事件只打日志"的旧假闭环.
 */

import { describe, expect, it } from 'vitest';

import {
  computeObjectiveProgress,
  propagateRollupFromKr,
  type OkrRollupStore,
} from '@/lib/okr/rollup';
import type { Objective, KeyResult } from '@/lib/types/okr-tti';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeObjective(p: Partial<Objective> & { id: string }): Objective {
  return {
    id: p.id,
    cycleId: p.cycleId ?? 'cycle1',
    level: p.level ?? 'individual',
    parentObjectiveId: p.parentObjectiveId,
    ownerId: p.ownerId ?? 'u1',
    title: p.title ?? p.id,
    visibility: 'public',
    weight: p.weight ?? 100,
    status: p.status ?? 'active',
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
    ownerId: p.ownerId ?? 'u1',
    coOwnerIds: [],
    title: p.title ?? p.id,
    measureType: p.measureType ?? 'percentage',
    computeMethod: 'latest',
    startValue: p.startValue ?? 0,
    targetValue: p.targetValue ?? 100,
    currentValue: p.currentValue ?? 0,
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: p.weight ?? 1,
    status: p.status ?? 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

/** 内存 store 实现 OkrRollupStore (注入测试). */
function makeStore(objectives: Objective[], krs: KeyResult[]): OkrRollupStore & {
  _objectives: Map<string, Objective>;
} {
  const objMap = new Map(objectives.map((o) => [o.id, o]));
  const krMap = new Map(krs.map((k) => [k.id, k]));
  return {
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
    },
  };
}

// ---------------------------------------------------------------------------
// §A · 纯计算
// ---------------------------------------------------------------------------

describe('computeObjectiveProgress · 加权聚合', () => {
  it('按 KR weight 加权平均', () => {
    const o = makeObjective({ id: 'o1' });
    const krs = [
      makeKr({ id: 'k1', objectiveId: 'o1', currentValue: 100, weight: 3 }), // progress 1.0, w3
      makeKr({ id: 'k2', objectiveId: 'o1', currentValue: 0, weight: 1 }), // progress 0.0, w1
    ];
    // (3*1 + 1*0) / 4 = 0.75
    expect(computeObjectiveProgress('o1', krs, [o], new Map())).toBeCloseTo(0.75);
  });

  it('无贡献者 → 0', () => {
    const o = makeObjective({ id: 'o1' });
    expect(computeObjectiveProgress('o1', [], [o], new Map())).toBe(0);
  });

  it('abandoned KR 不计入', () => {
    const o = makeObjective({ id: 'o1' });
    const krs = [
      makeKr({ id: 'k1', objectiveId: 'o1', currentValue: 100, weight: 1 }),
      makeKr({ id: 'k2', objectiveId: 'o1', currentValue: 0, weight: 1, status: 'abandoned' }),
    ];
    // 只算 k1 → 1.0
    expect(computeObjectiveProgress('o1', krs, [o], new Map())).toBeCloseTo(1.0);
  });

  it('子 Objective 进度从 progressByObjective 取, 与 KR 一起加权', () => {
    const parent = makeObjective({ id: 'p', weight: 100 });
    const child = makeObjective({ id: 'c', parentObjectiveId: 'p', weight: 1 });
    const krs = [makeKr({ id: 'k1', objectiveId: 'p', currentValue: 100, weight: 1 })]; // 1.0
    const pm = new Map([['c', 0.5]]);
    // (1*1.0 + 1*0.5) / 2 = 0.75
    expect(computeObjectiveProgress('p', krs, [parent, child], pm)).toBeCloseTo(0.75);
  });
});

// ---------------------------------------------------------------------------
// §B · 真闭环传播
// ---------------------------------------------------------------------------

describe('propagateRollupFromKr · 真闭环 (KR → O → 父O)', () => {
  it('一条 KR 进度变化, 自动传播到所属 O 与顶层祖先', async () => {
    // 树: company(o-company) ← team(o-team) ← individual(o-ind), o-ind 有 1 个 KR
    const oCompany = makeObjective({ id: 'o-company', level: 'company', weight: 100 });
    const oTeam = makeObjective({
      id: 'o-team',
      level: 'team',
      parentObjectiveId: 'o-company',
      weight: 100,
    });
    const oInd = makeObjective({
      id: 'o-ind',
      level: 'individual',
      parentObjectiveId: 'o-team',
      weight: 100,
    });
    const kr = makeKr({ id: 'k1', objectiveId: 'o-ind', currentValue: 80, weight: 1 }); // 0.8

    const store = makeStore([oCompany, oTeam, oInd], [kr]);

    const results = await propagateRollupFromKr('k1', store);

    // 链上 3 个 O 都被重算
    expect(results.map((r) => r.objectiveId)).toEqual(['o-ind', 'o-team', 'o-company']);
    expect(results.every((r) => r.changed)).toBe(true);

    // 真值落库: 顶层 company 进度 = 0.8 (单链 100% 权重传导)
    expect(store._objectives.get('o-ind')!.currentProgress).toBeCloseTo(0.8);
    expect(store._objectives.get('o-team')!.currentProgress).toBeCloseTo(0.8);
    expect(store._objectives.get('o-company')!.currentProgress).toBeCloseTo(0.8);
  });

  it('progressOverride 优先: 子 O 被人工覆盖时, 父级用 override 聚合', async () => {
    const parent = makeObjective({ id: 'p', weight: 100 });
    // 子 O 被人工覆盖为 0.9, 其下 KR 实际只有 0.2
    const child = makeObjective({
      id: 'c',
      parentObjectiveId: 'p',
      weight: 1,
      progressOverride: 0.9,
    });
    const kr = makeKr({ id: 'k1', objectiveId: 'c', currentValue: 20, weight: 1 }); // 0.2

    const store = makeStore([parent, child], [kr]);
    await propagateRollupFromKr('k1', store);

    // 子 O 的 currentProgress 仍按真实算 (0.2), 但 override 不被覆盖
    expect(store._objectives.get('c')!.currentProgress).toBeCloseTo(0.2);
    expect(store._objectives.get('c')!.progressOverride).toBe(0.9);
    // 父级聚合用子 O 的 effective = override 0.9
    expect(store._objectives.get('p')!.currentProgress).toBeCloseTo(0.9);
  });

  it('未变化 (epsilon 内) 不写库, changed=false', async () => {
    const o = makeObjective({ id: 'o1', currentProgress: 0.5 });
    const kr = makeKr({ id: 'k1', objectiveId: 'o1', currentValue: 50, weight: 1 }); // 0.5
    const store = makeStore([o], [kr]);
    const results = await propagateRollupFromKr('k1', store);
    expect(results[0].changed).toBe(false);
  });

  it('找不到 KR → 空结果, 不抛', async () => {
    const store = makeStore([], []);
    await expect(propagateRollupFromKr('nope', store)).resolves.toEqual([]);
  });

  it('父子成环也不死循环 (visited 守卫)', async () => {
    const a = makeObjective({ id: 'a', parentObjectiveId: 'b' });
    const b = makeObjective({ id: 'b', parentObjectiveId: 'a' });
    const kr = makeKr({ id: 'k1', objectiveId: 'a', currentValue: 100, weight: 1 });
    const store = makeStore([a, b], [kr]);
    const results = await propagateRollupFromKr('k1', store);
    // 各访问一次即停
    expect(results.map((r) => r.objectiveId).sort()).toEqual(['a', 'b']);
  });
});
