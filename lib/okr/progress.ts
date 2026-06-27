/**
 * lib/okr/progress.ts · OKR 进度计算单一真值 (SSOT)
 *
 * 收敛历史上散落 8+ 处的进度重算 (重构-1, 2026-06-25):
 *   - lib/store/okr.ts          (calcKRProgress / getObjectiveProgress)
 *   - app/okr/dashboard         (本地 calcObjectiveProgress — 漏 binary/milestone, 已修)
 *   - components/okr/okr-alignment-tree (本地 calcObjProgress — 漏 binary/milestone, 已修)
 *   - lib/insights/derive.ts    (本地 calcKRProgress — 与本文件一致)
 *
 * 修复的口径分裂 (历史 bug):
 *   dashboard / alignment-tree 旧实现对 binary / milestone 类型 KR 用
 *   (current-start)/(target-start) 公式 → 与详情页 (store) 不一致。
 *   统一走 krProgress 后, 各视图进度与详情页严格一致。
 *
 * 注: 评分 (0-1.0) 语义不同, 仍在 lib/okr/scoring.ts (inferKRScore), 不在此收敛。
 * 注: 服务端 rollup 真值 Objective.currentProgress 的优先级集成是独立决策, 见
 *     docs/COMPETITOR-TITA-2026-06.md §十; 本文件保持 store 既有行为
 *     (progressOverride > 本地 KR 加权), 不擅自改变运行时数值。
 */

import type { KeyResult, Objective } from '../store';

/** 单个 KR 进度 (0-100), 处理 numeric / percentage / milestone / binary 四种类型。 */
export function krProgress(kr: KeyResult): number {
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

/**
 * Objective 进度 (0-100)。
 * 优先级: progressOverride (手动覆盖) > 子 KR 加权平均 (krProgress × weight)。
 * @param allKrs 可传入全量 keyResults, 内部按 objectiveId 过滤。
 */
export function objectiveProgress(obj: Objective, allKrs: KeyResult[]): number {
  if (obj.progressOverride != null) return obj.progressOverride;
  const krs = allKrs.filter((k) => k.objectiveId === obj.id);
  if (krs.length === 0) return 0;
  const totalWeight = krs.reduce((sum, k) => sum + (k.weight || 1), 0);
  if (totalWeight === 0) return 0;
  const weighted = krs.reduce((sum, k) => sum + krProgress(k) * (k.weight || 1), 0);
  return Math.round(weighted / totalWeight);
}
