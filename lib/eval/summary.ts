/**
 * lib/eval/summary.ts · #11/#14 显影记分卡聚合 (纯函数, 可单测)
 *
 * 把 raw eval traces + attributions 汇成一眼可读的"AI 评分 + 归因胜率"指标,
 * 供 /admin/eval 顶部记分卡渲染。只读聚合, 无副作用。
 */

export interface GradeLike {
  score: number;
  pass: boolean;
}
export interface TraceLike {
  grades?: GradeLike[];
  createdAt: string;
}
export interface AttributionLike {
  verdict: 'positive' | 'neutral' | 'negative' | 'insufficient_data';
  progressDelta: number;
}

export interface EvalSummary {
  traceTotal: number;
  gradedTotal: number;
  gradePassRate: number | null;
  gradeAvgScore: number | null;
  traceLast7d: number;
  attribTotal: number;
  attribPositive: number;
  attribNegative: number;
  attribNeutral: number;
  attribInsufficient: number;
  /** (positive - negative) / 有效判定数 (排除 insufficient_data); 无有效判定 → null */
  attribNetWinRate: number | null;
  attribAvgDelta: number | null;
}

const DAY_MS = 86400_000;

export function computeEvalSummary(
  traces: TraceLike[],
  attributions: AttributionLike[],
  now: number = Date.now(),
): EvalSummary {
  const allGrades = traces.flatMap((t) => t.grades ?? []);
  const gradedTotal = traces.filter((t) => (t.grades?.length ?? 0) > 0).length;
  const sevenDaysAgo = now - 7 * DAY_MS;

  const pos = attributions.filter((a) => a.verdict === 'positive').length;
  const neg = attributions.filter((a) => a.verdict === 'negative').length;
  const validVerdicts = attributions.filter((a) => a.verdict !== 'insufficient_data').length;

  return {
    traceTotal: traces.length,
    gradedTotal,
    gradePassRate: allGrades.length ? allGrades.filter((g) => g.pass).length / allGrades.length : null,
    gradeAvgScore: allGrades.length ? allGrades.reduce((s, g) => s + g.score, 0) / allGrades.length : null,
    traceLast7d: traces.filter((t) => new Date(t.createdAt).getTime() >= sevenDaysAgo).length,
    attribTotal: attributions.length,
    attribPositive: pos,
    attribNegative: neg,
    attribNeutral: attributions.filter((a) => a.verdict === 'neutral').length,
    attribInsufficient: attributions.filter((a) => a.verdict === 'insufficient_data').length,
    attribNetWinRate: validVerdicts ? (pos - neg) / validVerdicts : null,
    attribAvgDelta: attributions.length
      ? attributions.reduce((s, a) => s + a.progressDelta, 0) / attributions.length
      : null,
  };
}
