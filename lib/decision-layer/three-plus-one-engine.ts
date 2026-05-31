/**
 * 3+1 Decision Engine · 决策选项生成器 (通用层)
 *
 * 对应 MANIFESTO 第二条 (3+1 框架, "任何 AI 决策辅助场景, 必须呈现")
 * 对应 AGENT-FRAMEWORK Layer 4
 *
 * P0.5 抽层 (2026-05-28): 从 lib/convergence/ 移到 lib/decision-layer/, 服务于:
 *   - 议事室 (convergence)        ← 已落地
 *   - 5min 日报 KR 推流前       ← P1 接入
 *   - TTI 拆解建议               ← P1 接入
 *   - 周回顾                     ← P1 接入
 *   - 主分身 brief 推荐先做哪一项 ← P1 接入
 *   - 学习中心答题反馈           ← P2 接入
 *
 * A: SOP             (从 Memory 层 SOP 提取标准动作)
 * B: AGENT_REASONING (LLM 推演)
 * C: HISTORICAL      (从 Memory 层 case 找最相似历史)
 * D: ORIGINAL        (员工原创, 强制 humanOnly=true, 禁止 AI 代写)
 */

import type { DecisionOption } from '../types/decision-card';
import type { TandemRouter } from '../taf/router';
import type { ChatMessage } from '../taf/provider/types';

// ---------------------------------------------------------------------------
// Memory 检索接口 (后续由 RAG 实现替换)
// ---------------------------------------------------------------------------

export interface MemoryRetriever {
  /** 找最相关的 SOP */
  findRelatedSOP(query: string, limit: number): Promise<MemorySearchResult[]>;
  /** 找最相似的历史案例 */
  findHistoricalCases(query: string, limit: number): Promise<MemorySearchResult[]>;
}

export interface MemorySearchResult {
  id: string;
  title: string;
  body: string;
  similarity: number;       // 0-1
}

// ---------------------------------------------------------------------------
// 输入 / 输出
// ---------------------------------------------------------------------------

/**
 * 3+1 决策场景标签 (P0.5 新增, 用于 adapter 标识 + audit 留痕).
 * 议事室之外的场景在 P1+ 接入.
 */
export type DecisionScenario =
  | 'convergence'      // 议事室 (已接入)
  | 'report_extract'   // 5min 日报 KR 推流前 (P1)
  | 'tti_breakdown'    // TTI 任务拆解 (P1)
  | 'weekly_retro'     // 本周回顾 (P1)
  | 'persona_brief'    // 主分身 brief 推荐 (P1)
  | 'learning_qa';     // 学习中心答题 (P2)

export interface DecisionContext {
  cardId: string;
  title: string;
  /** 决议描述 / 用户输入 */
  description: string;
  /** 关联的 KR 标题 (用于 LLM 上下文) */
  relatedKrTitles?: string[];
  /** 决议涉及的材料原文 (摘要) */
  materialDigests?: string[];
  /**
   * 议事发起人 userId, 用于 baseline-guard 可见性过滤 + 审计.
   * §T15: 议事决策必须经组织记忆基线校验, 调用方应该传入.
   * 留 optional 为向后兼容; 未来移除 optional 强制传入.
   */
  actorUserId?: string;
  /**
   * 场景标签, 用于 adapter audit + 后续按场景定制 prompt.
   * 缺省时按 'convergence' 处理 (向后兼容).
   */
  scenario?: DecisionScenario;
}

