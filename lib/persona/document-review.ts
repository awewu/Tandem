/**
 * lib/persona/document-review.ts · 中央 AI 评审文档 (CA-13 第六接入点, 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────────
 * 设计意图:
 *   员工在 /documents/[id] 写文档后点 "AI 评审" 按钮, 中央 AI 作为**参谋**
 *   给一份结构化评审: 清晰度 / 缺漏点 / 风险 / 建议下一步动作.
 *   不修改文档, 不替员工决定 promote 或 spawn, 只给依据 (advisory).
 *
 *   宪法 A 边界: 中央 AI 是参谋 — 评审只产 review 对象, 绝不自动
 *   触发 promote-to-memory / spawn-decision-card, 那两个动作由员工
 *   读完评审后**人工**点。
 *
 *   CA-13 接入: LLM 真跑过才 recordDecision({ context: 'document_review',
 *   refId=docId, refType='document' }), 失败的降级路径 (LLM 抛错) 不记账
 *   —— 与 retrospective_draft 同款政策, 避免污染 adoptionRate.
 *
 * Charter 对位:
 *   /charter §四 文档板块 — "AI 评审 + 升级 Memory + 议事化"三件套之第一件.
 *   DOC-2 (promote-to-memory) / DOC-4 (spawned-decision-card) 已成, 本档补 DOC-3.
 */

import { getRouter } from '../boot';
import { getStore } from '../storage/repository';
import { audit } from '../audit/log';

// ────────────────── 类型 ──────────────────

export type DocumentReviewSuggestion =
  | 'promote_to_memory'      // 内容可沉淀为组织 Memory
  | 'send_to_decision'       // 涉及需 cross-team 议事的决策
  | 'revise'                 // 需修订 (清晰度/缺漏/事实)
  | 'archive';               // 仅存档参考, 无需进一步动作

export interface DocumentReview {
  /** 文档 id */
  documentId: string;
  /** 评审生成时间 */
  generatedAt: string;
  /** 一两句话摘要 */
  summary: string;
  /** 清晰度 1-5 (5=极清晰) */
  clarityScore: number;
  /** 清晰度反馈 (≤ 200 字) */
  clarityFeedback: string;
  /** 完整度: 缺漏点列表 */
  missingPoints: string[];
  /** 风险点 (事实/法律/边界含糊/与组织记忆冲突等) */
  risks: string[];
  /** 建议后续动作 (员工人工决定是否真做) */
  suggestedActions: DocumentReviewSuggestion[];
  /** 关键动作的理由 (与 suggestedActions 一一对应或可为空) */
  rationale: string;
  /** 是否真跑了 LLM (false=降级模板) */
  llmRan: boolean;
}

export interface ReviewDocumentInput {
  documentId: string;
  requesterId: string;
  tenantId?: string;
}

// ────────────────── 主入口 ──────────────────

const SYSTEM_PROMPT = `你是 Tandem 中央 AI 的**文档评审参谋**. 任务: 读一份组织内部文档, 给员工一份结构化评审, **不替员工决定下一步**, 只产建议.

宪法 A: 你是参谋, 不是决策者. 不要说"我已为你...", 只说"建议你考虑...".

输出严格 JSON (UTF-8, 无解释包裹), 字段如下:
{
  "summary": string,                       // 1-2 句话, 描述文档讲了啥
  "clarityScore": 1|2|3|4|5,               // 整体清晰度: 1=难懂, 5=直白清晰
  "clarityFeedback": string,               // ≤ 100 字, 清晰度反馈
  "missingPoints": string[],               // 缺漏: 该有但没写的关键信息 (背景/数据/owner/时间窗等), 0-5 条
  "risks": string[],                       // 风险: 事实瑕疵 / 法律边界 / 责任含糊 / 与已知组织记忆冲突, 0-5 条
  "suggestedActions": ("promote_to_memory"|"send_to_decision"|"revise"|"archive")[],  // 0-3 条
  "rationale": string                      // ≤ 200 字, 解释为啥推这些 action
}

判断 suggestedActions 启发式:
- 沉淀感强 (复用方法/教训/SOP) → "promote_to_memory"
- 跨团队决策/有重大争议 → "send_to_decision"
- 缺漏或风险 ≥ 2 条 → "revise"
- 信息性留底 → "archive"`;

/**
 * 评审一份文档 — 永不抛错, 失败返回降级版本 (llmRan=false).
 *
 * 治理 (与 retrospective_draft 同款):
 *   1. LLM 真跑过才 recordDecision (失败路径不喂飞轮);
 *   2. 不写任何文档/Memory/ProxyAction, 100% advisory;
 *   3. audit 记一条 document_review.generated 给追踪.
 */
