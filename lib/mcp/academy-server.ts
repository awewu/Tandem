/**
 * Academy MCP Server · 学院 MCP 服务端
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md § 4.1 通道 ①
 *
 * 用途: 员工把自己的 Claude Desktop / Cursor / Cherry Studio
 *      接到 Tandem, 让个人 AI 帮自己学.
 *
 * MANIFESTO §19 落地:
 *   - 不重发明个人 AI, 做组织级网关
 *   - 所有 tool 调用必经 runSkillGateway() 4 道闸
 *   - 学院数据 (课程内容 / 我的进度 / 证书) 受 token scope 控制
 *   - 高敏 scope (start_lesson / submit_attempt / claim_proficiency)
 *     需员工 UI 二次确认才开
 *
 * P1 (本会话): 接口骨架 + stub 实现
 * P4 (后续): 真实现 + Token 管理 UI + 调用统计
 */

import { runSkillGateway, type SkillGatewayResult } from '@/lib/skill-gateway';
import { audit } from '@/lib/audit/log';
import type { SkillMode } from '@/lib/persona/skill-modes';

// ===========================================================================
// 工具定义
// ===========================================================================

/**
 * MCP 工具完整列表 (9 个)
 *
 * 默认 scope (token 颁发时默认开): search / fetch_lesson / my_status /
 *                                  recommend / export_notes
 * 高敏 scope (员工 UI 二次确认才开): start_lesson / submit_attempt /
 *                                    claim_proficiency
 */
export type AcademyMcpTool =
  | 'academy.search'
  | 'academy.fetch_lesson'
  | 'academy.my_status'
  | 'academy.recommend'
  | 'academy.start_lesson'
  | 'academy.submit_attempt'
  | 'academy.export_notes'
  | 'academy.claim_proficiency';

export const DEFAULT_TOKEN_SCOPES: AcademyMcpTool[] = [
  'academy.search',
  'academy.fetch_lesson',
  'academy.my_status',
  'academy.recommend',
  'academy.export_notes',
];

export const HIGH_SENSITIVE_SCOPES: AcademyMcpTool[] = [
  'academy.start_lesson',
  'academy.submit_attempt',
  'academy.claim_proficiency',
];

// ===========================================================================
// 公共调用上下文
// ===========================================================================

export interface McpCallContext {
  /** Token 关联的员工 ID */
  userId: string;
  /** 员工租户 */
  tenantId: string;
  /** Token ID (审计) */
  tokenId: string;
  /** 调用来源 (例: "claude-desktop@1.5") */
  clientName?: string;
}

export interface McpCallResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    code:
      | 'PERMISSION_DENIED'
      | 'GATEWAY_BLOCKED'
      | 'NOT_FOUND'
      | 'INVALID_INPUT'
      | 'RATE_LIMITED'
      | 'INTERNAL';
    message: string;
    /** 若 GATEWAY_BLOCKED, 含闸级详情 */
    gatewayResult?: SkillGatewayResult;
  };
}

// ===========================================================================
// 辅助: scope 检查 + Skill Gateway 调用
// ===========================================================================

