/**
 * lib/okr/work-method.ts · 工作法 (周节奏驾驶舱) 分桶聚合 (2026-06-27)
 *
 * 对标 Tita「工作法」: 把 Objective 的行动项按"计划执行的周"分到
 *   本周 / 未来四周 / 遗留(过去周未完成) / backlog(未规划)。
 *
 * 单一真值: Initiative.weekOf (周锚点 ms, 已完整落库 Server.Initiative.weekOf)。
 *   桶位全部由 weekOf vs now 派生 → 防漂移 (过去的 weekOf 自动归"遗留")。
 *
 * 纯函数, 无副作用, 无写死。
 */

import type { Initiative, KeyResult, Objective } from '../store';

export type WorkHorizon = 'overdue' | 'this-week' | 'next-4-weeks' | 'later' | 'backlog';

const DAY = 24 * 60 * 60 * 1000;

/** 返回 ms 所在自然周的周一 00:00 (本地时区)。 */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=周日 .. 6=周六
  const backToMonday = (dow + 6) % 7; // 周一=0
  d.setDate(d.getDate() - backToMonday);
  return d.getTime();
}

/**
 * 按 weekOf 把行动项归桶 (相对 now)。
 *   - backlog:      未设 weekOf (未规划)
 *   - overdue:      weekOf 在过去的周 (计划过但没做完, 需重新安排)
 *   - this-week:    weekOf 落在本周
 *   - next-4-weeks: weekOf 在本周之后 1-4 周内
 *   - later:        weekOf 在 4 周以后
 */
export function bucketByWeekOf(weekOf: number | undefined | null, now: number): WorkHorizon {
  if (weekOf == null) return 'backlog';
  const thisWeek = startOfWeek(now);
  const wk = startOfWeek(weekOf);
  if (wk < thisWeek) return 'overdue';
  if (wk === thisWeek) return 'this-week';
  if (wk <= thisWeek + 4 * 7 * DAY) return 'next-4-weeks';
  return 'later';
}

/** 已完成/取消的行动项不再计入"遗留" (它已结束, 不需重排)。 */
function isClosed(i: Initiative): boolean {
  return i.status === 'done' || i.status === 'cancelled';
}

/**
 * 收集某 Objective 名下的行动项:
 *   - scope='objective' 且 scopeId === obj.id
 *   - scope='kr' 且 scopeId ∈ 该 O 的 KR ids
 */
export function initiativesForObjective(
  obj: Objective,
  keyResults: KeyResult[],
  initiatives: Initiative[],
): Initiative[] {
  const krIds = new Set(keyResults.filter((k) => k.objectiveId === obj.id).map((k) => k.id));
  return initiatives.filter(
    (i) =>
      (i.scope === 'objective' && i.scopeId === obj.id) ||
      (i.scope === 'kr' && krIds.has(i.scopeId)),
  );
}

export interface WorkMethodView {
  /** 按桶分组 (overdue/this-week/next-4-weeks/later/backlog) */
  buckets: Record<WorkHorizon, Initiative[]>;
  counts: Record<WorkHorizon, number>;
  /** 本周聚焦区 = 遗留 + 本周 (UI"本周工作"象限显示这一组) */
  thisWeekFocus: Initiative[];
}

const EMPTY_BUCKETS = (): Record<WorkHorizon, Initiative[]> => ({
  overdue: [], 'this-week': [], 'next-4-weeks': [], later: [], backlog: [],
});

/**
 * 构建工作法视图: 把某 Objective 的行动项分桶。
 * 已完成/取消项: 不进 overdue (按完成态保留在其原 weekOf 桶, 但通常 UI 会单独折叠)。
 */
export function buildWorkMethod(opts: {
  objective: Objective;
  keyResults: KeyResult[];
  initiatives: Initiative[];
  now: number;
}): WorkMethodView {
  const { objective, keyResults, initiatives, now } = opts;
  const own = initiativesForObjective(objective, keyResults, initiatives);
  const buckets = EMPTY_BUCKETS();

  for (const i of own) {
    let bucket = bucketByWeekOf(i.weekOf, now);
    // 已完成/取消但 weekOf 在过去 → 不算"遗留", 归回其计划周不打扰 (放 this-week 完成区或 backlog)
    if (bucket === 'overdue' && isClosed(i)) bucket = 'this-week';
    buckets[bucket].push(i);
  }

  const counts = Object.fromEntries(
    (Object.keys(buckets) as WorkHorizon[]).map((k) => [k, buckets[k].length]),
  ) as Record<WorkHorizon, number>;

  return {
    buckets,
    counts,
    thisWeekFocus: [...buckets.overdue, ...buckets['this-week']],
  };
}
