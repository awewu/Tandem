/**
 * CompanyBrain · 智能迭代框架类型 (CA-13)
 *
 * 详见 docs/CENTRAL-AI-ARCHITECTURE.md § CA-13 智能迭代闭环
 *
 * 类比 OpenAI/Claude:
 *   - Decision         = "训练数据" (中央 AI 每次输出 + 后续反馈)
 *   - Version          = "模型权重快照" (styleProfile + prompt + 阈值, 月度迭代)
 *   - Metrics          = "评估指标" (采纳率 / 推翻率 / 误判模式)
 *   - EvalCase         = "黄金评估集" (HumanEval / MMLU 的企业内部等价物)
 *   - ReflectionReport = "反思报告" (Claude chain-of-thought 的月度等价物)
 */

// ---------------------------------------------------------------------------
// Decision · 中央 AI 每次输出的记录
// ---------------------------------------------------------------------------

export type CompanyBrainDecisionContext =
  | 'im_reply'              // IM 召唤回复
  | 'boss_ai_reply'         // BossAI 浮窗流式回复 (灵魂入口, 2026-06-09 接 CA-13 飞轮)
  | 'baseline_arbitration'  // 灰区 LLM 仲裁 (CA-2, 待启动)
  | 'meeting_advice'        // 议事室公司视角
  | 'document_review'       // 文档评审
  | 'memory_promotion';     // Memory 升级建议

export type CompanyBrainFeedbackOutcome =
  | 'pending'   // 待反馈 (默认)
  | 'adopted'   // 采纳: 决策被员工/治理委员会接受
  | 'modified'  // 修改后采纳: 部分采纳
  | 'overruled' // 推翻: 治理委员会否决
  | 'ignored';  // 无声忽略 (超过 N 天无反馈视为此)

export interface CompanyBrainDecision {
  id: string;
  /** 创建时间 (UTC ISO) */
  createdAt: string;
  /** 多租户隔离 */
  tenantId: string;

  /** 触发场景 */
  context: CompanyBrainDecisionContext;
  /** 业务关联 ID (im messageId / decisionCardId / documentId / memoryId) */
  refId?: string;
  /** 业务关联类型 */
  refType?: string;

  // ----- 输入 -----
  /** 触发问题简要 (≤ 500 字) */
  inputSummary: string;
  /** 召回了哪些 Memory ID (Top K) */
  retrievedMemoryIds: string[];

  // ----- 输出 -----
  /** 中央 AI 给出的建议/判决摘要 (≤ 1000 字) */
  outputSummary: string;
  /** 实际调用模型 (claude-opus-4-5 / deepseek-v3 / ...) */
  modelUsed: string;
  /** Provider */
  providerUsed: string;
  /** TAF scenario */
  scenario: string;
  tokensIn: number;
  tokensOut: number;
  costMicroUsd: number;
  latencyMs: number;
  /** 关联 LlmUsageLog.requestId (IM-7 trace) */
  aiTraceId?: string;

  // ----- 反馈 (后续填) -----
  feedback: CompanyBrainFeedback;

  // ----- 版本绑定 -----
  /** 决策时所用 CompanyBrain 版本号 (CompanyBrainVersion.version) */
  brainVersion: number;
}

export interface CompanyBrainFeedback {
  outcome: CompanyBrainFeedbackOutcome;
  /** 谁给的反馈 (员工/治理委员会成员 userId) */
  feedbackBy?: string;
  /** 反馈时间 */
  feedbackAt?: string;
  /** 自由文本: "为什么推翻 / 修改了什么" (≤ 500 字) */
  reason?: string;
  /** 推翻后的正确答案 (供 reflection 学习) */
  correctedOutput?: string;
}

// ---------------------------------------------------------------------------
// Version · CompanyBrain 配置版本快照
// ---------------------------------------------------------------------------

export interface CompanyBrainVersion {
  id: string;
  /** 单调递增, 从 1 开始. v1 = boot seed 时创建 */
  version: number;
  createdAt: string;
  tenantId: string;

