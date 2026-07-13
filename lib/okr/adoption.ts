/**
 * lib/okr/adoption.ts · OKR 采纳/推行指标 (组织级三率 + 分布, 2026-06-25)
 *
 * 对标 Tita OKR 仪表盘 (见 docs/COMPETITOR-TITA-2026-06.md §二):
 *   - 填写率 (coverage):   有 OKR 的人 / 总人数
 *   - 对齐率 (alignment):  挂了上级的 O / 总 O
 *   - 执行分解率 (breakdown): O→KR→执行项 拆到位的 O / 总 O
 *   - 分布: 每人负责 O 数 / 每个 O 下 KR 数 (直方图揪"没填"和"过载/过细")
 *
 * 纯函数, 无副作用。可被 dashboard 与首页 AI 风险驾驶舱共用。
 */

import type { Initiative, KeyResult, Objective, Person } from '../store';

export interface AdoptionRates {
  /** 填写率 0-100 */
  coverage: number;
  /** 对齐率 0-100 */
  alignment: number;
  /** 执行分解率 0-100 */
  breakdown: number;
  totalPeople: number;
  peopleWithOkr: number;
  totalObjectives: number;
  alignedObjectives: number;
  brokenDownObjectives: number;
}

/** 判断某 person 是否拥有该 objective (兼容 'person:X' / 裸 id 两种 ownerId 写法) */
function personOwns(obj: Objective, personId: string): boolean {
  return obj.ownerId === personId || obj.ownerId === `person:${personId}`;
}

function pct(numer: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((numer / denom) * 100);
}

/**
 * 三率。objectives 应已按周期过滤。
 */
export function computeAdoptionRates(opts: {
  objectives: Objective[];
  keyResults: KeyResult[];
  initiatives: Initiative[];
  people: Person[];
}): AdoptionRates {
  const { objectives, keyResults, initiatives, people } = opts;

  // 填写率: 至少拥有 1 个 O 的人数 / 总人数
  const peopleWithOkr = people.filter((p) =>
    objectives.some((o) => personOwns(o, p.id)),
  ).length;

  // 对齐率: parentId 非空的 O / 总 O
  const alignedObjectives = objectives.filter((o) => o.parentId != null).length;

  // 执行分解率: 有 ≥1 KR 且 (该 O 或其 KR 上有 ≥1 Initiative) 的 O / 总 O
  const krByObj = new Map<string, string[]>(); // objId → krIds
  for (const k of keyResults) {
    const arr = krByObj.get(k.objectiveId) ?? [];
    arr.push(k.id);
    krByObj.set(k.objectiveId, arr);
  }
  const initOnObj = new Set<string>(); // objId with ≥1 initiative on it
  const initOnKr = new Set<string>(); // krId with ≥1 initiative on it
  for (const i of initiatives) {
    if (i.scope === 'objective') initOnObj.add(i.scopeId);
    else if (i.scope === 'kr') initOnKr.add(i.scopeId);
  }
  const brokenDownObjectives = objectives.filter((o) => {
    const krIds = krByObj.get(o.id) ?? [];
    if (krIds.length === 0) return false;
    return initOnObj.has(o.id) || krIds.some((kid) => initOnKr.has(kid));
  }).length;

  return {
    coverage: pct(peopleWithOkr, people.length),
    alignment: pct(alignedObjectives, objectives.length),
    breakdown: pct(brokenDownObjectives, objectives.length),
    totalPeople: people.length,
    peopleWithOkr,
    totalObjectives: objectives.length,
    alignedObjectives,
    brokenDownObjectives,
  };
}

// ---------------------------------------------------------------------------
// 分布直方图
// ---------------------------------------------------------------------------

export interface ObjectivesPerPersonDist {
  /** 未设置 OKR 的人数 */
  none: number;
  /** 恰好 1 个 O */
  one: number;
  /** 2-4 个 O */
  twoToFour: number;
  /** 5 个及以上 (目标过载) */
  fivePlus: number;
}

export function objectivesPerPersonDist(
  objectives: Objective[],
  people: Person[],
): ObjectivesPerPersonDist {
  const dist: ObjectivesPerPersonDist = { none: 0, one: 0, twoToFour: 0, fivePlus: 0 };
  for (const p of people) {
    const n = objectives.filter((o) => personOwns(o, p.id)).length;
    if (n === 0) dist.none++;
    else if (n === 1) dist.one++;
    else if (n <= 4) dist.twoToFour++;
    else dist.fivePlus++;
  }
  return dist;
}

export interface KrsPerObjectiveDist {
  /** 未设置 KR (只有空 O) */
  none: number;
  /** 1-2 个 KR */
  oneToTwo: number;
  /** 3-5 个 KR (推荐区间) */
  threeToFive: number;
  /** 5 个以上 (过细) */
  fivePlus: number;
}

export function krsPerObjectiveDist(
  objectives: Objective[],
  keyResults: KeyResult[],
): KrsPerObjectiveDist {
  const dist: KrsPerObjectiveDist = { none: 0, oneToTwo: 0, threeToFive: 0, fivePlus: 0 };
  const countByObj = new Map<string, number>();
  for (const k of keyResults) {
    countByObj.set(k.objectiveId, (countByObj.get(k.objectiveId) ?? 0) + 1);
  }
  for (const o of objectives) {
    const n = countByObj.get(o.id) ?? 0;
    if (n === 0) dist.none++;
    else if (n <= 2) dist.oneToTwo++;
    else if (n <= 5) dist.threeToFive++;
    else dist.fivePlus++;
  }
  return dist;
}
