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
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Key Result (KR)
// ---------------------------------------------------------------------------

export type KRMeasureType = 'numeric' | 'percentage' | 'milestone';
// 注: 'boolean' 类型禁用 (MANIFESTO 反 OKR 形式主义)

export type KRComputeMethod = 'cumulative' | 'latest' | 'average';

export interface KeyResult {
  id: string;
  objectiveId: string;
  /** 单 owner 默认; co-owner 在 V2 加 */
  ownerId: string;
  coOwnerIds?: string[];
  title: string;
  measureType: KRMeasureType;
  computeMethod: KRComputeMethod;
  /** 三段式: 起始 / 目标 / 当前 */
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string;             // e.g. "万元" / "%"
  /** Confidence Score: 红黄绿 (Google 风格) */
  confidence: 'green' | 'yellow' | 'red';
  /** 风险标记 */
  riskStatus: 'on_track' | 'at_risk' | 'off_track';
}

/** KR 进度计算 */
export function computeKRProgress(kr: KeyResult): number {
  const range = kr.targetValue - kr.startValue;
  if (range === 0) return 0;
  return Math.min(1, Math.max(0, (kr.currentValue - kr.startValue) / range));
}

// ---------------------------------------------------------------------------
// TTI · Target to Improve (双轨, 与 KPI 完全分离)
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Check-in (周报/月报)
// ---------------------------------------------------------------------------

export interface CheckIn {
  id: string;
  ownerId: string;
  cycleId: string;
  weekStart: string;
  /** 关联 KR 进度 */
  krUpdates: { keyResultId: string; previousValue: number; newValue: number }[];
  /** 关联 TTI 进度 */
  ttiUpdates: { ttiId: string; previousRate: number; newRate: number }[];
  /** 上周做对什么 / 做错什么 / 下周计划 (复盘模板) */
  whatWentWell?: string;
  whatWentWrong?: string;
  nextWeekPlan?: string;
  /** AI 自动生成草稿标记 */
  aiDraftGenerated: boolean;
  /** 员工 review 后批准 (24h 否决窗口前置) */
  approvedByOwner: boolean;
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
