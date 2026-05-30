/**
 * OKR Calibration 服务单测 (vs Tita/WorkBoard 季末校准会议)
 *
 * 覆盖:
 *   1. recommendCalibratedScore · 4 路径 (无 self / 接近 / 高估 / 低估)
 *   2. detectDrift · 三级阈值 (≥0.2 high / ≥0.1 medium / <0.1 low)
 *   3. buildCalibrationGrid · 过滤 cycle + ownerId + 排序 high drift 先
 *   4. saveCalibrations · 批量 + 边界 (空 / 越界)
 *   5. 已校准 (managerScore != null) 走 manager vs self 的偏差
 */

import { describe, it, expect } from 'vitest';
import {
  recommendCalibratedScore,
  detectDrift,
  buildCalibrationGrid,
  saveCalibrations,
} from '../../lib/services/okr-calibration';
import type { Objective, KeyResult } from '../../lib/store';

const T0 = new Date('2026-04-01T00:00:00Z').getTime();

function makeObj(o: Partial<Objective> & { id: string; ownerId: string }): Objective {
  return {
    title: 'Test',
    cycleId: '2026Q2',
    parentId: null,
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    visibility: 'public',
    tags: [],
    createdAt: T0,
    updatedAt: T0,
    ...o,
  } as Objective;
}

function makeKr(k: Partial<KeyResult> & { id: string; objectiveId: string }): KeyResult {
  return {
    title: 'KR',
    ownerId: 'alice',
    type: 'numeric',
    startValue: 0,
    targetValue: 100,
    currentValue: 50,
    unit: '万元',
    weight: 100,
    confidence: 'on-track',
    status: 'active',
    tags: [],
    createdAt: T0,
    updatedAt: T0,
    ...k,
  } as KeyResult;
}

describe('recommendCalibratedScore', () => {
  it('无 self → 用 KR 实际进度', () => {
    const obj = makeObj({ id: 'o1', ownerId: 'alice' });
    const krs = [makeKr({ id: 'kr1', objectiveId: 'o1', currentValue: 60 })];
    const r = recommendCalibratedScore(obj, krs);
    expect(r.suggested).toBeCloseTo(0.6, 1);
    expect(r.reasoning).toContain('未自评');
  });

  it('self 与实际接近 (≤ 0.1) → 采用 self', () => {
    const obj = makeObj({ id: 'o1', ownerId: 'alice', selfScore: 0.65 });
    const krs = [makeKr({ id: 'kr1', objectiveId: 'o1', currentValue: 60 })];
    const r = recommendCalibratedScore(obj, krs);
    expect(r.suggested).toBe(0.65);
    expect(r.reasoning).toContain('接近');
    expect(r.reasoning).toContain('采用自评');
  });

  it('self 高估 (> 0.1) → 折中', () => {
    const obj = makeObj({ id: 'o1', ownerId: 'alice', selfScore: 0.9 });
    const krs = [makeKr({ id: 'kr1', objectiveId: 'o1', currentValue: 50 })];
    const r = recommendCalibratedScore(obj, krs);
    // (0.9 + 0.5) / 2 = 0.7
    expect(r.suggested).toBeCloseTo(0.7, 1);
    expect(r.reasoning).toContain('高估');
    expect(r.reasoning).toContain('折中');
  });

  it('self 低估 (> 0.1) → 折中', () => {
    const obj = makeObj({ id: 'o1', ownerId: 'alice', selfScore: 0.4 });
    const krs = [makeKr({ id: 'kr1', objectiveId: 'o1', currentValue: 80 })];
    const r = recommendCalibratedScore(obj, krs);
    expect(r.suggested).toBeCloseTo(0.6, 1);
    expect(r.reasoning).toContain('低估');
  });
});

describe('detectDrift · 三级阈值', () => {
  it('|self - suggested| < 0.1 → low', () => {
    const r = detectDrift(0.65, 0.7);
    expect(r.level).toBe('low');
  });

  it('|self - suggested| ∈ [0.1, 0.2) → medium', () => {
    const r1 = detectDrift(0.5, 0.65);
    expect(r1.level).toBe('medium');
    const r2 = detectDrift(0.5, 0.69);
    expect(r2.level).toBe('medium');
  });

  it('|self - suggested| ≥ 0.2 → high', () => {
    const r = detectDrift(0.4, 0.7);
    expect(r.level).toBe('high');
    expect(r.delta).toBeCloseTo(0.3, 1);
  });

  it('selfScore 为 null → low + 0', () => {
    const r = detectDrift(null, 0.5);
    expect(r.level).toBe('low');
    expect(r.delta).toBe(0);
  });

  it('已校准 → 用 managerScore 替代 suggested', () => {
    // self=0.5, suggested=0.65 (medium), 但 manager=0.85 → drift = |0.5-0.85| = 0.35 → high
    const r = detectDrift(0.5, 0.65, 0.85);
    expect(r.level).toBe('high');
    expect(r.delta).toBeCloseTo(0.35, 1);
  });
});

