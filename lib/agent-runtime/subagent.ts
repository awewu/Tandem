/**
 * Subagent · 子代理隔离上下文执行
 *
 * §2026-05-29 Owner 决议补完 (Anthropic Claude Agent SDK 2026 最佳实践):
 *   "Subagents 用于两个场景:
 *    1. 并行: 多个子任务可同时跑
 *    2. 上下文隔离: 子任务独立 context window, 只把摘要回主 agent.
 *       适用于搜索大量信息但绝大部分用不上的场景 (议事 / 1on1 / 学院)."
 *
 * 用法:
 *   const summary = await spawnSubagent({
 *     task: '查这位同事过去 3 个月所有议事中的提案, 提炼他擅长什么',
 *     parentSystemHint: '主任务: 给他写 1on1 brief',
 *     isolatedToolset: ['memory.search', 'convergence.list'],
 *     maxSteps: 5,
 *   });
 *   // summary 只是 1-2 段摘要, 不污染主 agent 的上下文
 *
 * 并行使用:
 *   const [a, b, c] = await Promise.all([
 *     spawnSubagent({ task: '查 A', ... }),
 *     spawnSubagent({ task: '查 B', ... }),
 *     spawnSubagent({ task: '查 C', ... }),
 *   ]);
 *
 * 永不抛错: 失败时 summary = "(子任务失败: <reason>)"
 */

import type { ScenarioTag } from '@/lib/taf/provider/types';
import { runMultiStep, type AgentStepTrace } from './multi-step';
import { logger } from '@/lib/infra/logger';

export interface SubagentInput {
  /** 子任务描述 (subagent 拿到的"用户提问") */
  task: string;
  /** 父任务 hint (注入 system, 帮 subagent 知道大任务是什么) */
  parentSystemHint?: string;
  /** 子任务允许的 toolset (隔离 — 比父小) */
  isolatedToolset?: string[];
  /** 最大步数 (默认 4, 子任务该简洁) */
  maxSteps?: number;
  /** scenario (默认 agentic) */
  scenario?: ScenarioTag;
  /** 调用方 userId */
  actorUserId: string;
  /** isProxy */
  isProxy?: boolean;
  /** tenantId */
  tenantId?: string;
  /** aiTraceId (跟父链关联) */
  parentAiTraceId?: string;
}

export interface SubagentResult {
  /** 子代理给主代理的摘要 (主代理只看这个, 不看 trace) */
  summary: string;
  /** 是否成功 */
  ok: boolean;
  /** 错误 (失败时) */
  error?: string;
  /** 内部 trace (debug / audit 用, 不返父 context) */
  trace: AgentStepTrace[];
  /** 用了多少 token */
  tokensUsed: number;
  /** 耗时 */
  latencyMs: number;
}

const DEFAULT_SUBAGENT_MAX_STEPS = 4;

/**
 * spawn 一个子代理. 独立 context, 只回摘要.
 */
export async function spawnSubagent(input: SubagentInput): Promise<SubagentResult> {
  const startedAt = Date.now();
  try {
    const systemPrompt = buildSubagentSystemPrompt(input);

    const r = await runMultiStep({
      systemPrompt,
      userQuery: input.task,
      toolset: input.isolatedToolset ?? [],
      maxSteps: input.maxSteps ?? DEFAULT_SUBAGENT_MAX_STEPS,
      actorUserId: input.actorUserId,
      isProxy: input.isProxy,
      tenantId: input.tenantId,
      aiTraceId: input.parentAiTraceId ? `${input.parentAiTraceId}:sub` : undefined,
      scenario: input.scenario ?? 'agentic',
      // subagent 默认走 prompt 模式 (兼容性强); 若 toolset 大可显式 native
      mode: 'prompt',
    });

    return {
      summary: extractSummary(r.finalAnswer),
      ok: true,
      trace: r.trace,
      tokensUsed: r.totalTokensUsed,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    const msg = (err as Error).message;
    logger.warn({ err: msg, task: input.task.slice(0, 60) }, '[subagent] spawn 失败');
    return {
      summary: `(子任务失败: ${msg})`,
      ok: false,
      error: msg,
      trace: [],
      tokensUsed: 0,
      latencyMs: Date.now() - startedAt,
    };
  }
}

/**
 * 并行 spawn 多个 subagent. 任何一个失败不影响其他.
 * 返回顺序跟输入顺序一致.
 */
export async function spawnSubagentsParallel(
  inputs: SubagentInput[],
): Promise<SubagentResult[]> {
  return Promise.all(inputs.map((i) => spawnSubagent(i)));
}

// ──────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────
function buildSubagentSystemPrompt(input: SubagentInput): string {
  const lines: string[] = [
    '你是一个子代理 (subagent). 主代理派你完成一个子任务后, 只会读你最终给的摘要.',
    '',
    '【输出原则】',
    '- 摘要 ≤ 300 字',
    '- 列要点, 不要寒暄',
    '- 列举具体事实 / ID / 数字 / 链接, 不要泛泛而谈',
    '- 如果有不确定信息, 用 [?] 标注, 让主代理决定要不要再问',
  ];
  if (input.parentSystemHint) {
    lines.push('', '【父任务背景】', input.parentSystemHint);
  }
  if (input.isolatedToolset && input.isolatedToolset.length > 0) {
    lines.push(
      '',
      '【你的工具范围】 (主代理给你的隔离 toolset, 不要尝试其他工具)',
      input.isolatedToolset.map((id) => `  - ${id}`).join('\n'),
    );
  }
  return lines.join('\n');
}

/**
 * 子代理最终 finalAnswer 可能含 "{thought:..., finalAnswer:...}" JSON 残留.
 * 提取纯文本摘要.
 */
function extractSummary(finalAnswer: string): string {
  if (!finalAnswer) return '(空摘要)';
  // 截断超长
  return finalAnswer.length > 1500 ? `${finalAnswer.slice(0, 1500)}...(截断)` : finalAnswer;
}
