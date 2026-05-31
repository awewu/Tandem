/**
 * lib/store/okr-sync.ts · OKR 读路径后端收敛 (B4 Phase-1, 2026-05-31)
 *
 * 问题 (PRODUCTION-AUDIT B4 · 状态双轨): /okr 主页面读写纯客户端 zustand (localStorage),
 * 而后端 store.objectives/keyResults/cycles + /api/tandem-okr 是另一套真值. 两套易漂移.
 *
 * 本文件做"读路径收敛"(对齐 org.ts/hydrateFromGovernance 的既有安全范式):
 *   - 拉 /api/tandem-okr (服务端 SSOT)
 *   - 把服务端类型映射成客户端 zustand 类型 (字段名/枚举/时间戳有差异)
 *   - **仅当后端有 objectives 时**才替换本地 (后端空 → 保留本地, 不破坏 demo/离线)
 *
 * 不在本阶段 (B4 Phase-2, 需独立专项):
 *   - 写路径 dual-write (20 个 mutation 逐个挂后端 POST/PATCH) — 部分端点尚缺
 *   - comments / activities / initiatives 的后端往返
 */

import type * as Server from '../types/okr-tti';
import {
  useOKRStore,
  type Objective,
  type KeyResult,
  type Cycle,
  type ObjectiveStatus,
  type CycleType,
} from './okr';

const toMs = (iso: string | null | undefined): number =>
  iso ? Date.parse(iso) : Date.now();

/** 服务端 CyclePeriod → 客户端 CycleType (bi_monthly/custom 回落 month) */
export function mapCyclePeriod(period: Server.CyclePeriod): CycleType {
  if (period === 'year' || period === 'half' || period === 'quarter' || period === 'month') {
    return period;
  }
  return 'month';
}

export function mapServerCycle(c: Server.Cycle): Cycle {
  return {
    id: c.id,
    name: c.name,
    type: mapCyclePeriod(c.period),
    startDate: toMs(c.startDate),
    endDate: toMs(c.endDate),
    isActive: c.isActive,
  };
}

/** 服务端 ObjectiveStatus ('abandoned') → 客户端 ('archived') */
export function mapObjectiveStatus(s: Server.ObjectiveStatus): ObjectiveStatus {
  return s === 'abandoned' ? 'archived' : s;
}

/** 服务端 visibility ('team') → 客户端 ('department') */
function mapVisibility(v: Server.Objective['visibility']): Objective['visibility'] {
  return v === 'team' ? 'department' : v;
}

export function mapServerObjective(o: Server.Objective): Objective {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    cycleId: o.cycleId,
    ownerId: o.ownerId,
    parentId: o.parentObjectiveId ?? null,
    weight: o.weight,
    status: mapObjectiveStatus(o.status),
    confidence: o.confidence,
    visibility: mapVisibility(o.visibility),
    tags: o.tags ?? [],
    collaborators: o.collaboratorIds ?? [],
    watchers: o.watcherIds ?? [],
    progressOverride: null,
    score: o.finalScore ?? null,
    selfScore: o.selfScore ?? null,
    managerScore: o.managerScore ?? null,
    retrospective: o.retrospective ?? undefined,
    reviewedAt: o.reviewedAt ? toMs(o.reviewedAt) : undefined,
    createdAt: toMs(o.createdAt),
    updatedAt: toMs(o.updatedAt),
  };
}

export function mapServerKeyResult(k: Server.KeyResult): KeyResult {
  return {
    id: k.id,
    objectiveId: k.objectiveId,
    title: k.title,
    ownerId: k.ownerId,
    type: k.measureType,
    startValue: k.startValue,
    currentValue: k.currentValue,
    targetValue: k.targetValue,
    unit: k.unit ?? '',
    weight: k.weight,
    confidence: k.confidence,
    status: k.status,
    dueDate: k.dueDate ? toMs(k.dueDate) : undefined,
    tags: k.tags ?? [],
    collaborators: k.collaboratorIds ?? [],
    watchers: k.watcherIds ?? [],
    selfScore: k.selfScore ?? null,
    finalScore: k.finalScore ?? null,
    createdAt: toMs(k.createdAt),
    updatedAt: toMs(k.updatedAt),
  };
}

/** /api/tandem-okr 的 objective 形态: server Objective + 内嵌 keyResults[] */
type ServerObjectiveWithKrs = Server.Objective & { keyResults?: Server.KeyResult[] };

/**
 * 拉 /api/tandem-okr 并把本地 OKR store 收敛到后端真值.
 *
 * 守卫: 后端无 objectives → 不动本地 (保留 demo / 离线数据), 返回 false.
 * 成功替换返回 true. 仅浏览器调用.
 */
export async function hydrateOkrFromApi(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const r = await fetch('/api/tandem-okr', { cache: 'no-store', credentials: 'include' });
    if (!r.ok) return false;
    const j = await r.json();
    const serverObjs = (Array.isArray(j.objectives) ? j.objectives : []) as ServerObjectiveWithKrs[];
    // 后端空 → 保留本地 (与 org hydrate 同范式)
    if (serverObjs.length === 0) return false;

    const objectives: Objective[] = serverObjs.map(mapServerObjective);
    const keyResults: KeyResult[] = serverObjs.flatMap((o) =>
      (o.keyResults ?? []).map(mapServerKeyResult),
    );
    const serverCycles = (Array.isArray(j.cycles) ? j.cycles : []) as Server.Cycle[];
    const cycles: Cycle[] = serverCycles.map(mapServerCycle);

    const st = useOKRStore.getState();
    const activeCycleId =
      cycles.find((c) => c.isActive)?.id ?? cycles[0]?.id ?? st.activeCycleId;

    st.replaceAll({
      ...(cycles.length > 0 ? { cycles } : {}),
      objectives,
      keyResults,
      activeCycleId,
    });
    return true;
  } catch {
    // 离线 / 401 / 解析错误都不阻塞 UI
    return false;
  }
}
