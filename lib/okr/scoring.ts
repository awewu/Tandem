/**
 * OKR 评分系统 — Google Re:Work / Tita / Quantive 通用规则
 *
 * 评分制：0.0 - 1.0
 *   - 1.0  全部完成（罕见，"moonshot" 应避免）
 *   - 0.7  达成预期目标 ✅ 这是健康得分（Google 文化）
 *   - 0.4-0.6  部分完成
 *   - <0.4  未完成 / 需要复盘
 *
 * 角色：
 *   - 自评（self）— 负责人在周期末自己打分
 *   - 上级评分（manager）— 直属上级评估
 *   - 终评（final）— 通常是 (self * 0.4 + manager * 0.6) 的折中，或人工议定
 *
 * Objective 总分 = 加权 KR 终评 / 总权重（如未到周期末则用进度推算）
 */

import type { Confidence, KeyResult, Objective } from '../store';

export type ScoreBand = 'green' | 'yellow' | 'red';

export interface ScoreReport {
  /** 0-1.0 */
  value: number;
  /** 分数对应的健康度等级 */
  band: ScoreBand;
  /** 简短解读（中文） */
  interpretation: string;
}

/** 把 0-1.0 映射成红黄绿 */
export function scoreBand(score: number): ScoreBand {
  if (score >= 0.7) return 'green';
  if (score >= 0.4) return 'yellow';
  return 'red';
}

/** 把进度百分比 0-100 映射回 0-1.0 评分（周期内估算用） */
export function progressToScore(progress: number): number {
  return Math.max(0, Math.min(1, progress / 100));
}

/** 把 KR 当前值映射成评分（用于周期末未手动评分时的预估） */
export function inferKRScore(kr: KeyResult): number {
  if (kr.finalScore != null) return kr.finalScore;
  if (kr.selfScore != null) return kr.selfScore;
  // 由当前进度推算
  if (kr.type === 'binary') return kr.currentValue >= 1 ? 1.0 : 0.0;
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 1.0 : 0.0;
  const r = (kr.currentValue - kr.startValue) / span;
  return Math.max(0, Math.min(1, r));
}

/**
 * 计算 Objective 评分
 * 优先级：score（终评） > 加权 KR finalScore > 加权 KR selfScore > 加权 KR 进度推算
 */
export function calcObjectiveScore(
  obj: Objective,
  krs: KeyResult[],
): ScoreReport {
  if (obj.score != null) {
    return formatReport(obj.score, '已终评');
  }

  const objKRs = krs.filter((k) => k.objectiveId === obj.id);
  if (objKRs.length === 0) {
    if (obj.selfScore != null) return formatReport(obj.selfScore, '负责人自评');
    if (obj.managerScore != null) return formatReport(obj.managerScore, '上级评分');
    return formatReport(0, '尚无 KR 也尚未评分');
  }

  const totalWeight = objKRs.reduce((s, k) => s + (k.weight || 1), 0);
  if (totalWeight === 0) return formatReport(0, 'KR 权重为 0');

  const weighted = objKRs.reduce(
    (s, k) => s + inferKRScore(k) * (k.weight || 1),
    0,
  );
  const score = weighted / totalWeight;

  // 数据来源解释
  const allFinal = objKRs.every((k) => k.finalScore != null);
  const someManual = objKRs.some((k) => k.selfScore != null || k.finalScore != null);
  const hint = allFinal
    ? '基于 KR 终评加权'
    : someManual
      ? '基于 KR 部分手动评分 + 进度推算'
      : '基于 KR 当前进度估算';
  return formatReport(score, hint);
}

function formatReport(value: number, source: string): ScoreReport {
  const band = scoreBand(value);
  const judgement =
    band === 'green'
      ? '健康完成'
      : band === 'yellow'
        ? '部分完成，复盘改进'
        : '未达预期，需深入复盘';
  return {
    value: Math.round(value * 100) / 100,
    band,
    interpretation: `${source} · ${judgement}`,
  };
}

/** 把 confidence 映射成评分加成（0-100 进度 → 评分时的权重微调） */
export function confidenceWeight(c: Confidence): number {
  return c === 'on-track' ? 1.0 : c === 'at-risk' ? 0.85 : 0.6;
}

/**
 * 周期末"建议终评"：用 self * 0.4 + manager * 0.6
 * 如果只有一个就直接用那个，都没有则用 KR 加权推算
 */
export function suggestedFinalScore(obj: Objective, krs: KeyResult[]): number {
  if (obj.selfScore != null && obj.managerScore != null) {
    return Math.round((obj.selfScore * 0.4 + obj.managerScore * 0.6) * 100) / 100;
  }
  if (obj.managerScore != null) return obj.managerScore;
  if (obj.selfScore != null) return obj.selfScore;
  return calcObjectiveScore(obj, krs).value;
}

/** 对整个周期算总分（所有顶层 Objective 的加权平均） */
export function calcCycleScore(
  cycleId: string,
  allObjectives: Objective[],
  allKRs: KeyResult[],
): ScoreReport {
  const cycleObjs = allObjectives.filter((o) => o.cycleId === cycleId);
  if (cycleObjs.length === 0) return formatReport(0, '本周期无目标');

  const totalWeight = cycleObjs.reduce((s, o) => s + (o.weight || 1), 0);
  const weighted = cycleObjs.reduce(
    (s, o) => s + calcObjectiveScore(o, allKRs).value * (o.weight || 1),
    0,
  );
  return formatReport(weighted / totalWeight, '周期目标加权');
}
