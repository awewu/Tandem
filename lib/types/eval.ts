/**
 * Eval / Trace-Grading 台 · 类型 (P0 · 2026-07-20)
 *
 * 让 agent 行为可度量 (trace + grader 评分) 且可归因 (decision→KR 因果),
 * 解 STATE-OF-THE-CODE §0.3 的 #11 (evolution 仍是计数器) / #14 (Skill 端到端无评估)。
 *
 * 纪律: 纯只读只记 — 评估/归因绝不成为 proposer, 绝不自动改 OKR/配置 (宪法 A)。
 */

/** 一次可评分的 agent pass 类型 */
export type EvalTraceKind = 'perception' | 'act' | 'reasoning' | 'decision' | 'okr_review';

/** trace 里精简记录的一次工具调用 (只留评分所需字段) */
export interface EvalToolInvocation {
  name: string;
  ok: boolean;
  cached?: boolean;
  latencyMs?: number;
  /** 错误码 (e.g. 'tool_not_allowed'), 供 no-forbidden-tool grader 判定 */
  error?: string;
}

/** grader 对一条 trace 的评分 */
export interface EvalGrade {
  graderId: string;
  /** 0..1 */
  score: number;
  pass: boolean;
  rubric: string;
  notes?: string;
  gradedAt: string;
}

/** 一次 agent pass 的完整轨迹 (评分对象) */
export interface EvalTrace {
  id: string; // evt_...
  /** = pass 的 checkId/aiTraceId, 关联 LlmUsageLog */
  traceId: string;
  tenantId: string;
  kind: EvalTraceKind;
  actorUserId: string;
  isProxy: boolean;
  /** ≤500 */
  inputSummary: string;
  toolInvocations: EvalToolInvocation[];
  /** ≤1000 */
  finalOutputSummary: string;
  roundsExecuted: number;
  /** tool 循环是否自然收敛 (未撞 maxRounds) */
  finishedNaturally?: boolean;
  tokensUsed: number;
  latencyMs: number;
  /** pass 门控原因 */
  triggerReason?: string;
  /** kind-specific 评分信号 (e.g. act 的 rejectedRed 计数) */
  meta?: Record<string, unknown>;
  /** 该 pass 产出的 CA-13 决策 id (若有) */
  linkedDecisionId?: string;
  /** 该 pass/决策影响的 KR/Objective id */
  linkedKrIds?: string[];
  /** 评分后回填 */
  grades?: EvalGrade[];
  createdAt: string;
}

/** #11 因果归因判定 */
export type AttributionVerdict = 'positive' | 'neutral' | 'negative' | 'insufficient_data';

/** 一条 decision→KR 的因果归因记录 */
export interface EvalAttribution {
  id: string; // eva_...
  tenantId: string;
  /** 归因来源: okr_proposal = reflection 的 OKR 优化提议被治理 acknowledged; decision = CA-13 决策 */
  sourceType: 'okr_proposal' | 'decision';
  /** 来源 id (proposal id 或 CompanyBrainDecision.id) */
  decisionId: string;
  /** 来源报告 id (sourceType=okr_proposal 时) */
  sourceReportId?: string;
  targetType: 'key_result' | 'objective';
  targetId: string;
  /** 复制 decision.feedback.outcome */
  adoptedOutcome: string;
  windowDays: number;
  /** 决策时点进度 (0..1) */
  progressBefore: number;
  /** 窗口末进度 (0..1) */
  progressAfter: number;
  progressDelta: number;
  verdict: AttributionVerdict;
  /** hindsight critic 一句诊断 (best-effort, 可空) */
  llmDiagnosis?: string;
  createdAt: string;
}

/** 归因 pass 汇总 (注入 reflection 报告) */
export interface AttributionSummary {
  windowDays: number;
  samples: number;
  positive: number;
  neutral: number;
  negative: number;
  insufficient: number;
  generatedAt: string;
}
