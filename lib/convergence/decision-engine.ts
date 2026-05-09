/**
 * 3+1 Decision Engine · 决策选项生成器
 *
 * 对应 MANIFESTO 第八/九条 (3+1 框架, D 选项强制员工原创)
 * 对应 AGENT-FRAMEWORK Layer 4
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

export interface DecisionContext {
  cardId: string;
  title: string;
  /** 决议描述 / 用户输入 */
  description: string;
  /** 关联的 KR 标题 (用于 LLM 上下文) */
  relatedKrTitles?: string[];
  /** 决议涉及的材料原文 (摘要) */
  materialDigests?: string[];
}

export interface OptionGenerationResult {
  options: DecisionOption[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// 主引擎
// ---------------------------------------------------------------------------

export class DecisionEngine {
  constructor(
    private readonly router: TandemRouter,
    private readonly retriever: MemoryRetriever
  ) {}

  /**
   * 生成 3+1 选项 (A/B/C 由 AI, D 留空, 必须人填)
   *
   * 注意: D 选项必须由员工事后填写, 引擎仅占位.
   */
  async generateOptions(ctx: DecisionContext): Promise<OptionGenerationResult> {
    const warnings: string[] = [];

    const [sopResults, caseResults] = await Promise.all([
      this.retriever.findRelatedSOP(ctx.description, 3),
      this.retriever.findHistoricalCases(ctx.description, 3),
    ]);

    // A: SOP-based
    const optionA = await this.buildOptionA(ctx, sopResults, warnings);
    // B: LLM reasoning
    const optionB = await this.buildOptionB(ctx, sopResults, caseResults, warnings);
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
    warnings: string[]
  ): Promise<DecisionOption> {
    const sopHints = sops.map((s) => `- SOP《${s.title}》: ${s.body.slice(0, 200)}`).join('\n');
    const caseHints = cases.map((c) => `- 案例《${c.title}》: ${c.body.slice(0, 200)}`).join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是 Tandem 议事室的推理 Agent. 任务: 基于上下文给出第二种执行方案 (Option B), 区别于 SOP 直执行.
规则:
- 输出 JSON: {description, reasoning, confidence (0-1), risk (low|medium|high), timelineDays}
- 不要复述 SOP, 给出更优 / 更灵活的方案
- 必须基于事实, 引用 SOP/案例支持`,
      },
      {
        role: 'user',
        content: `决议: ${ctx.title}
描述: ${ctx.description}
${ctx.relatedKrTitles ? `关联 KR: ${ctx.relatedKrTitles.join(', ')}` : ''}

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
        responseFormat: 'json',
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
