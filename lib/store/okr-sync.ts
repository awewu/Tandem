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
  type CheckIn,
  type Initiative,
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

/** 服务端 CheckIn → 客户端 (createdAt string → ms; null → undefined) */
export function mapServerCheckIn(c: Server.CheckIn): CheckIn {
  return {
    id: c.id,
    scope: c.scope,
    scopeId: c.scopeId,
    authorId: c.authorId,
    progressBefore: c.progressBefore,
    progressAfter: c.progressAfter,
    confidenceBefore: c.confidenceBefore,
    confidenceAfter: c.confidenceAfter,
    achievements: c.achievements ?? undefined,
    blockers: c.blockers ?? undefined,
    nextSteps: c.nextSteps ?? undefined,
    mood: c.mood ?? undefined,
    createdAt: toMs(c.createdAt),
  };
}

/** 服务端 Initiative status → 客户端 ('planned'→'todo', 'in_progress'→'in-progress') */
function mapInitiativeStatus(s: Server.Initiative['status']): Initiative['status'] {
  if (s === 'planned') return 'todo';
  if (s === 'in_progress') return 'in-progress';
  return s; // done | blocked 同名
}

/** 服务端 Initiative → 客户端 (服务端只挂 KR; scope 固定 'kr') */
export function mapServerInitiative(i: Server.Initiative): Initiative {
  return {
    id: i.id,
    scope: 'kr',
    scopeId: i.keyResultId,
    title: i.title,
    ownerId: i.ownerId,
    status: mapInitiativeStatus(i.status),
    priority: 'medium',
    dueDate: i.dueDate ? toMs(i.dueDate) : undefined,
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** /api/tandem-okr 的 objective 形态: server Objective + 内嵌 keyResults[] */
type ServerObjectiveWithKrs = Server.Objective & { keyResults?: Server.KeyResult[] };

async function fetchCheckIns(): Promise<CheckIn[]> {
  try {
    const r = await fetch('/api/okr/checkins', { cache: 'no-store', credentials: 'include' });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = (Array.isArray(j.checkIns) ? j.checkIns : []) as Server.CheckIn[];
    return arr.map(mapServerCheckIn);
  } catch {
    return [];
  }
}

async function fetchInitiatives(): Promise<Initiative[]> {
  try {
    const r = await fetch('/api/okr/initiatives', { cache: 'no-store', credentials: 'include' });
    if (!r.ok) return [];
    const j = await r.json();
    const arr = (Array.isArray(j.initiatives) ? j.initiatives : []) as Server.Initiative[];
    return arr.map(mapServerInitiative);
  } catch {
    return [];
  }
}

/**
 * 拉 /api/tandem-okr 并把本地 OKR store 收敛到后端真值.
 *
 * 守卫: 后端无 objectives → 不动本地 (保留 demo / 离线数据), 返回 false.
 * 成功替换返回 true. 仅浏览器调用.
 */
export async function hydrateOkrFromApi(force = false): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const r = await fetch('/api/tandem-okr', { cache: 'no-store', credentials: 'include' });
    if (!r.ok) return false;
    const j = await r.json();
    const serverObjs = (Array.isArray(j.objectives) ? j.objectives : []) as ServerObjectiveWithKrs[];
    // 后端空 → 默认保留本地 (与 org hydrate 同范式); force=true 时仍替换 (写路径删除后需反映).
    if (serverObjs.length === 0 && !force) return false;

    const objectives: Objective[] = serverObjs.map(mapServerObjective);
    const keyResults: KeyResult[] = serverObjs.flatMap((o) =>
      (o.keyResults ?? []).map(mapServerKeyResult),
    );
    const serverCycles = (Array.isArray(j.cycles) ? j.cycles : []) as Server.Cycle[];
    const cycles: Cycle[] = serverCycles.map(mapServerCycle);

    // check-in / initiative 也从后端拉 (DB 是唯一真值, 不再依赖 localStorage).
    const [checkIns, initiatives] = await Promise.all([
      fetchCheckIns(),
      fetchInitiatives(),
    ]);

    const st = useOKRStore.getState();
    const activeCycleId =
      cycles.find((c) => c.isActive)?.id ?? cycles[0]?.id ?? st.activeCycleId;

    st.replaceAll({
      ...(cycles.length > 0 ? { cycles } : {}),
      objectives,
      keyResults,
      checkIns,
      initiatives,
      activeCycleId,
    });
    return true;
  } catch {
    // 离线 / 401 / 解析错误都不阻塞 UI
    return false;
  }
}

// ===========================================================================
// 写路径落库 (B4 Phase-2, 2026-06-17)
//
// /okr 页面的创建/编辑/删除此前只写客户端 zustand (localStorage), 刷新即丢.
// 下列 helper 把写操作落到后端 (/api/tandem-okr · /api/okr/key-results),
// 调用方写完后 await hydrateOkrFromApi(true) 收敛到后端真值 (含服务端生成的 id).
// ===========================================================================

/** ownerId 仅当是真实用户 id 时才下传; 否则交给服务端默认 (= 当前登录用户). */
function realOwnerId(id?: string | null): string | undefined {
  return id && id.startsWith('user_') ? id : undefined;
}

/** 客户端 ObjectiveStatus → 服务端 ('draft' 回落 active, 'archived' → abandoned) */
function clientObjStatusToServer(s?: ObjectiveStatus): Server.ObjectiveStatus {
  if (s === 'archived') return 'abandoned';
  if (s === 'draft' || !s) return 'active';
  return s as Server.ObjectiveStatus;
}