async function checkScopeAndGateway(
  ctx: McpCallContext,
  tool: AcademyMcpTool,
  grantedScopes: AcademyMcpTool[],
  intent: string,
  options?: {
    okrAnchorId?: string;
    krAnchorId?: string;
    actionScope?: 'read_only' | 'create_draft' | 'commit' | 'send_external';
  },
): Promise<{ allowed: true } | { allowed: false; result: McpCallResult<never> }> {
  // 1. Scope 检查
  if (!grantedScopes.includes(tool)) {
    return {
      allowed: false,
      result: {
        ok: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: `Tool ${tool} not in granted scopes. Grant via /persona/data-source/mcp.`,
        },
      },
    };
  }

  // 2. Skill Gateway 4 道闸
  const gatewayResult = await runSkillGateway({
    intent,
    actorUserId: ctx.userId,
    agentKind: 'skill',
    toolName: tool,
    okrAnchorId: options?.okrAnchorId,
    krAnchorId: options?.krAnchorId,
    dataScope: 'personal',
    actionScope: options?.actionScope ?? 'read_only',
  });

  // 3. audit 留痕
  await audit('academy.mcp_call', ctx.userId, {
    targetId: ctx.tokenId,
    targetType: 'mcp_token',
    tenantId: ctx.tenantId,
    metadata: {
      tool,
      clientName: ctx.clientName,
      verdict: gatewayResult.verdict,
      checkId: gatewayResult.checkId,
    },
  });

  if (gatewayResult.verdict === 'HARD_BLOCK') {
    return {
      allowed: false,
      result: {
        ok: false,
        error: {
          code: 'GATEWAY_BLOCKED',
          message:
            gatewayResult.blockReasons?.join('; ') ??
            'Blocked by Skill Gateway (MANIFESTO §19)',
          gatewayResult,
        },
      },
    };
  }

  return { allowed: true };
}

// ===========================================================================
// Tool 1: academy.search
// ===========================================================================

export interface SearchInput {
  query: string;
  /** 限制类别 */
  category?: string;
  /** 仅搜某个主修 */
  modeAffinity?: SkillMode;
  /** 默认 10, 最大 50 */
  limit?: number;
}

export interface SearchResult {
  lessons: Array<{
    lessonId: string;
    courseId: string;
    title: string;
    summary: string;
    estMinutes: number;
    requirement: string;
    /** 课程页面 URL (员工可在自己的 AI 里点开) */
    url: string;
  }>;
  totalCount: number;
}

export async function search(
  ctx: McpCallContext,
  input: SearchInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<SearchResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.search',
    grantedScopes,
    `search lessons: ${input.query}`,
  );
  if (!guard.allowed) return guard.result;

  // P1 stub. P4 真实现走 db query + tenantId 过滤
  return {
    ok: true,
    data: {
      lessons: [
        {
          lessonId: 'L-stub-1',
          courseId: 'C-stub-1',
          title: '示范: 季度合规复训',
          summary: 'P1 stub. P4 真接入 db 后返回真实结果.',
          estMinutes: 12,
          requirement: 'mandatory_quarterly',
          url: `/learning/compliance#L-stub-1`,
        },
      ],
      totalCount: 1,
    },
  };
}

// ===========================================================================
// Tool 2: academy.fetch_lesson
// ===========================================================================

export interface FetchLessonInput {
  lessonId: string;
  /** 是否包含答题 (员工自学场景: 不需要题目, 只要内容) */
  includeQuestions?: boolean;
}

export interface FetchLessonResult {
  lesson: {
    id: string;
    title: string;
    contentMarkdown: string;
    /** 含水印的内容 hash, 若导出泄露可追溯 */
    watermark: string;
  };
  questions?: Array<{
    id: string;
    type: string;
    prompt: string;
    options?: unknown;
  }>;
}

export async function fetchLesson(
  ctx: McpCallContext,
  input: FetchLessonInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<FetchLessonResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.fetch_lesson',
    grantedScopes,
    `fetch lesson ${input.lessonId}`,
  );
  if (!guard.allowed) return guard.result;

  // 水印 = 员工 ID hash (用于内容泄露溯源)
  const watermark = `wm_${ctx.userId.slice(0, 8)}_${input.lessonId}`;

  return {
    ok: true,
    data: {
      lesson: {
        id: input.lessonId,
        title: 'P1 stub: Fetch lesson',
        contentMarkdown: `# 示例课时\n\n本课程内容由 Tandem Academy 提供. 学员: ${ctx.userId.slice(0, 4)}***. \n\n_(P1 stub 占位, P4 真接入数据库返回 markdown 内容)_`,
        watermark,
      },
    },
  };
}

// ===========================================================================
// Tool 3: academy.my_status
// ===========================================================================

