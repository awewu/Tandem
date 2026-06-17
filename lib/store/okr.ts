/**
 * lib/store/okr.ts · OKR UI layer (region 4)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31).
 * 2026-06-17: 移除 localStorage persist — DB (lib/types/okr-tti.ts) 是唯一真值,
 *   数据由 ApiHydrator → hydrateOkrFromApi() 拉取, 写操作走 lib/store/okr-sync.ts persist* helper.
 * 服务端真值见 lib/types/okr-tti.ts (注意 ObjectiveStatus 枚举不同).
 */

import { create } from 'zustand';

// #region 4 · OKR (UI layer; see lib/types/okr-tti.ts for server) ────
// =============================================================
// OKR — 与 Tita 功能对等的数据模型
// =============================================================
// 实体：Cycle（周期）/ Person（人员）/ Objective（目标）/ KeyResult（关键结果）/ CheckIn（进度更新）
// 设计参照 Tita 产品：周期（年/季/月/半年）+ 上下级对齐 + KR 加权 + 信心度（红黄绿）+ Check-in 时间线
// 兼容字段：每个实体保留 titaId 便于与 Tita 数据来回切换

export type Confidence = 'on-track' | 'at-risk' | 'off-track';
export type ObjectiveStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type KRType = 'numeric' | 'percentage' | 'milestone' | 'binary';
export type CycleType = 'year' | 'half' | 'quarter' | 'month';
export type Cadence = 'weekly' | 'biweekly' | 'monthly';

export interface Cycle {
  id: string;
  name: string;            // 例：'2026' / '2026-H1' / '2026-Q1' / '2026-01'
  type: CycleType;
  startDate: number;
  endDate: number;
  isActive: boolean;
  /** Check-in 节奏，Tita/Profit.co/WorkBoard 都以周为默认 */
  cadence?: Cadence;
  /** 周期总体反思纪要 (结束后人工填) */
  retrospective?: string;
  titaId?: string;
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  /** 关联到 Org 中的 ministry/department，便于和组织结构联动 */
  ministryId?: string;
  avatarUrl?: string;
  titaId?: string;
}

export interface Objective {
  id: string;
  title: string;
  description?: string;
  cycleId: string;
  ownerId: string;
  /** 上级对齐目标（树结构） */
  parentId?: string | null;
  /** 在父目标下的权重 0-100 */
  weight: number;
  status: ObjectiveStatus;
  confidence: Confidence;
  visibility: 'public' | 'department' | 'private';
  tags: string[];
  /** 协作者 (可编辑)，存 personId 或 'team:<ministryId>' */
  collaborators?: string[];
  /** 关注者 (只读订阅动态) */
  watchers?: string[];
  /** 手动覆盖进度；null 表示按 KR 加权自动计算 */
  progressOverride?: number | null;
  /**
   * B1 读路径收敛 (2026-06-02): 服务端 rollup 真值进度 (0-100).
   * 来自 /api/tandem-okr 的 Objective.currentProgress (服务端 0-1 ×100 映射).
   * 含子 Objective 向上聚合 + Initiative 执行联动 (B2/B3), 是客户端本地 KR 重算算不出的.
   * getObjectiveProgress 优先级: progressOverride > currentProgress(服务端) > 本地 KR 重算.
   */
  currentProgress?: number | null;
  /** 周期结束时的最终评分 0-1.0（Google 式） */
  score?: number | null;
  /** 负责人自评分 0-1.0 */
  selfScore?: number | null;
  /** 上级/管理者评分 0-1.0 */
  managerScore?: number | null;
  /** 复盘复盘记录 (PDCA / KISS / 4L 文本) */
  retrospective?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
  titaId?: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  ownerId: string;
  type: KRType;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  /** 在 Objective 下的权重 0-100 */
  weight: number;
  confidence: Confidence;
  status: 'active' | 'completed' | 'abandoned';
  dueDate?: number;
  /**
   * FP&A 数据契约桥 (中书↔门下 · docs/GOVERNANCE-FPA-ENGINE-2026-06-09.md §3.2):
   *   targetKpiId      = 该 KR 意图推动的 BSC KPI (Kpi.id), 取代旧的标题模糊匹配。
   *   expectedKpiDelta = KR 100% 完成时预期把该 KPI 推动的绝对增量 (与 KPI 同量纲, 可正可负)。
   *   供三省六部 FP&A DeliveryBaseline 投影 OKR→BSC 影响。两者皆可空 (非锚定 KR)。
   */
  targetKpiId?: string | null;
  expectedKpiDelta?: number | null;
  tags: string[];
  collaborators?: string[];
  watchers?: string[];
  /** 周期结束时的评分 0-1.0 */
  selfScore?: number | null;
  finalScore?: number | null;
  createdAt: number;
  updatedAt: number;
  titaId?: string;
}