/** 客户端 visibility → 服务端 ('department' → 'team') */
function clientVisibilityToServer(v?: Objective['visibility']): Server.Objective['visibility'] {
  return v === 'department' ? 'team' : (v ?? 'public');
}

function objectiveToBody(o: Partial<Objective>): Record<string, unknown> {
  return {
    cycleId: o.cycleId,
    parentObjectiveId: o.parentId ?? undefined,
    ownerId: realOwnerId(o.ownerId),
    title: o.title,
    description: o.description,
    visibility: clientVisibilityToServer(o.visibility),
    weight: typeof o.weight === 'number' ? o.weight : 100,
    status: clientObjStatusToServer(o.status),
    confidence: o.confidence ?? 'on-track',
    tags: o.tags ?? [],
    collaboratorIds: o.collaborators ?? [],
    watcherIds: o.watchers ?? [],
  };
}

function keyResultToBody(kr: Partial<KeyResult>): Record<string, unknown> {
  return {
    objectiveId: kr.objectiveId,
    ownerId: realOwnerId(kr.ownerId),
    title: kr.title,
    measureType: kr.type ?? 'numeric',
    startValue: typeof kr.startValue === 'number' ? kr.startValue : 0,
    targetValue: typeof kr.targetValue === 'number' ? kr.targetValue : 100,
    currentValue: typeof kr.currentValue === 'number' ? kr.currentValue : 0,
    unit: kr.unit ?? '',
    weight: typeof kr.weight === 'number' ? kr.weight : 1,
    confidence: kr.confidence ?? 'on-track',
    status: kr.status ?? 'active',
    dueDate: kr.dueDate ? new Date(kr.dueDate).toISOString() : undefined,
    tags: kr.tags ?? [],
    collaboratorIds: kr.collaborators ?? [],
    watcherIds: kr.watchers ?? [],
  };
}

async function postJson(url: string, body: unknown, method = 'POST'): Promise<any> {
  const r = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

/** 新建 objective → 返回服务端生成的 id */
export async function persistCreateObjective(o: Partial<Objective>): Promise<string> {
  const j = await postJson('/api/tandem-okr', objectiveToBody(o));
  return j?.objective?.id as string;
}

export async function persistUpdateObjective(id: string, o: Partial<Objective>): Promise<void> {
  await postJson(`/api/tandem-okr/${encodeURIComponent(id)}`, objectiveToBody(o), 'PATCH');
}

export async function persistDeleteObjective(id: string): Promise<void> {
  await postJson(`/api/tandem-okr/${encodeURIComponent(id)}`, {}, 'DELETE');
}

/** 新建 KR → 返回服务端生成的 id */
export async function persistCreateKeyResult(kr: Partial<KeyResult>): Promise<string> {
  const j = await postJson('/api/okr/key-results', keyResultToBody(kr));
  return j?.keyResult?.id as string;
}

export async function persistUpdateKeyResult(id: string, kr: Partial<KeyResult>): Promise<void> {
  await postJson(`/api/okr/key-results/${encodeURIComponent(id)}`, keyResultToBody(kr), 'PATCH');
}

export async function persistDeleteKeyResult(id: string): Promise<void> {
  await postJson(`/api/okr/key-results/${encodeURIComponent(id)}`, {}, 'DELETE');
}

/** 客户端 Initiative status → 服务端 (todo→planned, in-progress→in_progress, cancelled→blocked) */
function clientInitiativeStatusToServer(s?: Initiative['status']): Server.Initiative['status'] {
  if (s === 'todo' || !s) return 'planned';
  if (s === 'in-progress') return 'in_progress';
  if (s === 'cancelled') return 'blocked';
  return s; // done | blocked
}

/** 新建 Initiative (挂在 KR 上) → 返回服务端生成的 id */
export async function persistCreateInitiative(init: {
  keyResultId: string;
  title: string;
  ownerId?: string;
  status?: Initiative['status'];
  dueDate?: number;
}): Promise<string> {
  const j = await postJson('/api/okr/initiatives', {
    keyResultId: init.keyResultId,
    title: init.title,
    ownerId: realOwnerId(init.ownerId),
    status: clientInitiativeStatusToServer(init.status),
    dueDate: init.dueDate ? new Date(init.dueDate).toISOString() : undefined,
  });
  return j?.initiative?.id as string;
}

/**
 * 提交 check-in 到后端 (/api/okr/checkins → executeAction kr.checkin / objective.checkin).
 * KR check-in 需要 currentValue (绝对测量值); 弹窗只收 progressAfter(%), 故按 KR 的
 * start/target 反算: currentValue = start + (progressAfter/100)*(target-start).
 */
export async function persistCreateCheckIn(
  payload: Omit<CheckIn, 'id' | 'createdAt'>,
): Promise<void> {
  const body: Record<string, unknown> = {
    scope: payload.scope,
    scopeId: payload.scopeId,
    confidenceBefore: payload.confidenceBefore,
    confidenceAfter: payload.confidenceAfter,
    progressBefore: payload.progressBefore,
    progressAfter: payload.progressAfter,
    achievements: payload.achievements,
    blockers: payload.blockers,
    nextSteps: payload.nextSteps,
    mood: payload.mood,
  };
  if (payload.scope === 'kr') {
    const kr = useOKRStore.getState().keyResults.find((k) => k.id === payload.scopeId);
    if (kr) {
      const span = kr.targetValue - kr.startValue;
      body.currentValue = kr.startValue + (payload.progressAfter / 100) * span;
    }
  }
  await postJson('/api/okr/checkins', body);
}
