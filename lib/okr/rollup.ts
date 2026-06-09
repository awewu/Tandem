/**
 * lib/okr/rollup.ts · OKR 真 rollup 引擎 (P0·B2 · 2026-06-02)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的假闭环 (OKR-EVOLUTION-PLAN §1.3):
 *   旧状态: `okr.kr-progressed` 事件发了, 但 subscribers.ts 只打日志, 进度不向上传播;
 *           服务端 Objective 模型连"当前进度"字段都没有, 进度只活在 localStorage UI store.
 *           => Tandem 的"OKR 自动驱动"是假闭环.
 *
 *   本引擎: KR.currentValue 变化 → 重算所属 Objective.currentProgress (KR 加权 + 子 O 加权)
 *           → 沿 parentObjectiveId 链向上递归重算到顶层 (公司 ← 团队 ← 个人, 最多 3 层).
 *           真值落服务端 Objective.currentProgress 字段.
 *
 * 设计原则:
 *   - 纯函数 computeObjectiveProgress 可独立单测 (不碰 store).
 *   - propagate* 走最小化 store 接口 (OkrRollupStore), 便于测试注入内存实现.
 *   - 聚合用 effective 进度 (人工覆盖优先), 持久化只写 currentProgress (绝不覆盖人工 override).
 *   - 防环: visited set 守卫 (即便数据出现父子环也不死循环).
 */

import {
  type Objective,
  type KeyResult,
  computeKRProgress,
  effectiveObjectiveProgress,
} from '@/lib/types/okr-tti';

// ---------------------------------------------------------------------------
// Store 接口 (最小化, 便于测试注入)
// ---------------------------------------------------------------------------

export interface OkrRollupStore {
  objectives: {
    get(id: string): Promise<Objective | null>;
    list(): Promise<Objective[]>;
    update(id: string, patch: Partial<Objective>): Promise<unknown>;
  };
  keyResults: {
    get(id: string): Promise<KeyResult | null>;
    list(): Promise<KeyResult[]>;
  };
}

/** 单个 Objective 的 rollup 结果 (供事件/审计/调试). */
export interface ObjectiveRollupResult {
  objectiveId: string;
  /** rollup 前的 currentProgress (可能 undefined → 视为 0) */
  from: number;
  /** rollup 后的 currentProgress */
  to: number;
  /** 是否真的写库 (变化超过 epsilon 才写) */
  changed: boolean;
}

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// §A · 纯计算 (无 IO, 可独立单测)
// ---------------------------------------------------------------------------

/**
 * 计算单个 Objective 的进度 (0-1).
 *   贡献者 = 自身直属 KR (按 KR.weight) + 直属子 Objective (按 child.weight).
 *   子 Objective 的进度从 progressByObjective 取 (调用方保证已自底向上算好);
 *   取不到时回退到该子 O 的 effective 进度 (override ?? currentProgress).
 *
 * abandoned 的 KR / 子 O 不计入. 无贡献者 → 0.
 */
export function computeObjectiveProgress(
  objectiveId: string,
  allKrs: KeyResult[],
  allObjectives: Objective[],
  progressByObjective: Map<string, number>,
): number {
  const krs = allKrs.filter((k) => k.objectiveId === objectiveId && k.status !== 'abandoned');
  const children = allObjectives.filter(
    (o) => o.parentObjectiveId === objectiveId && o.status !== 'abandoned',
  );

  const contributors: Array<{ weight: number; progress: number }> = [];
  for (const kr of krs) {
    contributors.push({ weight: kr.weight > 0 ? kr.weight : 1, progress: computeKRProgress(kr) });
  }
  for (const child of children) {
    const p = progressByObjective.get(child.id) ?? effectiveObjectiveProgress(child);
    contributors.push({ weight: child.weight > 0 ? child.weight : 1, progress: p });
  }

  if (contributors.length === 0) return 0;
  const totalWeight = contributors.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = contributors.reduce((s, c) => s + c.weight * c.progress, 0);
  return clamp01(weighted / totalWeight);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// ---------------------------------------------------------------------------
// §B · 传播 (向上 rollup, 带 IO)
// ---------------------------------------------------------------------------

/**
 * 从一个 KR 触发 rollup: 找到所属 Objective 后向上传播.
 * 返回链上每个被重算的 Objective 结果 (从叶到根).
 */
export async function propagateRollupFromKr(
  krId: string,
  store: OkrRollupStore,
): Promise<ObjectiveRollupResult[]> {
  const kr = await store.keyResults.get(krId);
  if (!kr) return [];
  return propagateRollupFromObjective(kr.objectiveId, store);
}

/**
 * 从一个 Objective 触发 rollup, 沿 parentObjectiveId 链向上重算到顶层.
 *
 * 自底向上: 先算触发的 O, 把它的 effective 进度写进 progressMap, 父级再用它聚合,
 * 这样一次遍历即可把整条链算准 (子先于父).
 */
export async function propagateRollupFromObjective(
  startObjectiveId: string,
  store: OkrRollupStore,
): Promise<ObjectiveRollupResult[]> {
  const [allObjectives, allKrs] = await Promise.all([
    store.objectives.list(),
    store.keyResults.list(),
  ]);

  const byId = new Map<string, Objective>(allObjectives.map((o) => [o.id, o]));

  // progressMap 存 effective 进度, 供父级聚合 (初始化为各自当前 effective).
  const progressMap = new Map<string, number>();
  for (const o of allObjectives) progressMap.set(o.id, effectiveObjectiveProgress(o));

  const results: ObjectiveRollupResult[] = [];
  const visited = new Set<string>();
  const nowIso = new Date().toISOString();

  let currentId: string | undefined = startObjectiveId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const obj = byId.get(currentId);
    if (!obj) break;

    const computed = computeObjectiveProgress(currentId, allKrs, allObjectives, progressMap);
    const prev = obj.currentProgress ?? 0;
    const changed = Math.abs(prev - computed) > EPSILON;

    if (changed) {
      await store.objectives.update(currentId, {
        currentProgress: computed,
        updatedAt: nowIso,
      });
    }

    // 父级聚合用 effective: 人工 override 存在则父级仍以 override 为准.
    const effectiveForParent = obj.progressOverride != null ? obj.progressOverride : computed;
    progressMap.set(currentId, effectiveForParent);

    results.push({ objectiveId: currentId, from: prev, to: computed, changed });

    currentId = obj.parentObjectiveId;
  }

  return results;
}
