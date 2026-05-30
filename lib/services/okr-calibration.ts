/**
 * OKR Calibration · 经理一屏校准下属 OKR 评分 (vs Tita/WorkBoard 季末校准会议)
 *
 * Calibration 是季末经理 review 下属 self-score → 调整 → 全队一致性 的关键流程.
 * Tita / WorkBoard / Lattice 都有, Tandem 之前缺.
 *
 * 数据模型 (复用现有 store, 不加 schema):
 *   Objective.selfScore     员工自评 0-1
 *   Objective.managerScore  经理校准 0-1  ← 本服务写的就是这个
 *   Objective.score         终评 0-1 (优先级最高)
 *
 * 核心算法:
 *   1. selectSubordinates(managerId)   找出该经理下属 (基于 ownerId)
 *   2. buildCalibrationGrid(...)       生成 1 屏: 下属 × Objective × selfScore × suggestedScore × drift
 *   3. recommendCalibratedScore(obj, krs)   基于 KR 实际进度 + 自评推算合理 manager score
 *   4. detectDrift(self, calibrated)   差距 ≥ 0.2 标 high / ≥ 0.1 标 medium / 否则 low
 *   5. saveCalibrations(updates[])     批量写 managerScore + audit
 *
 * §10 9 宫格联动: managerScore 入 KPI 健康度计算 (charter §1.5 KPI 100% 合格门槛).
 */

import type { Objective, KeyResult } from '../store';
import { calcObjectiveScore } from '../okr/scoring';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriftLevel = 'low' | 'medium' | 'high';

export interface CalibrationRow {
  /** 下属 personId */
  ownerId: string;
  /** 下属姓名 (UI 渲染用, 由 caller 注入) */
  ownerName?: string;
  /** Objective id */
  objectiveId: string;
  /** Objective 标题 */
  objectiveTitle: string;
  /** 员工自评 (0-1, null 未评) */
  selfScore: number | null;
  /** 经理已校准 (0-1, null 未校准) */
  managerScore: number | null;
  /** AI 推荐的校准分 (基于 KR 实际进度 + self 推断, 0-1) */
  suggestedScore: number;
  /** 自评 vs 推荐的偏差 |self - suggested| */
  drift: DriftLevel;
  driftDelta: number;
  /** Objective 的 KR 实际进度加权 (0-1, 完全派生) */
  actualProgress: number;
  /** Objective 信心 */
  confidence: Objective['confidence'];
  /** 推理: 为什么推荐这个分 */
  reasoning: string;
}

export interface CalibrationGrid {
  /** 经理 id (caller 提供, 用于 audit) */
  managerId: string;
  /** 周期 id */
  cycleId: string;
  /** 下属人数 */
  subordinateCount: number;
  /** 待校准的总 Objective 数 (含已校准) */
  totalObjectives: number;
  /** 待校准 (managerScore == null) */
  pendingCount: number;
  /** 高偏差 (drift=high) */
  highDriftCount: number;
  rows: CalibrationRow[];
}

export interface CalibrationUpdate {
  objectiveId: string;
  /** 经理打的最终校准分 0-1 (null = 清空校准) */
  managerScore: number | null;
}

// ---------------------------------------------------------------------------
// 核心算法
// ---------------------------------------------------------------------------

/**
 * 给单个 Objective 算 "推荐校准分":
 *   优先级:
 *   1. 已有 self + 实际进度差距 ≤ 0.1 → 推荐 self (员工评分准确)
 *   2. 已有 self + 差距 > 0.1 → 推荐 (self + actualProgress) / 2 (折中)
 *   3. 无 self → 推荐 actualProgress (按 KR 实际推算)
 */
export function recommendCalibratedScore(obj: Objective, krs: KeyResult[]): {
  suggested: number;
  actualProgress: number;
  reasoning: string;
} {
  const calc = calcObjectiveScore(obj, krs);
  const actualProgress = calc.value; // 0-1, 派生自 KR 加权进度

  if (obj.selfScore == null) {
    return {
      suggested: actualProgress,
      actualProgress,
      reasoning: `员工未自评. 推荐用 KR 加权进度 ${(actualProgress * 100).toFixed(0)}% 作为校准分.`,
    };
  }

  const delta = Math.abs(obj.selfScore - actualProgress);
  if (delta <= 0.1) {
    return {
      suggested: obj.selfScore,
      actualProgress,
      reasoning: `员工自评 ${(obj.selfScore * 100).toFixed(0)}% 与 KR 实际进度 ${(actualProgress * 100).toFixed(0)}% 接近 (差 ${(delta * 100).toFixed(0)}pp), 建议采用自评.`,
    };
  }

  // 偏差大: 折中
  const mid = (obj.selfScore + actualProgress) / 2;
  const direction = obj.selfScore > actualProgress ? '高估' : '低估';
  return {
    suggested: mid,
    actualProgress,
    reasoning: `员工自评 ${(obj.selfScore * 100).toFixed(0)}% 与 KR 进度 ${(actualProgress * 100).toFixed(0)}% 差距 ${(delta * 100).toFixed(0)}pp (员工${direction}), 建议折中 ${(mid * 100).toFixed(0)}%.`,
  };
}