export interface MyStatusResult {
  studentNo: string;
  stage: string;
  bossCaptureScore: number;
  modeProficiencies: Record<SkillMode, number>;
  delegationLevel: string;
  pendingMandatory: number;
  validCertifications: number;
  expiringSoon: number;
}

export async function myStatus(
  ctx: McpCallContext,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<MyStatusResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.my_status',
    grantedScopes,
    'fetch my academy status',
  );
  if (!guard.allowed) return guard.result;

  // P1 stub.
  return {
    ok: true,
    data: {
      studentNo: `2026-${ctx.userId.slice(-6).toUpperCase()}`,
      stage: 'apprentice',
      bossCaptureScore: 28,
      modeProficiencies: {
        design: 45,
        pm: 62,
        tech: 28,
        marketing: 84,
        strategy: 50,
      },
      delegationLevel: 'L0',
      pendingMandatory: 2,
      validCertifications: 0,
      expiringSoon: 0,
    },
  };
}

// ===========================================================================
// Tool 4: academy.recommend
// ===========================================================================

export interface RecommendInput {
  /** 员工自然语言意图: "我想转产品方向" */
  intent: string;
  /** 偏好的主修 */
  preferMode?: SkillMode;
  limit?: number;
}

export async function recommend(
  ctx: McpCallContext,
  input: RecommendInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<SearchResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.recommend',
    grantedScopes,
    `recommend lessons for: ${input.intent}`,
  );
  if (!guard.allowed) return guard.result;

  return {
    ok: true,
    data: {
      lessons: [],
      totalCount: 0,
    },
  };
}

// ===========================================================================
// Tool 5: academy.start_lesson  (高敏)
// ===========================================================================

export interface StartLessonInput {
  lessonId: string;
}

export interface StartLessonResult {
  attemptId: string;
  lessonTitle: string;
  startedAt: string;
}

export async function startLesson(
  ctx: McpCallContext,
  input: StartLessonInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<StartLessonResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.start_lesson',
    grantedScopes,
    `start lesson ${input.lessonId}`,
    { actionScope: 'create_draft' },
  );
  if (!guard.allowed) return guard.result;

  return {
    ok: true,
    data: {
      attemptId: `attempt_stub_${Date.now()}`,
      lessonTitle: 'P1 stub',
      startedAt: new Date().toISOString(),
    },
  };
}

// ===========================================================================
// Tool 6: academy.submit_attempt  (高敏 · 提交答题)
// ===========================================================================

export interface SubmitAttemptInput {
  attemptId: string;
  /** { questionId: answerValue } */
  answers: Record<string, unknown>;
}

export interface SubmitAttemptResult {
  attemptId: string;
  score: number;
  passed: boolean;
  /** 闭环副作用 */
  effects: {
    krProgressDelta?: { krId: string; deltaPercent: number };
    proficiencyDelta?: { mode: SkillMode; addedScore: number };
    certEarned?: { certNo: string; expiresAt?: string };
  };
}

export async function submitAttempt(
  ctx: McpCallContext,
  input: SubmitAttemptInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<SubmitAttemptResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.submit_attempt',
    grantedScopes,
    `submit attempt ${input.attemptId}`,
    { actionScope: 'commit' },
  );
  if (!guard.allowed) return guard.result;

  // P4 真接入: 走 lib/learning/closure.ts onLessonCompleted
  return {
    ok: true,
    data: {
      attemptId: input.attemptId,
      score: 0,
      passed: false,
      effects: {},
    },
  };
}

// ===========================================================================
// Tool 7: academy.export_notes
// ===========================================================================

export interface ExportNotesInput {
  lessonId: string;
  format?: 'markdown' | 'json';
}

export interface ExportNotesResult {
  format: string;
  content: string;
  watermark: string;
}