export interface CheckIn {
  id: string;
  scope: 'objective' | 'kr';
  scopeId: string;
  authorId: string;
  /** 进度快照（百分比 0-100） */
  progressBefore: number;
  progressAfter: number;
  confidenceBefore: Confidence;
  confidenceAfter: Confidence;
  /** Weekdone PPP 三段式叙述 / Tita 进展-障碍-下一步 */
  achievements?: string;
  blockers?: string;
  nextSteps?: string;
  /** 个人心情/干劲状态 (Weekdone 高级版) */
  mood?: 'happy' | 'neutral' | 'sad';
  createdAt: number;
  titaId?: string;
}

/** 行动项 / 举措 - KR 下挂的子任务 (Perdoo/Tita 都有此层) */
export interface Initiative {
  id: string;
  /** 归属：可以挂在 KR 上 (常见)，也可直接挂 Objective 上 */
  scope: 'kr' | 'objective';
  scopeId: string;
  title: string;
  description?: string;
  ownerId: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: number;
  dueDate?: number;
  /** 预计/实际工时 (小时) */
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  /** 与 Tasks 面板联动：如果同步为任务，存任务 id */
  linkedTaskId?: string;
  createdAt: number;
  updatedAt: number;
  titaId?: string;
}

/** 评论 (可附在 Objective/KR/Initiative 任一实体) */
export interface OKRComment {
  id: string;
  scope: 'objective' | 'kr' | 'initiative';
  scopeId: string;
  authorId: string;
  body: string;
  /** @mention 的人物 id，用于后续通知 */
  mentions: string[];
  /** 被谁点赞 */
  reactions: { emoji: string; userId: string }[];
  createdAt: number;
  editedAt?: number;
}

/** 活动日志：所有实体变更自动写入 */
export interface OKRActivity {
  id: string;
  scope: 'objective' | 'kr' | 'initiative' | 'cycle';
  scopeId: string;
  actorId: string;
  action:
    | 'create' | 'update' | 'delete'
    | 'check-in' | 'comment' | 'reaction'
    | 'score' | 'review' | 'reassign'
    | 'complete' | 'archive' | 'reopen';
  /** 表达式描述，如 "将信心从“正常”改为“有风险”" */
  summary: string;
  /** 具体变更 (key-> oldValue/newValue) */
  changes?: Record<string, { from: any; to: any }>;
  createdAt: number;
}

/** @deprecated v1 形式；保留仅用于迁移 */
export interface LegacyOKR {
  id: string;
  objective: string;
  keyResults: { id: string; text: string; target: number; current: number; unit: string }[];
  quarter: string;
  ownerMinistryId: string;
  status: 'active' | 'completed' | 'abandoned';
}

interface OKRStore {
  cycles: Cycle[];
  people: Person[];
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
  initiatives: Initiative[];
  comments: OKRComment[];
  activities: OKRActivity[];
  activeCycleId: string;
  /** 当前运行身份 (可后续接认证)，默认 'me' */
  currentUserId: string;

  // Cycle
  addCycle: (c: Omit<Cycle, 'id'>) => Cycle;
  updateCycle: (id: string, patch: Partial<Cycle>) => void;
  deleteCycle: (id: string) => void;
  setActiveCycleId: (id: string) => void;

  // Person
  addPerson: (p: Omit<Person, 'id'>) => Person;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  setCurrentUserId: (id: string) => void;

  // Objective
  addObjective: (o: Omit<Objective, 'id' | 'createdAt' | 'updatedAt'>) => Objective;
  updateObjective: (id: string, patch: Partial<Objective>) => void;
  /** 递归删除：连带 KR + Initiative + CheckIn + Comment + 子 Objective */
  deleteObjective: (id: string) => void;