export interface OptionGenerationResult {
  options: DecisionOption[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// 主引擎
// ---------------------------------------------------------------------------

export class ThreePlusOneEngine {
  constructor(
    private readonly router: TandemRouter,
    private readonly retriever: MemoryRetriever
  ) {}

  /**
   * 生成 3+1 选项 (A/B/C 由 AI, D 留空, 必须人填)
   *
   * 注意: D 选项必须由员工事后填写, 引擎仅占位.
   *
   * §T15 baseline-guard: 入口先校验组织记忆基线.
   *   - HARD_BLOCK: 返回 4 个阻断占位选项 + emit workflow event 通知治理委员会
   *   - SOFT_WARN:  把 baselineContext 注入 buildOptionB 的 system prompt
   *   - PASS:       继续
   */
  async generateOptions(ctx: DecisionContext): Promise<OptionGenerationResult> {
    const warnings: string[] = [];

    // §T15 baseline-guard 议事决策前的组织记忆基线校验
    let baselineContext = '';
    if (ctx.actorUserId) {
      try {
        const { checkBaseline } = await import('../memory/baseline-guard');
        const guard = await checkBaseline({
          intent: `${ctx.scenario ?? 'convergence'}: ${ctx.title}. ${ctx.description}`,
          actorUserId: ctx.actorUserId,
          agentKind: 'autonomous',
          toolName: `decision-layer.${ctx.scenario ?? 'convergence'}`,
        });

        if (guard.verdict === 'HARD_BLOCK') {
          warnings.push(
            `🚫 组织记忆基线阻断: ${guard.reasons.join('; ')}`
          );
          // 通知治理委员会 (workflow engine 事件; 走 workflow.custom 透传 custom subtype)
          try {
            const { emit } = await import('../workflows/engine');
            await emit({
              type: 'workflow.custom',
              payload: {
                customType: 'decision_layer.baseline.blocked',
                cardId: ctx.cardId,
                scenario: ctx.scenario ?? 'convergence',
                actorUserId: ctx.actorUserId,
                title: ctx.title,
                reason: guard.reasons.join('; '),
                hits: guard.hits.slice(0, 5).map((h) => ({
                  memoryId: h.memoryId,
                  title: h.title,
                  ownershipLevel: h.ownershipLevel,
                })),
                checkId: guard.checkId,
              },
            });
          } catch {
            /* workflow 失败不阻塞决策流程, 已有 baseline-guard 自己的 audit */
          }
          // 返回 4 个阻断占位; D 选项保留人工原创路径作为合规出口
          const hitTitles = guard.hits.slice(0, 3).map((h) => h.title).join(', ') || '未指明';
          return {
            options: [
              {
                id: 'A',
                type: 'SOP',
                description: '🚫 决策被组织记忆基线阻断, 需人工评估后重新发起',
                confidence: 0,
                risk: 'high',
              },
              {
                id: 'B',
                type: 'AGENT_REASONING',
                description: `🚫 命中组织记忆: ${hitTitles}`,
                reasoning: guard.reasons.join('\n'),
                confidence: 0,
                risk: 'high',
              },
              {
                id: 'C',
                type: 'HISTORICAL',
                description: '🚫 决策被阻断, 不生成历史参考',
                confidence: 0,
                risk: 'high',
              },
              {
                id: 'D',
                type: 'ORIGINAL',
                description: '[ 等待员工填写原创方案, 需说明如何与组织记忆基线不冲突 ]',
                confidence: 0,
                risk: 'medium',
                humanOnly: true,
                novelInsight: '',
              },
            ],
            warnings,
          };
        }

        if (guard.verdict === 'SOFT_WARN' && guard.contextToInject) {
          baselineContext = guard.contextToInject;
          warnings.push(
            `已注入 ${guard.hits.length} 条组织记忆作为决策基线 (checkId: ${guard.checkId})`
          );
        }
      } catch (err) {
        // baseline-guard 失败不阻塞议事 (fail-open), 但记 warning
        warnings.push(`baseline-guard 调用失败 (fail-open): ${(err as Error).message}`);
      }
    } else {
      warnings.push('未提供 actorUserId, 跳过 baseline-guard 校验 (建议调用方补全)');
    }

    // B-027 价值观锚 · 防漂移层. 有 actorUserId 时硬前置员工的不可妥协原则,
    // 优先级高于组织记忆基线 (compose-prompt 约定: constitution 先于底座).
    let constitutionSegment = '';
    if (ctx.actorUserId) {
      try {
        const { loadActiveRules, getConstitutionPromptSegment } = await import('../persona/constitution');
        const rules = await loadActiveRules(ctx.actorUserId);
        constitutionSegment = getConstitutionPromptSegment(rules);
        if (constitutionSegment) {
          warnings.push(`已硬前置 ${rules.length} 条价值观锚 (B-027 防漂移)`);
        }
      } catch (err) {
        // 价值观锚加载失败不阻塞决策 (fail-soft)
        warnings.push(`价值观锚加载失败 (fail-soft): ${(err as Error).message}`);
      }
    }

    // OKR 锚注入 (OKR-driven 第一性原理): 让 Option B 始终知道公司在追什么 OKR.
    let okrContext = '';
    try {
      const { buildOkrAnchorContext } = await import('../persona/company-brain');
      okrContext = await buildOkrAnchorContext();
    } catch (err) {
      warnings.push(`OKR 锚注入失败 (fail-soft): ${(err as Error).message}`);
    }

    const [sopResults, caseResults] = await Promise.all([
      this.retriever.findRelatedSOP(ctx.description, 3),
      this.retriever.findHistoricalCases(ctx.description, 3),
    ]);

    // A: SOP-based
    const optionA = await this.buildOptionA(ctx, sopResults, warnings);
    // B: LLM reasoning (硬前置价值观锚 → 组织记忆基线 → 推理底座)
    const optionB = await this.buildOptionB(ctx, sopResults, caseResults, warnings, baselineContext, constitutionSegment, okrContext);
    // C: Historical
    const optionC = await this.buildOptionC(ctx, caseResults, warnings);
    // D: 员工原创占位 (humanOnly=true)
    const optionD: DecisionOption = {
      id: 'D',
      type: 'ORIGINAL',
      description: '[ 等待员工填写原创方案 ]',
      confidence: 0,
      risk: 'medium',
      humanOnly: true,
      novelInsight: '',
    };

    return {
      options: [optionA, optionB, optionC, optionD],
      warnings,
    };
  }

  // ---------------------------------------------------------------------------
  // 内部 - 各选项生成
  // ---------------------------------------------------------------------------

  private async buildOptionA(
    ctx: DecisionContext,
    sops: MemorySearchResult[],
    warnings: string[]
  ): Promise<DecisionOption> {
    if (sops.length === 0) {
      warnings.push('A 选项: 未找到相关 SOP, 退化为 LLM 推演');
      return {
        id: 'A',
        type: 'SOP',
        description: '当前场景未有匹配的 SOP, 建议参考选项 B/C 或新增 SOP',
        confidence: 0.3,
        risk: 'medium',
      };
    }

    const top = sops[0];
    return {
      id: 'A',
      type: 'SOP',
      description: `按 SOP《${top.title}》执行`,
      reasoning: top.body.slice(0, 500),
      confidence: top.similarity,
      risk: top.similarity > 0.8 ? 'low' : 'medium',
      citedMemory: [top.id],
    };
  }

  private async buildOptionB(
    ctx: DecisionContext,
    sops: MemorySearchResult[],
    cases: MemorySearchResult[],
    warnings: string[],
    baselineContext = '',
    constitutionSegment = '',
    okrContext = ''
  ): Promise<DecisionOption> {
    const sopHints = sops.map((s) => `- SOP《${s.title}》: ${s.body.slice(0, 200)}`).join('\n');
    const caseHints = cases.map((c) => `- 案例《${c.title}》: ${c.body.slice(0, 200)}`).join('\n');

    const baseInstruction = baselineContext
      ? `${baselineContext}\n\n---\n\n你是 Tandem 的推理 Agent. 任务: 基于上下文给出第二种执行方案 (Option B), 区别于 SOP 直执行.
规则:
- 输出 JSON: {description, reasoning, confidence (0-1), risk (low|medium|high), timelineDays}
- 不要复述 SOP, 给出更优 / 更灵活的方案
- 必须基于事实, 引用 SOP/案例支持
- 必须遵守上方的组织记忆基线, 若方案需偏离需在 reasoning 中明确说明`
      : `你是 Tandem 的推理 Agent. 任务: 基于上下文给出第二种执行方案 (Option B), 区别于 SOP 直执行.
规则:
- 输出 JSON: {description, reasoning, confidence (0-1), risk (low|medium|high), timelineDays}
- 不要复述 SOP, 给出更优 / 更灵活的方案
- 必须基于事实, 引用 SOP/案例支持`;

    // B-027 价值观锚硬前置在最前 (优先级高于组织记忆基线 + 推理底座)
    const systemContent = constitutionSegment
      ? `${constitutionSegment}\n\n---\n\n${baseInstruction}`
      : baseInstruction;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemContent,
      },
      {
        role: 'user',
        content: `决议: ${ctx.title}
描述: ${ctx.description}
${ctx.relatedKrTitles ? `关联 KR: ${ctx.relatedKrTitles.join(', ')}` : ''}
${okrContext ? `\n【当前公司 OKR 锐·你的方案应回答服务哪个 KR】\n${okrContext}\n` : ''}
可参考 SOP:
${sopHints || '(无)'}

可参考历史案例:
${caseHints || '(无)'}

请给出 Option B (LLM 推演方案).`,
      },
    ];

    try {
      const res = await this.router.chat({
        messages,
        scenario: 'reasoning_complex',
        // §B-004 · 严格 schema 输出, 消灭 JSON.parse 失败 + 字段缺失
        responseFormat: {
          type: 'json_schema',
          name: 'three_plus_one_option_b',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['description', 'reasoning', 'confidence', 'risk', 'timelineDays'],
            properties: {
              description: { type: 'string' },
              reasoning: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              risk: { type: 'string', enum: ['low', 'medium', 'high'] },
              timelineDays: { type: 'number', minimum: 1, maximum: 365 },
            },
          },
        },
        temperature: 0.7,
      });
      const parsed = JSON.parse(
        typeof res.message.content === 'string' ? res.message.content : '{}'
      );
      return {
        id: 'B',
        type: 'AGENT_REASONING',
        description: parsed.description ?? '(LLM 未返回 description)',
        reasoning: parsed.reasoning,
        confidence: clamp(Number(parsed.confidence) || 0.5, 0, 1),
        risk: ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'medium',
        timelineDays: parsed.timelineDays,
        citedMemory: [...sops.map((s) => s.id), ...cases.map((c) => c.id)],
      };
    } catch (err) {
      warnings.push(`B 选项 LLM 失败: ${(err as Error).message}`);
      return {
        id: 'B',
        type: 'AGENT_REASONING',
        description: '(LLM 暂不可用, 请稍后重试)',
        confidence: 0,
        risk: 'high',
      };
    }
  }

  private async buildOptionC(
    ctx: DecisionContext,
    cases: MemorySearchResult[],
    warnings: string[]
  ): Promise<DecisionOption> {
    if (cases.length === 0) {
      warnings.push('C 选项: 未找到相关历史案例');
      return {
        id: 'C',
        type: 'HISTORICAL',
        description: '当前场景无相似历史案例可参考',
        confidence: 0,
        risk: 'medium',
      };
    }

    const top = cases[0];
    return {
      id: 'C',
      type: 'HISTORICAL',
      description: `参考历史案例《${top.title}》的做法`,
      reasoning: top.body.slice(0, 500),
      confidence: top.similarity,
      risk: top.similarity > 0.7 ? 'low' : 'medium',
      citedMemory: [top.id],
    };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// 测试用 stub retriever (开发期)
// ---------------------------------------------------------------------------

export class StubMemoryRetriever implements MemoryRetriever {
  async findRelatedSOP(query: string, limit: number): Promise<MemorySearchResult[]> {
    return [
      {
        id: 'stub-sop-1',
        title: '紧急客户投诉 SOP',
        body: '1. 1 小时内电话回访\n2. 24h 内提供书面方案\n3. 结案后录入案例库',
        similarity: 0.75,
      },
    ].slice(0, limit);
  }

  async findHistoricalCases(query: string, limit: number): Promise<MemorySearchResult[]> {
    return [
      {
        id: 'stub-case-1',
        title: '2025-Q3 类似客户投诉处理案例',
        body: '当时采用了快速降价 + 主管亲自上门的组合方案, 7 天内挽回客户.',
        similarity: 0.68,
      },
    ].slice(0, limit);
  }
}
