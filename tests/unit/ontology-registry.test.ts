/**
 * ON-0 · 本体对象注册表单测 (2026-06-09)
 *
 * 验证: 核心对象类型 (Objective/KeyResult/Initiative) 的 resolve / derived 真值 /
 *       关系 traverse (正向+反向) / 确定性 search 全部委托 getStore 正常工作。
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore, getStore } from '@/lib/storage/repository';
import { ontology, ensureCoreObjectTypes } from '@/lib/ontology';
import type { Objective, KeyResult, Initiative } from '@/lib/types/okr-tti';

const NOW = '2026-06-09T00:00:00.000Z';

function obj(p: Partial<Objective> & Pick<Objective, 'id' | 'title'>): Objective {
  return {
    cycleId: 'cyc-1',
    level: 'company',
    ownerId: 'u-1',
    visibility: 'public',
    weight: 100,
    status: 'active',
    confidence: 'on-track',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  } as Objective;
}

function kr(p: Partial<KeyResult> & Pick<KeyResult, 'id' | 'title' | 'objectiveId'>): KeyResult {
  return {
    ownerId: 'u-1',
    coOwnerIds: [],
    measureType: 'numeric',
    computeMethod: 'latest',
    startValue: 0,
    targetValue: 100,
    currentValue: 0,
    confidence: 'on-track',
    riskStatus: 'on_track',
    weight: 1,
    status: 'active',
    tags: [],
    collaboratorIds: [],
    watcherIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...p,
  } as KeyResult;
}

function init(p: Partial<Initiative> & Pick<Initiative, 'id' | 'title' | 'keyResultId'>): Initiative {
  return { ownerId: 'u-1', status: 'planned', ...p } as Initiative;
}

describe('ON-0 · ontology registry', () => {
  beforeAll(() => {
    ensureCoreObjectTypes();
  });

  beforeEach(async () => {
    const store = createInMemoryStore();
    setStore(store);
    // 种一张图: O(company) → O(team, child) → KR → Initiative
    await store.objectives.create(obj({ id: 'o-co', title: '公司目标: 新签增长', currentProgress: 0.4 }));
    await store.objectives.create(
      obj({ id: 'o-team', title: '团队目标: 提升转化', level: 'team', parentObjectiveId: 'o-co', currentProgress: 0.6 }),
    );
    await store.keyResults.create(
      kr({ id: 'kr-1', title: 'KR: 新签客户 30 家', objectiveId: 'o-team', startValue: 0, targetValue: 100, currentValue: 30 }),
    );
    await store.initiatives.create(init({ id: 'i-1', title: '行动: 拓客活动', keyResultId: 'kr-1' }));
  });

  it('注册了核心对象类型', () => {
    expect(ontology.has('Objective')).toBe(true);
    expect(ontology.has('KeyResult')).toBe(true);
    expect(ontology.has('Initiative')).toBe(true);
  });

  it('resolve 返回对象 + 派生真值 + 关系元信息', async () => {
    const r = await ontology.resolve('KeyResult', 'kr-1');
    expect(r).not.toBeNull();
    expect(r!.type).toBe('KeyResult');
    expect((r!.data as KeyResult).title).toContain('新签客户');
    // computeKRProgress: (30-0)/(100-0) = 0.3
    expect(r!.derived.progress).toBeCloseTo(0.3, 5);
    expect(r!.links.map((l) => l.name).sort()).toEqual(['initiatives', 'objective']);
  });

  it('Objective derived effectiveProgress 用 rollup 真值', async () => {
    const r = await ontology.resolve('Objective', 'o-co');
    expect(r!.derived.effectiveProgress).toBeCloseTo(0.4, 5);
  });

  it('resolve 不存在的对象/未注册类型 → null', async () => {
    expect(await ontology.resolve('KeyResult', 'nope')).toBeNull();
    expect(await ontology.resolve('NotAType', 'x')).toBeNull();
  });

  it('traverse 正向关系 (KR → Objective)', async () => {
    const r = await ontology.traverse('KeyResult', 'kr-1', 'objective');
    expect(Array.isArray(r)).toBe(false);
    const ro = r as Awaited<ReturnType<typeof ontology.resolve>>;
    expect(ro!.type).toBe('Objective');
    expect(ro!.id).toBe('o-team');
    // 目标类型已注册 → 附派生真值
    expect(ro!.derived.effectiveProgress).toBeCloseTo(0.6, 5);
  });

  it('traverse 反向关系 (Objective → keyResults, many)', async () => {
    const r = await ontology.traverse('Objective', 'o-team', 'keyResults');
    expect(Array.isArray(r)).toBe(true);
    const arr = r as Array<{ id: string }>;
    expect(arr.map((x) => x.id)).toEqual(['kr-1']);
  });

  it('traverse 父子关系 (Objective.parent / children)', async () => {
    const parent = await ontology.traverse('Objective', 'o-team', 'parent');
    expect((parent as { id: string }).id).toBe('o-co');
    const children = await ontology.traverse('Objective', 'o-co', 'children');
    expect((children as Array<{ id: string }>).map((x) => x.id)).toEqual(['o-team']);
  });

  it('traverse KR → initiatives (many)', async () => {
    const r = await ontology.traverse('KeyResult', 'kr-1', 'initiatives');
    expect((r as Array<{ id: string }>).map((x) => x.id)).toEqual(['i-1']);
  });

  it('traverse 不存在的关系名 → null', async () => {
    expect(await ontology.traverse('KeyResult', 'kr-1', 'nope')).toBeNull();
  });

  it('search 确定性子串匹配', async () => {
    const hits = await ontology.search('Objective', '新签');
    expect(hits.map((h) => h.id)).toContain('o-co');
    expect(hits.map((h) => h.id)).not.toContain('o-team');
    // 空 query → 全量 (受 limit)
    const all = await ontology.search('Objective', '');
    expect(all.length).toBe(2);
  });

  it('search 未注册类型 → 空数组', async () => {
    expect(await ontology.search('NotAType', 'x')).toEqual([]);
  });

  it('list 兜底: getStore 已就绪不抛', async () => {
    // 确保 resolver 真的走了 getStore (而非缓存)
    const kr1 = await getStore().keyResults.get('kr-1');
    expect(kr1?.id).toBe('kr-1');
  });
});