  // KR
  addKeyResult: (kr: Omit<KeyResult, 'id' | 'createdAt' | 'updatedAt'>) => KeyResult;
  updateKeyResult: (id: string, patch: Partial<KeyResult>) => void;
  deleteKeyResult: (id: string) => void;

  // CheckIn
  /** 写入 check-in 后会自动同步 currentValue / confidence 到目标实体 */
  addCheckIn: (c: Omit<CheckIn, 'id' | 'createdAt'>) => CheckIn;

  // Initiative
  addInitiative: (i: Omit<Initiative, 'id' | 'createdAt' | 'updatedAt'>) => Initiative;
  updateInitiative: (id: string, patch: Partial<Initiative>) => void;
  deleteInitiative: (id: string) => void;

  // Comment
  addComment: (c: Omit<OKRComment, 'id' | 'createdAt' | 'mentions' | 'reactions'> & { mentions?: string[] }) => OKRComment;
  updateComment: (id: string, body: string) => void;
  deleteComment: (id: string) => void;
  toggleReaction: (commentId: string, emoji: string, userId: string) => void;

  // Watcher / Collaborator
  toggleWatcher: (scope: 'objective' | 'kr', scopeId: string, userId: string) => void;
  toggleCollaborator: (scope: 'objective' | 'kr', scopeId: string, userId: string) => void;

  // 评分阶段（周期末）
  scoreObjective: (id: string, kind: 'self' | 'manager' | 'final', value: number) => void;
  scoreKeyResult: (id: string, kind: 'self' | 'final', value: number) => void;
  reviewObjective: (id: string, retrospective: string) => void;

  // 全量替换（导入用）
  replaceAll: (data: {
    cycles?: Cycle[];
    people?: Person[];
    objectives?: Objective[];
    keyResults?: KeyResult[];
    checkIns?: CheckIn[];
    initiatives?: Initiative[];
    comments?: OKRComment[];
    activities?: OKRActivity[];
    activeCycleId?: string;
  }) => void;

  // 计算
  /** Objective 的当前进度（0-100）：有 override 用 override，否则 KR 加权 */
  getObjectiveProgress: (objectiveId: string) => number;
  /** KR 进度 0-100 */
  getKRProgress: (krId: string) => number;
  /** 获取实体上的评论 */
  getComments: (scope: 'objective' | 'kr' | 'initiative', scopeId: string) => OKRComment[];
  /** 获取实体的活动日志 (含后代) */
  getActivities: (scope: 'objective' | 'kr', scopeId: string) => OKRActivity[];
}