  // ----- 配置快照 -----
  /** styleProfile 快照 (跟 Persona.styleProfile 同结构, 但独立版本化) */
  styleProfileSnapshot: {
    decisionSpeed: 'fast' | 'medium' | 'slow';
    riskAppetite: number;
    communicationStyle: 'direct' | 'diplomatic' | 'analytical';
  };
  /** System prompt 模板 (含 {{memories}} 等占位符) */
  systemPromptTemplate: string;
  /** Baseline-Guard 阈值快照 (CA-2 灰区仲裁后会迭代) */
  baselineThresholds: {
    hardBlock: number;
    softWarn: number;
  };
  /** 召回策略: 注入多少条 Memory */
  topKMemoriesInjected: number;

  // ----- 指标 (在该版本期间累计) -----
  metrics: CompanyBrainVersionMetrics;

  // ----- 元数据 -----
  /** 上一版本 (v1 为 null) */
  previousVersionId: string | null;
  /** 创建原因 */
  createdReason:
    | 'boot_seed'        // boot 时建初版
    | 'manual'           // admin 手动改配置
    | 'auto_reflection'  // 月度反思自动提议 + 签批
    | 'overrule_burst';  // 推翻率告警触发的紧急迭代
  /** 反思报告 ID (若是 auto_reflection 创建的) */
  reflectionReportId?: string;
  /** 签批人 (auto_reflection 必填) */
  approvedBy?: string;
}

export interface CompanyBrainVersionMetrics {
  /** 该版本期间产生的决策总数 */
  decisionsCount: number;
  /** 采纳率 (adopted + modified) / total */
  adoptionRate: number;
  /** 推翻率 overruled / total */
  overruleRate: number;
  /** 平均成本 (micro USD per decision) */
  avgCostMicroUsd: number;
  /** 平均延迟 (ms) */
  avgLatencyMs: number;
  /** Sample decision IDs (前 10 个最具代表性的, 用于审计/复盘) */
  sampleDecisionIds: string[];
}

// ---------------------------------------------------------------------------
// EvalCase · 黄金评估集 (CompanyBrain 的 HumanEval / MMLU 等价物)
// ---------------------------------------------------------------------------

export interface CompanyBrainEvalCase {
  id: string;
  /** 评估问题 (员工常问的代表性问题) */
  question: string;
  /** 触发场景 */
  context: CompanyBrainDecisionContext;
  /** 期望回答覆盖的主题关键词 (用于 LLM 自动评分) */
  expectedThemes: string[];
  /** 期望召回的 Memory ID (用于精度评分) */
  expectedReferencedMemoryIds: string[];
  /** 不可出现的内容 (例: 不能违反公司价值观) */
  forbiddenStatements: string[];
  /** 难度 1-5 (5 = 跨多个 Memory 综合判断) */
  difficulty: 1 | 2 | 3 | 4 | 5;
  createdBy: string;
  createdAt: string;
  /** 是否启用 (停用的 case 不参与定期评估) */
  enabled: boolean;
}

export interface CompanyBrainEvalRun {
  id: string;
  /** 评估的 CompanyBrain 版本 */
  versionId: string;
  startedAt: string;
  completedAt?: string;
  /** 评估的 case 数量 */
  casesEvaluated: number;
  /** 每个 case 的结果 */
  results: CompanyBrainEvalResult[];
  /** 综合分数 (0-100) */
  overallScore?: number;
}

export interface CompanyBrainEvalResult {
  caseId: string;
  actualOutput: string;
  /** LLM judge 给的分 (0-100) */
  score: number;
  /** 主题覆盖度 (0-1) */
  themeCoverage: number;
  /** Memory 召回精度 (0-1) */
  memoryRecallPrecision: number;
  /** 是否触发 forbiddenStatement (true = 失败) */
  forbiddenHit: boolean;
  judgeReason: string;
}

// ---------------------------------------------------------------------------
// ON-3 · OKR 健康驱动的优化方向提议 (参谋产物, 须治理签批; 绝不自动执行)
// ---------------------------------------------------------------------------