export async function reviewDocument(input: ReviewDocumentInput): Promise<DocumentReview | null> {
  const t0 = Date.now();
  const store = getStore();
  const doc = await store.documents.get(input.documentId);
  if (!doc) return null;

  // 截断: 大文档保护. 4000 字符够覆盖绝大多数内部文档 (≈ 2000 tokens), 太长 LLM 也只会摸鱼.
  const content = (doc.content ?? '').slice(0, 4000);
  const userPrompt = `**标题**: ${doc.title}\n**类型**: ${doc.type}\n**内容**:\n${content}`;

  let parsed: Partial<DocumentReview> = {};
  let llmRan = false;
  let llmUsage: { promptTokens?: number; completionTokens?: number } | undefined;
  let llmModel = 'unknown';

  try {
    const router = getRouter();
    const res = await router.chat({
      scenario: 'long_context',
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      responseFormat: 'json',
    });
    const text = typeof res.message.content === 'string' ? res.message.content : '{}';
    try {
      parsed = JSON.parse(text);
      llmRan = true;
      llmUsage = res.usage;
      llmModel = res.model ?? 'long_context';
    } catch {
      /* JSON parse 失败 → 仍按降级走, llmRan=false 不喂 CA-13 (输出不可信) */
    }
  } catch {
    /* router 失败 fail-soft, 走降级 */
  }

  const review: DocumentReview = {
    documentId: doc.id,
    generatedAt: new Date().toISOString(),
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : (llmRan ? '' : '评审降级: LLM 未响应, 仅返回模板. 建议人工通读.'),
    clarityScore: clampScore(parsed.clarityScore),
    clarityFeedback: typeof parsed.clarityFeedback === 'string' ? parsed.clarityFeedback.slice(0, 300) : '',
    missingPoints: sanitizeStringArray(parsed.missingPoints, 5),
    risks: sanitizeStringArray(parsed.risks, 5),
    suggestedActions: sanitizeActions(parsed.suggestedActions),
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 500) : '',
    llmRan,
  };

  // audit 总是记 (含降级), CA-13 仅 LLM 真跑过才记 (与 retrospective_draft 同款)
  await audit('document_review.generated', input.requesterId, {
    targetId: doc.id,
    targetType: 'document',
    metadata: {
      llmRan,
      clarityScore: review.clarityScore,
      missingCount: review.missingPoints.length,
      riskCount: review.risks.length,
      suggestedActions: review.suggestedActions,
    },
  }).catch(() => {/* audit 失败不阻塞 */});

  if (llmRan) {
    try {
      const { recordDecision } = await import('./company-brain-decision');
      const { estimateCostMicroUsd } = await import('../analytics/track');
      const tokensIn = llmUsage?.promptTokens ?? 0;
      const tokensOut = llmUsage?.completionTokens ?? 0;
      const inputSummary = `文档评审: ${doc.title.slice(0, 80)} (${doc.type})`;
      const outputSummary = [
        review.summary.slice(0, 200),
        review.suggestedActions.length > 0 ? `建议: ${review.suggestedActions.join(', ')}` : '',
        review.risks.length > 0 ? `风险 ${review.risks.length} 条` : '',
      ].filter(Boolean).join(' · ');
      await recordDecision({
        context: 'document_review',
        inputSummary,
        outputSummary,
        modelUsed: llmModel,
        providerUsed: 'router',
        scenario: 'long_context',
        tokensIn,
        tokensOut,
        costMicroUsd: estimateCostMicroUsd(llmModel, tokensIn, tokensOut),
        latencyMs: Date.now() - t0,
        refId: doc.id,
        refType: 'document',
        tenantId: input.tenantId,
      });
    } catch {
      /* recordDecision 失败不影响评审主流程 */
    }
  }

  return review;
}

// ────────────────── 净化器 ──────────────────

function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? Math.round(v) : Number.NaN;
  if (Number.isNaN(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

function sanitizeStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.slice(0, 200))
    .slice(0, max);
}

const VALID_ACTIONS: ReadonlyArray<DocumentReviewSuggestion> = [
  'promote_to_memory',
  'send_to_decision',
  'revise',
  'archive',
];

function sanitizeActions(v: unknown): DocumentReviewSuggestion[] {
  if (!Array.isArray(v)) return [];
  const out: DocumentReviewSuggestion[] = [];
  for (const x of v) {
    if (typeof x === 'string' && (VALID_ACTIONS as readonly string[]).includes(x) && !out.includes(x as DocumentReviewSuggestion)) {
      out.push(x as DocumentReviewSuggestion);
    }
    if (out.length >= 3) break;
  }
  return out;
}
