/**
 * OKR / TTI · 双轨绩效系统
 *
 * 对应 TTI-FRAMEWORK + MANIFESTO 第四/五条
 *
 * 设计原则:
 *   - KPI: 100% 合格 = 绿; 与薪资挂钩
 *   - TTI: 60-70% 完成 = 健康绿; 与薪资完全分离
 */

// ---------------------------------------------------------------------------
// 周期
// ---------------------------------------------------------------------------

export type CyclePeriod = 'year' | 'half' | 'quarter' | 'bi_monthly' | 'month' | 'custom';

export interface Cycle {
  id: string;
  period: CyclePeriod;
  name: string;          // e.g. "2026 Q2"
  startDate: string;
  endDate: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Objective (O)
// ---------------------------------------------------------------------------

export type ObjectiveLevel = 'company' | 'team' | 'individual';

export type ObjectiveStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type Confidence = 'on-track' | 'at-risk' | 'off-track';

export interface Objective {
  id: string;
  cycleId: string;
  level: ObjectiveLevel;
  /** 父级 (公司 ← 团队 ← 个人, 最多 3 层) */
  parentObjectiveId?: string;
  ownerId: string;
  title: string;
  description?: string;
  /** 默认全员可见 (MANIFESTO 第六条) */
  visibility: 'public' | 'team' | 'private';
  /** A2.1a 新增, 与 zustand 语义对齐 */
  weight: number;            // 0-100
  status: ObjectiveStatus;
  confidence: Confidence;
  tags: string[];
  collaboratorIds: string[];
  watcherIds: string[];
  selfScore?: number | null;
  managerScore?: number | null;
  finalScore?: number | null;
  retrospective?: string | null;
  reviewedAt?: string | null;
  /**
   * B2 真 rollup (OKR-EVOLUTION-PLAN §3 B2 · 2026-06-02):
   *   - currentProgress = 由 rollup 引擎自动计算 (KR 加权 + 子 Objective 加权), 0-1.
   *     是服务端真值进度, 此前服务端模型完全缺失此字段 (进度只活在 localStorage UI store = 假闭环).
   *   - progressOverride = 人工覆盖, 默认 null (废"默认人手填"); 非 null 时 UI 显示 + 向上 rollup 都用它.
   *   - effective = progressOverride ?? currentProgress ?? 0 (见 effectiveObjectiveProgress).
   */
  currentProgress?: number;
  progressOverride?: number | null;
  /** 多租户隔离 (默认 'default') */
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Key Result (KR)
// ---------------------------------------------------------------------------

/** A2.1a: binary 入 enum (做/没做, 加满 100% = 完成) */
export type KRMeasureType = 'binary' | 'numeric' | 'percentage' | 'milestone';

export type KRComputeMethod = 'cumulative' | 'latest' | 'average';

export type KRStatus = 'active' | 'completed' | 'abandoned';

export interface KeyResult {
  id: string;
  objectiveId: string;
  ownerId: string;
  coOwnerIds: string[];
  title: string;
  measureType: KRMeasureType;
  computeMethod: KRComputeMethod;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string | null;
  /** A2.1a: 值域统一为 on-track | at-risk | off-track */
  confidence: Confidence;
  /** 保留 (旧 on_track | at_risk | off_track), 新代码只用 confidence */
  riskStatus: 'on_track' | 'at_risk' | 'off_track';
  /** A2.1a 新增 */
  weight: number;
  status: KRStatus;
  /**
   * B3 执行联动 (OKR-EVOLUTION-PLAN §3 B3 · 2026-06-02):
   *   true 时 KR.currentValue 由其 Initiative 完成率自动驱动 (currentValue = start + ratio*(target-start)),
   *   人工 check-in 不再需要. measureType==='milestone' 默认视为开启 (里程碑天然按完成数计).
   *   其他类型默认关闭, 防自动值覆盖人工测量的数值型 KR.
   */
  autoProgressFromInitiatives?: boolean;
  /**
   * FP&A 数据契约桥 (中书↔门下 · docs/GOVERNANCE-FPA-ENGINE-2026-06-09.md §3.2):
   *   targetKpiId    = 该 KR 意图推动的 BSC KPI (Kpi.id), 取代旧的标题模糊匹配。
   *   expectedKpiDelta = KR 100% 完成时预期把该 KPI 推动的绝对增量 (与 KPI 同量纲, 可正可负)。
   *   FP&A DeliveryBaseline 据此投影 OKR 进度对 BSC 的影响。两者皆可空 (非锚定 KR)。
   */
  targetKpiId?: string | null;
  expectedKpiDelta?: number | null;
  dueDate?: string | null;
  tags: string[];
  collaboratorIds: string[];
  watcherIds: string[];
  selfScore?: number | null;
  finalScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** KR 进度计算 */
export function computeKRProgress(kr: KeyResult): number {
  const range = kr.targetValue - kr.startValue;
  if (range === 0) return 0;
  return Math.min(1, Math.max(0, (kr.currentValue - kr.startValue) / range));
}

/**
 * Objective 有效进度 (B2 · 2026-06-02):
 *   人工覆盖优先, 否则用 rollup 自动计算值, 都没有则 0.
 *   UI 显示 + 父级 rollup 聚合 统一走这个函数, 保证"真值唯一来源".
 */
export function effectiveObjectiveProgress(o: Pick<Objective, 'progressOverride' | 'currentProgress'>): number {
  if (o.progressOverride != null) return o.progressOverride;
  return o.currentProgress ?? 0;
}

// ---------------------------------------------------------------------------
// TTI · Target to Improve (双轨, 与 KPI 完全分离)
//
// ⚠️ DEPRECATED 2026-05-20 (CHARTER-KPI-TTI §6.1):
//   "TTI 体系" 在新宽章里 = OKR 体系本身 (Objective + KeyResult + Initiative + CheckIn).
//   本独立 `TTI` interface 是 V1 遗留, 与 KR 平行的"个人成长目标"独立表.
//   新代码请用 `Objective` (level: 'individual') + `KeyResult` 替代.
//
//   不立即删除原因: 13+ 文件引用 (Convergence orchestrator / DecisionCard / 议事室上下文),
//   贸然删除会破坏 议→沉→拿→算 故事链. V2 合并迁移见 CHARTER §6.1.
// ---------------------------------------------------------------------------

/**
 * @deprecated Since 2026-05-20. Use `Objective` (level: 'individual') + `KeyResult` instead.
 *             见 docs/CHARTER-KPI-TTI.md §6.1. V2 合并迁移.
 */
export interface TTI {
  id: string;
  cycleId: string;
  ownerId: string;
  title: string;
  description?: string;
  /** 期望成长方向 (软目标, 可量化或定性) */
  successCriteria: string;
  /** 起始 / 目标 / 当前 (与 KR 一致, 但语义不同) */
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  /**
   * 完成度: 60-70% 是健康区间, > 90% UI 标橙警告 (设过低)
   */
  completionRate: number;     // 0-1
  /**
   * TTI 不挂钩任何形式的金钱回报 (宪章 §4 铁律, 不可变更).
   *
   * 「TTI 完成情况不影响任何形式的金钱回报 (含系数浮动)」
   *  — MANIFESTO.md 第四条
   *
   * 类型固化为 false, 编译期阻止任何运行时翻转尝试.
   * 历史字段 `yearEndBonusModifier` 已于 2026-05-07 移除 (违反宪章 §4).
   */
  readonly affectsCompensation: false;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** TTI 颜色规则 (60-70% 绿, 与 KR 不同) */
export function ttiColor(rate: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (rate >= 0.6 && rate <= 0.8) return 'green';
  if (rate >= 0.4 && rate < 0.6) return 'yellow';
  if (rate > 0.9) return 'orange'; // 设得过低
  return 'red';
}

/** KR 颜色规则 (100% 合格 = 绿) */
export function krColor(progress: number): 'green' | 'yellow' | 'red' {
  if (progress >= 1.0) return 'green';
  if (progress >= 0.7) return 'yellow';
  return 'red';
}

// ---------------------------------------------------------------------------
// Initiative (I) - Tita 三级结构
// ---------------------------------------------------------------------------

export interface Initiative {
  id: string;
  keyResultId: string;
  ownerId: string;
  title: string;
  /** Initiative 关联到 Decision Card (我们的独创) */
  decisionCardIds?: string[];
  status: 'planned' | 'in_progress' | 'done' | 'blocked';
  dueDate?: string;
  /** 多租户隔离 (默认 'default') */
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// Check-in (周报/月报)
// ---------------------------------------------------------------------------

/**
 * A2.1a (2026-05-10) — CheckIn 重建为 scope-based.
 *
 * 旧的 weekly + krUpdates/ttiUpdates JSON 模型已淘汰.
 * 新模型: 每条 check-in 挂在一个 Objective 或一个 KR 上, 记进度+信心+三段式叙述.
 */
export interface CheckIn {
  id: string;
  scope: 'objective' | 'kr';
  scopeId: string;
  authorId: string;
  progressBefore: number;
  progressAfter: number;
  confidenceBefore: Confidence;
  confidenceAfter: Confidence;
  achievements?: string | null;
  blockers?: string | null;
  nextSteps?: string | null;
  mood?: 'happy' | 'neutral' | 'sad' | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 9 宫格 (KPI × TTI)
// ---------------------------------------------------------------------------

export type NineBoxCell =
  | 'star'              // 高 KPI + 高 TTI
  | 'high_performer'    // 高 KPI + 中 TTI
  | 'risk_burnout'      // 高 KPI + 低 TTI (枯萎警告)
  | 'rising_talent'     // 中 KPI + 高 TTI
  | 'core'              // 中 KPI + 中 TTI
  | 'plateau'           // 中 KPI + 低 TTI
  | 'mismatch'          // 低 KPI + 高 TTI (人岗不匹配)
  | 'low_engagement'    // 低 KPI + 中 TTI
  | 'must_intervene';   // 低 KPI + 低 TTI

export function classifyNineBox(
  kpiScore: number,    // 0-1
  ttiScore: number     // 0-1
): NineBoxCell {
  const k = kpiScore >= 0.9 ? 'high' : kpiScore >= 0.7 ? 'mid' : 'low';
  const t = ttiScore >= 0.7 ? 'high' : ttiScore >= 0.4 ? 'mid' : 'low';
  const map: Record<string, NineBoxCell> = {
    'high|high': 'star',
    'high|mid': 'high_performer',
    'high|low': 'risk_burnout',
    'mid|high': 'rising_talent',
    'mid|mid': 'core',
    'mid|low': 'plateau',
    'low|high': 'mismatch',
    'low|mid': 'low_engagement',
    'low|low': 'must_intervene',
  };
  return map[`${k}|${t}`];
}