describe('buildCalibrationGrid', () => {
  it('过滤: 仅当前 cycle + 下属 ownerId', () => {
    const objs: Objective[] = [
      makeObj({ id: 'o1', ownerId: 'alice', cycleId: '2026Q2' }), // ✓
      makeObj({ id: 'o2', ownerId: 'bob', cycleId: '2026Q2' }), // ✓
      makeObj({ id: 'o3', ownerId: 'carol', cycleId: '2026Q2' }), // ✗ 非下属
      makeObj({ id: 'o4', ownerId: 'alice', cycleId: '2026Q1' }), // ✗ 旧周期
    ];
    const grid = buildCalibrationGrid({
      managerId: 'manager_x',
      cycleId: '2026Q2',
      subordinateIds: ['alice', 'bob'],
      allObjectives: objs,
      allKrs: [],
    });
    expect(grid.totalObjectives).toBe(2);
    expect(grid.subordinateCount).toBe(2);
  });

  it('排序: high drift 排前', () => {
    const objs: Objective[] = [
      makeObj({ id: 'o_low', ownerId: 'alice', selfScore: 0.65 }),  // 接近 → low
      makeObj({ id: 'o_high', ownerId: 'bob', selfScore: 0.9 }),    // 大偏差 → high
      makeObj({ id: 'o_med', ownerId: 'carol', selfScore: 0.55 }),  // 中等 → medium
    ];
    const krs: KeyResult[] = [
      makeKr({ id: 'k1', objectiveId: 'o_low', currentValue: 60 }),
      makeKr({ id: 'k2', objectiveId: 'o_high', currentValue: 30 }),
      makeKr({ id: 'k3', objectiveId: 'o_med', currentValue: 70 }),
    ];
    const grid = buildCalibrationGrid({
      managerId: 'manager_x',
      cycleId: '2026Q2',
      subordinateIds: ['alice', 'bob', 'carol'],
      allObjectives: objs,
      allKrs: krs,
    });
    expect(grid.rows[0].drift).toBe('high'); // bob 自评 0.9 vs 进度 0.3 → high
    expect(grid.rows[grid.rows.length - 1].drift).toBe('low'); // alice
  });

  it('pendingCount 排除已校准', () => {
    const objs: Objective[] = [
      makeObj({ id: 'o1', ownerId: 'alice', selfScore: 0.7, managerScore: 0.7 }),
      makeObj({ id: 'o2', ownerId: 'bob', selfScore: 0.5 }),
    ];
    const grid = buildCalibrationGrid({
      managerId: 'mx',
      cycleId: '2026Q2',
      subordinateIds: ['alice', 'bob'],
      allObjectives: objs,
      allKrs: [],
    });
    expect(grid.totalObjectives).toBe(2);
    expect(grid.pendingCount).toBe(1); // 仅 o2 未校准
  });

  it('highDriftCount 计数', () => {
    const objs: Objective[] = [
      makeObj({ id: 'o1', ownerId: 'a', selfScore: 0.9 }),
      makeObj({ id: 'o2', ownerId: 'b', selfScore: 0.85 }),
      makeObj({ id: 'o3', ownerId: 'c', selfScore: 0.65 }),
    ];
    const krs: KeyResult[] = [
      makeKr({ id: 'k1', objectiveId: 'o1', currentValue: 30 }), // self 0.9, actual 0.3 → high
      makeKr({ id: 'k2', objectiveId: 'o2', currentValue: 25 }), // self 0.85, actual 0.25 → high
      makeKr({ id: 'k3', objectiveId: 'o3', currentValue: 60 }), // self 0.65, actual 0.6 → low
    ];
    const grid = buildCalibrationGrid({
      managerId: 'mx',
      cycleId: '2026Q2',
      subordinateIds: ['a', 'b', 'c'],
      allObjectives: objs,
      allKrs: krs,
    });
    expect(grid.highDriftCount).toBe(2);
  });

  it('ownerNameMap 注入显示名', () => {
    const objs: Objective[] = [makeObj({ id: 'o1', ownerId: 'alice' })];
    const grid = buildCalibrationGrid({
      managerId: 'mx',
      cycleId: '2026Q2',
      subordinateIds: ['alice'],
      allObjectives: objs,
      allKrs: [],
      ownerNameMap: { alice: '张伟' },
    });
    expect(grid.rows[0].ownerName).toBe('张伟');
  });
});

describe('saveCalibrations', () => {
  it('批量写 managerScore + reviewedAt', async () => {
    const calls: Array<{ id: string; patch: Partial<Objective> }> = [];
    const result = await saveCalibrations({
      managerId: 'mx',
      cycleId: '2026Q2',
      updates: [
        { objectiveId: 'o1', managerScore: 0.7 },
        { objectiveId: 'o2', managerScore: 0.5 },
      ],
      updateObjective: (id, patch) => calls.push({ id, patch }),
    });
    expect(result.appliedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(calls.length).toBe(2);
    expect(calls[0].patch.managerScore).toBe(0.7);
    expect(calls[0].patch.reviewedAt).toBeTruthy();
  });

  it('空 objectiveId 跳过', async () => {
    const result = await saveCalibrations({
      managerId: 'mx',
      cycleId: '2026Q2',
      updates: [{ objectiveId: '', managerScore: 0.5 }],
      updateObjective: () => {},
    });
    expect(result.appliedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('managerScore 越界跳过 (< 0 / > 1)', async () => {
    const calls: number[] = [];
    const result = await saveCalibrations({
      managerId: 'mx',
      cycleId: '2026Q2',
      updates: [
        { objectiveId: 'o1', managerScore: -0.1 }, // skip
        { objectiveId: 'o2', managerScore: 1.5 }, // skip
        { objectiveId: 'o3', managerScore: 0.5 }, // ok
      ],
      updateObjective: () => calls.push(1),
    });
    expect(result.appliedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
  });

  it('managerScore=null 允许 (清空校准)', async () => {
    const calls: Partial<Objective>[] = [];
    const result = await saveCalibrations({
      managerId: 'mx',
      cycleId: '2026Q2',
      updates: [{ objectiveId: 'o1', managerScore: null }],
      updateObjective: (_, patch) => calls.push(patch),
    });
    expect(result.appliedCount).toBe(1);
    expect(calls[0].managerScore).toBeNull();
  });
});