function calcKRProgress(kr: KeyResult): number {
  if (kr.type === 'binary') {
    return kr.currentValue >= 1 ? 100 : 0;
  }
  if (kr.type === 'milestone') {
    return Math.max(0, Math.min(100, Math.round(kr.currentValue)));
  }
  // numeric / percentage
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const pct = ((kr.currentValue - kr.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

const _now = () => Date.now();

// 默认周期：当前年 + 4 季度
function defaultCycles(): Cycle[] {
  const y = new Date().getFullYear();
  const ms = (m: number, d = 1) => new Date(y, m - 1, d).getTime();
  const eo = (m: number) => new Date(y, m, 0).getTime(); // end of month
  return [
    { id: `cy-${y}`, name: `${y}`, type: 'year', startDate: ms(1), endDate: eo(12), isActive: false },
    { id: `cy-${y}-q1`, name: `${y}-Q1`, type: 'quarter', startDate: ms(1), endDate: eo(3), isActive: false },
    { id: `cy-${y}-q2`, name: `${y}-Q2`, type: 'quarter', startDate: ms(4), endDate: eo(6), isActive: false },
    { id: `cy-${y}-q3`, name: `${y}-Q3`, type: 'quarter', startDate: ms(7), endDate: eo(9), isActive: true },
    { id: `cy-${y}-q4`, name: `${y}-Q4`, type: 'quarter', startDate: ms(10), endDate: eo(12), isActive: false },
  ];
}

// DB 是唯一真值: OKR store 不再 persist 到 localStorage (2026-06-17).
// 数据一律由 ApiHydrator → hydrateOkrFromApi() 从后端拉取; 写操作走 persist* API helper.
export const useOKRStore = create<OKRStore>()(
    (set, get) => ({
      cycles: defaultCycles(),
      people: [
        { id: 'me', name: '我', ministryId: 'min-1' },
      ],
      objectives: [],
      keyResults: [],
      checkIns: [],
      initiatives: [],
      comments: [],
      activities: [],
      activeCycleId: defaultCycles().find((c) => c.isActive)?.id || defaultCycles()[0].id,
      currentUserId: 'me',

      // ===== Cycle =====
      addCycle: (c) => {
        const cycle: Cycle = { id: crypto.randomUUID(), ...c };
        set((s) => ({ cycles: [...s.cycles, cycle] }));
        return cycle;
      },
      updateCycle: (id, patch) =>
        set((s) => ({ cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCycle: (id) =>
        set((s) => ({
          cycles: s.cycles.filter((c) => c.id !== id),
          activeCycleId: s.activeCycleId === id ? (s.cycles.find((c) => c.id !== id)?.id || '') : s.activeCycleId,
        })),
      setActiveCycleId: (id) =>
        set((s) => ({
          activeCycleId: id,
          cycles: s.cycles.map((c) => ({ ...c, isActive: c.id === id })),
        })),

      // ===== Person =====
      addPerson: (p) => {
        const person: Person = { id: crypto.randomUUID(), ...p };
        set((s) => ({ people: [...s.people, person] }));
        return person;
      },
      updatePerson: (id, patch) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePerson: (id) =>
        set((s) => ({ people: s.people.filter((p) => p.id !== id) })),

      // ===== Objective =====
      addObjective: (o) => {
        const now = _now();
        const obj: Objective = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...o };
        set((s) => ({
          objectives: [...s.objectives, obj],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'objective', scopeId: obj.id,
              actorId: get().currentUserId, action: 'create',
              summary: `创建目标「${obj.title}」`, createdAt: now,
            },
          ],
        }));
        return obj;
      },
      updateObjective: (id, patch) =>
        set((s) => {
          const old = s.objectives.find((o) => o.id === id);
          if (!old) return s;
          const now = _now();
          const updated = { ...old, ...patch, updatedAt: now };
          const changes: Record<string, { from: any; to: any }> = {};
          for (const k of Object.keys(patch)) {
            const before = (old as any)[k]; const after = (patch as any)[k];
            if (JSON.stringify(before) !== JSON.stringify(after)) {
              changes[k] = { from: before, to: after };
            }
          }
          let summary = `更新「${updated.title}」`;
          if (patch.confidence && patch.confidence !== old.confidence) {
            summary = `信心：${old.confidence} → ${patch.confidence}`;
          } else if (patch.status && patch.status !== old.status) {
            summary = `状态：${old.status} → ${patch.status}`;
          } else if (patch.ownerId && patch.ownerId !== old.ownerId) {
            summary = `负责人变更`;
          } else if (patch.title && patch.title !== old.title) {
            summary = `标题：${old.title} → ${patch.title}`;
          }
          if (Object.keys(changes).length === 0) {
            return { objectives: s.objectives.map((o) => (o.id === id ? updated : o)) };
          }
          return {
            objectives: s.objectives.map((o) => (o.id === id ? updated : o)),
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: 'objective', scopeId: id,
                actorId: get().currentUserId, action: 'update',
                summary, changes, createdAt: now,
              },
            ],
          };
        }),
      deleteObjective: (id) =>
        set((s) => {
          // 递归收集后代 Objective
          const toDelete = new Set<string>([id]);
          let added = true;
          while (added) {
            added = false;
            for (const o of s.objectives) {
              if (o.parentId && toDelete.has(o.parentId) && !toDelete.has(o.id)) {
                toDelete.add(o.id);
                added = true;
              }
            }
          }
          const krIds = new Set(s.keyResults.filter((k) => toDelete.has(k.objectiveId)).map((k) => k.id));
          return {
            objectives: s.objectives.filter((o) => !toDelete.has(o.id)),
            keyResults: s.keyResults.filter((k) => !toDelete.has(k.objectiveId)),
            checkIns: s.checkIns.filter((c) =>
              !(c.scope === 'objective' && toDelete.has(c.scopeId)) &&
              !(c.scope === 'kr' && krIds.has(c.scopeId))
            ),
          };
        }),

      // ===== KR =====
      addKeyResult: (kr) => {
        const now = _now();
        const k: KeyResult = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...kr };
        set((s) => ({
          keyResults: [...s.keyResults, k],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'kr', scopeId: k.id,
              actorId: get().currentUserId, action: 'create',
              summary: `新建 KR「${k.title}」`, createdAt: now,
            },
          ],
        }));
        return k;
      },
      updateKeyResult: (id, patch) =>
        set((s) => {
          const old = s.keyResults.find((k) => k.id === id);
          if (!old) return s;
          const now = _now();
          const updated = { ...old, ...patch, updatedAt: now };
          const changes: Record<string, { from: any; to: any }> = {};
          for (const k of Object.keys(patch)) {
            const before = (old as any)[k]; const after = (patch as any)[k];
            if (JSON.stringify(before) !== JSON.stringify(after)) {
              changes[k] = { from: before, to: after };
            }
          }
          if (Object.keys(changes).length === 0) {
            return { keyResults: s.keyResults.map((k) => (k.id === id ? updated : k)) };
          }
          let summary = `更新 KR「${updated.title}」`;
          if (patch.currentValue != null && patch.currentValue !== old.currentValue) {
            summary = `KR「${updated.title}」：${old.currentValue} → ${patch.currentValue} ${updated.unit}`;
          }
          return {
            keyResults: s.keyResults.map((k) => (k.id === id ? updated : k)),
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: 'kr', scopeId: id,
                actorId: get().currentUserId, action: 'update',
                summary, changes, createdAt: now,
              },
            ],
          };
        }),
      deleteKeyResult: (id) =>
        set((s) => ({
          keyResults: s.keyResults.filter((k) => k.id !== id),
          checkIns: s.checkIns.filter((c) => !(c.scope === 'kr' && c.scopeId === id)),
        })),

      // ===== CheckIn =====
      addCheckIn: (c) => {
        const ci: CheckIn = { id: crypto.randomUUID(), createdAt: _now(), ...c };
        set((s) => {
          const next: Partial<OKRStore> = {
            checkIns: [...s.checkIns, ci],
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: ci.scope, scopeId: ci.scopeId,
                actorId: ci.authorId, action: 'check-in',
                summary: `Check-in：进度 ${ci.progressBefore}% → ${ci.progressAfter}%、信心 ${ci.confidenceBefore} → ${ci.confidenceAfter}`,
                createdAt: ci.createdAt,
              },
            ],
          };
          // 自动同步到目标实体的 confidence；对 KR 还要同步 currentValue（按 progressAfter 反推）
          if (ci.scope === 'kr') {
            next.keyResults = s.keyResults.map((k) => {
              if (k.id !== ci.scopeId) return k;
              // 反推 currentValue：按 progressAfter / 100 * (target - start) + start
              let newCurrent = k.currentValue;
              if (k.type === 'numeric' || k.type === 'percentage' || k.type === 'milestone') {
                if (k.type === 'milestone') {
                  newCurrent = ci.progressAfter;
                } else {
                  newCurrent = k.startValue + (ci.progressAfter / 100) * (k.targetValue - k.startValue);
                  newCurrent = Math.round(newCurrent * 100) / 100;
                }
              } else if (k.type === 'binary') {
                newCurrent = ci.progressAfter >= 100 ? 1 : 0;
              }
              return { ...k, currentValue: newCurrent, confidence: ci.confidenceAfter, updatedAt: _now() };
            });
          } else {
            next.objectives = s.objectives.map((o) =>
              o.id === ci.scopeId
                ? { ...o, confidence: ci.confidenceAfter, progressOverride: ci.progressAfter, updatedAt: _now() }
                : o
            );
          }
          return next as any;
        });
        return ci;
      },

      // ===== 全量替换 =====
      replaceAll: (data) =>
        set((s) => ({
          cycles: data.cycles ?? s.cycles,
          people: data.people ?? s.people,
          objectives: data.objectives ?? s.objectives,
          keyResults: data.keyResults ?? s.keyResults,
          checkIns: data.checkIns ?? s.checkIns,
          initiatives: data.initiatives ?? s.initiatives,
          activeCycleId: data.activeCycleId ?? s.activeCycleId,
        })),

      // ===== 计算 =====
      getKRProgress: (krId) => {
        const kr = get().keyResults.find((k) => k.id === krId);
        return kr ? calcKRProgress(kr) : 0;
      },
      getObjectiveProgress: (objectiveId) => {
        const obj = get().objectives.find((o) => o.id === objectiveId);
        if (!obj) return 0;
        if (obj.progressOverride != null) return obj.progressOverride;
        const krs = get().keyResults.filter((k) => k.objectiveId === objectiveId);
        if (krs.length === 0) return 0;
        const totalWeight = krs.reduce((sum, k) => sum + (k.weight || 1), 0);
        if (totalWeight === 0) return 0;
        const weighted = krs.reduce(
          (sum, k) => sum + calcKRProgress(k) * (k.weight || 1),
          0
        );
        return Math.round(weighted / totalWeight);
      },

      // ===== Person.setCurrentUserId =====
      setCurrentUserId: (id) => set({ currentUserId: id }),

      // ===== Initiative =====
      addInitiative: (i) => {
        const now = _now();
        const init: Initiative = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...i };
        set((s) => ({
          initiatives: [...s.initiatives, init],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: i.scope === 'kr' ? 'kr' : 'objective',
              scopeId: i.scopeId, actorId: get().currentUserId, action: 'create',
              summary: `新增行动项「${init.title}」`, createdAt: now,
            },
          ],
        }));
        return init;
      },
      updateInitiative: (id, patch) =>
        set((s) => {
          const old = s.initiatives.find((i) => i.id === id);
          if (!old) return s;
          const now = _now();
          const updated = { ...old, ...patch, updatedAt: now };
          const changes: Record<string, { from: any; to: any }> = {};
          for (const k of Object.keys(patch)) {
            if ((old as any)[k] !== (patch as any)[k]) {
              changes[k] = { from: (old as any)[k], to: (patch as any)[k] };
            }
          }
          let summary = `更新行动项「${updated.title}」`;
          if (patch.status && patch.status !== old.status) {
            summary = `行动项「${updated.title}」状态：${old.status} → ${patch.status}`;
          }
          return {
            initiatives: s.initiatives.map((i) => (i.id === id ? updated : i)),
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: updated.scope === 'kr' ? 'kr' : 'objective',
                scopeId: updated.scopeId, actorId: get().currentUserId, action: 'update',
                summary, changes, createdAt: now,
              },
            ],
          };
        }),
      deleteInitiative: (id) =>
        set((s) => ({
          initiatives: s.initiatives.filter((i) => i.id !== id),
          comments: s.comments.filter((c) => !(c.scope === 'initiative' && c.scopeId === id)),
        })),

      // ===== Comment =====
      addComment: (c) => {
        // 自动从 body 中抽取 @mention（@张三 形态，按 people.name 匹配）
        const explicitMentions = c.mentions || [];
        const people = get().people;
        const inferredMentions = people
          .filter((p) => new RegExp(`@${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(c.body))
          .map((p) => p.id);
        const mentions = Array.from(new Set([...explicitMentions, ...inferredMentions]));
        const now = _now();
        const comment: OKRComment = {
          id: crypto.randomUUID(), createdAt: now,
          ...c, mentions, reactions: [],
        };
        set((s) => ({
          comments: [...s.comments, comment],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(),
              scope: c.scope === 'initiative' ? 'initiative' : c.scope,
              scopeId: c.scopeId, actorId: c.authorId, action: 'comment',
              summary: `评论：${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''}`,
              createdAt: now,
            },
          ],
        }));
        return comment;
      },
      updateComment: (id, body) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id ? { ...c, body, editedAt: _now() } : c
          ),
        })),
      deleteComment: (id) =>
        set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),
      toggleReaction: (commentId, emoji, userId) =>
        set((s) => ({
          comments: s.comments.map((c) => {
            if (c.id !== commentId) return c;
            const exists = c.reactions.find((r) => r.emoji === emoji && r.userId === userId);
            return {
              ...c,
              reactions: exists
                ? c.reactions.filter((r) => !(r.emoji === emoji && r.userId === userId))
                : [...c.reactions, { emoji, userId }],
            };
          }),
        })),

      // ===== Watcher / Collaborator =====
      toggleWatcher: (scope, scopeId, userId) =>
        set((s) => {
          const now = _now();
          const toggle = (arr: string[] | undefined): string[] => {
            const cur = arr || [];
            return cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId];
          };
          if (scope === 'objective') {
            return {
              objectives: s.objectives.map((o) =>
                o.id === scopeId ? { ...o, watchers: toggle(o.watchers), updatedAt: now } : o
              ),
            };
          }
          return {
            keyResults: s.keyResults.map((k) =>
              k.id === scopeId ? { ...k, watchers: toggle(k.watchers), updatedAt: now } : k
            ),
          };
        }),
      toggleCollaborator: (scope, scopeId, userId) =>
        set((s) => {
          const now = _now();
          const toggle = (arr: string[] | undefined): string[] => {
            const cur = arr || [];
            return cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId];
          };
          if (scope === 'objective') {
            return {
              objectives: s.objectives.map((o) =>
                o.id === scopeId ? { ...o, collaborators: toggle(o.collaborators), updatedAt: now } : o
              ),
            };
          }
          return {
            keyResults: s.keyResults.map((k) =>
              k.id === scopeId ? { ...k, collaborators: toggle(k.collaborators), updatedAt: now } : k
            ),
          };
        }),

      // ===== 评分 =====
      scoreObjective: (id, kind, value) => {
        const v = Math.max(0, Math.min(1, value));
        const field = kind === 'self' ? 'selfScore' : kind === 'manager' ? 'managerScore' : 'score';
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === id ? { ...o, [field]: v, updatedAt: _now() } : o
          ),
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'objective', scopeId: id,
              actorId: get().currentUserId, action: 'score',
              summary: `${kind === 'self' ? '自评' : kind === 'manager' ? '上级评分' : '终评'}：${v.toFixed(1)}`,
              createdAt: _now(),
            },
          ],
        }));
      },
      scoreKeyResult: (id, kind, value) => {
        const v = Math.max(0, Math.min(1, value));
        const field = kind === 'self' ? 'selfScore' : 'finalScore';
        set((s) => ({
          keyResults: s.keyResults.map((k) =>
            k.id === id ? { ...k, [field]: v, updatedAt: _now() } : k
          ),
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'kr', scopeId: id,
              actorId: get().currentUserId, action: 'score',
              summary: `KR ${kind === 'self' ? '自评' : '终评'}：${v.toFixed(1)}`,
              createdAt: _now(),
            },
          ],
        }));
      },
      reviewObjective: (id, retrospective) =>
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === id ? { ...o, retrospective, reviewedAt: _now(), updatedAt: _now() } : o
          ),
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'objective', scopeId: id,
              actorId: get().currentUserId, action: 'review',
              summary: '完成复盘', createdAt: _now(),
            },
          ],
        })),

      // ===== 查询 =====
      getComments: (scope, scopeId) =>
        get().comments
          .filter((c) => c.scope === scope && c.scopeId === scopeId)
          .sort((a, b) => a.createdAt - b.createdAt),

      getActivities: (scope, scopeId) => {
        const all = get().activities;
        if (scope === 'objective') {
          // 含其下 KR / Initiative 的活动
          const krIds = new Set(get().keyResults.filter((k) => k.objectiveId === scopeId).map((k) => k.id));
          const initIds = new Set(
            get().initiatives.filter(
              (i) => (i.scope === 'objective' && i.scopeId === scopeId) ||
                     (i.scope === 'kr' && krIds.has(i.scopeId))
            ).map((i) => i.id)
          );
          return all
            .filter((a) =>
              (a.scope === 'objective' && a.scopeId === scopeId) ||
              (a.scope === 'kr' && krIds.has(a.scopeId)) ||
              (a.scope === 'initiative' && initIds.has(a.scopeId))
            )
            .sort((a, b) => b.createdAt - a.createdAt);
        }
        return all
          .filter((a) => a.scope === scope && a.scopeId === scopeId)
          .sort((a, b) => b.createdAt - a.createdAt);
      },
    })
);
// #endregion