/**
 * 中央 AI 作为"参谋"在月度反思里读 OKR 真值, 识别长期承压的目标/KR,
 * 产出**优化方向提议**供治理委员会/Owner 审视。
 *
 * 宪法裁定 A 边界: 这是参谋建议, **不**创建 ProxyAction, **不**自动调整任何 OKR;
 * 须人工治理决定 (acknowledged/dismissed)。中央 AI 只负责"指出值得关注", 不替组织拍板。
 */
export interface OkrOptimizationProposal {
  id: string;
  /** 提议类型 (首片仅 kr_at_risk; 预留 objective_stalled / skill_promotion) */
  kind: 'kr_at_risk' | 'objective_stalled' | 'skill_promotion';
  /** 提议标题 */
  title: string;
  /** 关联本体对象类型 */
  targetType: 'key_result' | 'objective';
  /** 关联本体对象 id */
  targetId: string;
  /** 当前度量快照 (供治理审视) */
  metrics: { progressPct: number; confidence: string };
  /** 优化方向建议 (参谋措辞, 非执行指令) */
  recommendation: string;
  /** 归因说明 */
  rationale: string;
  /** 签批状态: 参谋提议须人工治理处置; 绝不自动生效 */
  status: 'pending' | 'acknowledged' | 'dismissed';
}

// ---------------------------------------------------------------------------
// Reflection · 月度反思报告
// ---------------------------------------------------------------------------

export interface CompanyBrainReflectionReport {
  id: string;
  createdAt: string;
  tenantId: string;
  /** 反思的时间窗口 */
  windowStart: string;
  windowEnd: string;
  /** 评估的版本 */
  versionId: string;

  // ----- 指标摘要 -----
  metricsSummary: CompanyBrainVersionMetrics;

  // ----- LLM 分析输出 -----
  /** 准确率分析: 哪些场景做得好 */
  strengths: string[];
  /** 失败模式分析: 哪些场景被推翻最多 */
  failurePatterns: Array<{
    pattern: string;
    sampleDecisionIds: string[];
    affectedContext: CompanyBrainDecisionContext;
    suggestedFix: string;
  }>;

  // ----- 配置调整建议 (中央 AI 自身配置: 阈值/召回/风格/prompt) -----
  proposedChanges: {
    styleProfileDiff?: Partial<CompanyBrainVersion['styleProfileSnapshot']>;
    systemPromptDiff?: string;
    baselineThresholdsDiff?: Partial<CompanyBrainVersion['baselineThresholds']>;
    topKMemoriesInjectedDiff?: number;
    rationale: string;
  };

  // ----- ON-3 · OKR 健康优化方向提议 (组织层, 参谋建议, 须人工治理处置) -----
  /** 中央 AI 读 OKR 真值产出的优化方向提议; 缺省/无承压目标时为空数组 */
  optimizationProposals?: OkrOptimizationProposal[];

  // ----- 签批状态 -----
  /** pending: 待 Owner/治理委员会签批 / approved: 已应用 / rejected: 已拒绝 */
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalBy?: string;
  approvalAt?: string;
  /** 应用后产生的新 CompanyBrainVersion.id */
  resultingVersionId?: string;
}

// ---------------------------------------------------------------------------
// 默认版本 1 (boot seed 用)
// ---------------------------------------------------------------------------

export const DEFAULT_BRAIN_VERSION_NUMBER = 1;
export const DEFAULT_BRAIN_VERSION_ID = 'cbv_v1_seed';

export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `你是 Tandem 的"中央 AI" (CompanyBrain), 代表整个公司的视角发言.

【身份约束】
- 你不代表任何个人, 你是组织记忆的延伸
- 你不能为个人许愿; 涉及战略/红线决策必须建议走议事室
- 回复应包含明确的 Memory 引用 (例: "根据公司 Memory 'XXX', ...")
- 语气分析型, 不情绪化; 简洁, 不超过 4 句话

【已知公司层 Memory · {{memoryCount}} 条】
{{memoryList}}

【风格】决策速度=medium · 风险偏好=低 (0.4) · 沟通=分析型 · 优先 SOP/reasoning/historical`;