/**
 * 偏差等级:
 *   |self - suggested| ≥ 0.2 → high (经理必看)
 *   |self - suggested| ≥ 0.1 → medium
 *   否则                     → low
 *
 * 已校准 (managerScore != null) 走这个 vs self 的偏差.
 */
export function detectDrift(selfScore: number | null, suggested: number, managerScore?: number | null): {
  level: DriftLevel;
  delta: number;
} {
  // 优先 manager 已校准 vs self
  const reference = managerScore ?? suggested;
  if (selfScore == null) return { level: 'low', delta: 0 };
  const delta = Math.abs(selfScore - reference);
  let level: DriftLevel;
  if (delta >= 0.2) level = 'high';
  else if (delta >= 0.1) level = 'medium';
  else level = 'low';
  return { level, delta };
}

// ---------------------------------------------------------------------------
// Grid 生成
// ---------------------------------------------------------------------------

export interface BuildGridInput {
  managerId: string;
  cycleId: string;
  /** 该经理的下属 personId 列表 (caller 解析 OrgMembership / direct reports) */
  subordinateIds: string[];
  /** 全部 Objective (会按 cycleId + ownerId 过滤) */
  allObjectives: Objective[];
  /** 全部 KR (用于算 actualProgress) */
  allKrs: KeyResult[];
  /** personId → name 映射 (UI 渲染用, 可选) */
  ownerNameMap?: Record<string, string>;
}

export function buildCalibrationGrid(input: BuildGridInput): CalibrationGrid {
  // 过滤: 当前周期 + 下属 ownerId
  const subordSet = new Set(input.subordinateIds);
  const targetObjs = input.allObjectives.filter(
    (o) => o.cycleId === input.cycleId && subordSet.has(o.ownerId),
  );

  const rows: CalibrationRow[] = [];
  for (const obj of targetObjs) {
    const objKrs = input.allKrs.filter((k) => k.objectiveId === obj.id);
    const { suggested, actualProgress, reasoning } = recommendCalibratedScore(obj, objKrs);
    const { level, delta } = detectDrift(obj.selfScore ?? null, suggested, obj.managerScore);
    rows.push({
      ownerId: obj.ownerId,
      ownerName: input.ownerNameMap?.[obj.ownerId],
      objectiveId: obj.id,
      objectiveTitle: obj.title,
      selfScore: obj.selfScore ?? null,
      managerScore: obj.managerScore ?? null,
      suggestedScore: Math.round(suggested * 1000) / 1000,
      drift: level,
      driftDelta: Math.round(delta * 1000) / 1000,
      actualProgress: Math.round(actualProgress * 1000) / 1000,
      confidence: obj.confidence,
      reasoning,
    });
  }

  // 排序: high drift 先, 然后 medium, low; 同级按 ownerName 字母
  const driftOrder: Record<DriftLevel, number> = { high: 0, medium: 1, low: 2 };
  rows.sort((a, b) => {
    const d = driftOrder[a.drift] - driftOrder[b.drift];
    if (d !== 0) return d;
    return (a.ownerName ?? a.ownerId).localeCompare(b.ownerName ?? b.ownerId);
  });

  const pendingCount = rows.filter((r) => r.managerScore == null).length;
  const highDriftCount = rows.filter((r) => r.drift === 'high').length;

  return {
    managerId: input.managerId,
    cycleId: input.cycleId,
    subordinateCount: input.subordinateIds.length,
    totalObjectives: rows.length,
    pendingCount,
    highDriftCount,
    rows,
  };
}

// ---------------------------------------------------------------------------
// 批量保存 (走 store update + audit)
// ---------------------------------------------------------------------------

export interface SaveCalibrationsInput {
  managerId: string;
  cycleId: string;
  updates: CalibrationUpdate[];
  /** 调用方传入的 store updater (避免直接耦合 Zustand client store) */
  updateObjective: (id: string, patch: Partial<Objective>) => void;
  /**
   * 可选 audit 回调 (server-only).
   * Client 不传 → 仅写 store; Server 传入 lib/audit/log → 同步走链式 hash.
   * 这样设计避免 audit 模块传递引入 postgres 进 client bundle.
   */
  auditCallback?: (action: string, actorId: string, metadata: Record<string, unknown>) => Promise<void>;
}

export interface SaveCalibrationsResult {
  appliedCount: number;
  skippedCount: number;
}

export async function saveCalibrations(input: SaveCalibrationsInput): Promise<SaveCalibrationsResult> {
  let applied = 0;
  let skipped = 0;
  for (const u of input.updates) {
    if (!u.objectiveId) {
      skipped++;
      continue;
    }
    if (u.managerScore != null && (u.managerScore < 0 || u.managerScore > 1)) {
      skipped++;
      continue;
    }
    input.updateObjective(u.objectiveId, {
      managerScore: u.managerScore,
      reviewedAt: Date.now(),
    } as Partial<Objective>);
    applied++;
  }

  // 单条 audit (批量校准做为一次 session). 仅在 server 传入 audit 回调时走.
  if (input.auditCallback) {
    await input.auditCallback('okr.calibration_session_saved', input.managerId, {
      cycleId: input.cycleId,
      appliedCount: applied,
      skippedCount: skipped,
    });
  }

  return { appliedCount: applied, skippedCount: skipped };
}