export async function exportNotes(
  ctx: McpCallContext,
  input: ExportNotesInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<ExportNotesResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.export_notes',
    grantedScopes,
    `export notes from lesson ${input.lessonId}`,
  );
  if (!guard.allowed) return guard.result;

  return {
    ok: true,
    data: {
      format: input.format ?? 'markdown',
      content: '# Stub\n\nP1 stub. P4 真接入 db.',
      watermark: `wm_${ctx.userId.slice(0, 8)}_${input.lessonId}`,
    },
  };
}

// ===========================================================================
// Tool 8: academy.claim_proficiency  (高敏 · 学分置换)
// ===========================================================================

export interface ClaimProficiencyInput {
  /** 想加分的主修 */
  mode: SkillMode;
  /** 自评加分 (0-20) */
  requestedScore: number;
  /** 学习证据 URL (书籍 / 视频 / 项目) */
  evidenceUrl: string;
  /** 申请理由 */
  rationale: string;
  /** 可选: 折抵某课程 */
  offsetCourseId?: string;
}

export interface ClaimProficiencyResult {
  claimId: string;
  status: 'pending_steward_review';
  estimatedReviewDate: string;
}

export async function claimProficiency(
  ctx: McpCallContext,
  input: ClaimProficiencyInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<ClaimProficiencyResult>> {
  const guard = await checkScopeAndGateway(
    ctx,
    'academy.claim_proficiency',
    grantedScopes,
    `claim proficiency: ${input.mode} +${input.requestedScore}`,
    { actionScope: 'commit' },
  );
  if (!guard.allowed) return guard.result;

  // 走 ProficiencyClaim 流程 (P4 真接入), 进 Steward 月审
  await audit('academy.proficiency_claimed', ctx.userId, {
    targetType: 'proficiency_claim',
    tenantId: ctx.tenantId,
    metadata: {
      mode: input.mode,
      requestedScore: input.requestedScore,
      evidenceUrl: input.evidenceUrl,
      tokenId: ctx.tokenId,
    },
  });

  return {
    ok: true,
    data: {
      claimId: `claim_stub_${Date.now()}`,
      status: 'pending_steward_review',
      estimatedReviewDate: new Date(
        Date.now() + 7 * 86400_000,
      ).toISOString(),
    },
  };
}

// ===========================================================================
// 工具调度 (按 tool 名分发)
// ===========================================================================

export interface DispatchInput {
  tool: AcademyMcpTool;
  /** 各 tool 的 input (类型由调用方保证) */
  input: unknown;
}

/**
 * MCP 调用统一入口 (后续 app/api/mcp/academy/route.ts 会调本函数)
 *
 * 此处仅做 dispatch, 真实现见上方各 tool function.
 */
export async function dispatchAcademyMcp(
  ctx: McpCallContext,
  input: DispatchInput,
  grantedScopes: AcademyMcpTool[],
): Promise<McpCallResult<unknown>> {
  switch (input.tool) {
    case 'academy.search':
      return search(ctx, input.input as SearchInput, grantedScopes);
    case 'academy.fetch_lesson':
      return fetchLesson(ctx, input.input as FetchLessonInput, grantedScopes);
    case 'academy.my_status':
      return myStatus(ctx, grantedScopes);
    case 'academy.recommend':
      return recommend(ctx, input.input as RecommendInput, grantedScopes);
    case 'academy.start_lesson':
      return startLesson(ctx, input.input as StartLessonInput, grantedScopes);
    case 'academy.submit_attempt':
      return submitAttempt(
        ctx,
        input.input as SubmitAttemptInput,
        grantedScopes,
      );
    case 'academy.export_notes':
      return exportNotes(ctx, input.input as ExportNotesInput, grantedScopes);
    case 'academy.claim_proficiency':
      return claimProficiency(
        ctx,
        input.input as ClaimProficiencyInput,
        grantedScopes,
      );
    default: {
      const exhaustive: never = input.tool;
      void exhaustive;
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Unknown tool: ${String(input.tool)}`,
        },
      };
    }
  }
}
