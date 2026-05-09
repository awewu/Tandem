/**
 * Agent Spawning · 子 Agent 派生
 *
 * 对应 CircleBot 的 agent_spawn:
 *   - fork:  继承父 Agent 上下文 (用于跨文件分析 / 复杂调研)
 *   - fresh: 全新启动 (用于独立验证 / 减少污染)
 *
 * 关键原则 (与 CircleBot 一致):
 *   除非真正需要, 否则不轻易 spawn -- 直接调用 skill 通常更高效.
 */

import type { ChatMessage, ScenarioTag } from '../provider/types';
import { TandemRouter } from '../router';
import { skillRegistry } from '../skills';
import type { SkillContext } from '../skills/registry';

export type AgentMode = 'fork' | 'fresh' | 'parallel';

export interface SpawnInput {
  /** 父 Agent 上下文 (fork 模式继承) */
  parentMessages?: ChatMessage[];
  /** 任务描述 */
  task: string;
  /** 模式 */
  mode: AgentMode;
  /** 用于路由器选择模型 */
  scenario?: ScenarioTag;
  /** 可用工具白名单 (子 Agent 通常受限) */
  allowedSkillIds?: string[];
  /** 上下文 (用户身份等) */
  ctx: SkillContext;
  /** Token 预算 */
  budget?: number;
  /** 最大循环步数 (防失控) */
  maxSteps?: number;
}

export interface AgentResult {
  agentId: string;
  finalMessage: string;
  toolCallsExecuted: { skillId: string; ok: boolean }[];
  tokensUsed: number;
  steps: number;
  reason: 'finished' | 'budget_exhausted' | 'max_steps' | 'error';
  error?: string;
}

const activeAgents = new Map<string, Promise<AgentResult>>();

/**
 * 同步启动子 Agent (阻塞直到完成)
 */
export async function spawnAgent(router: TandemRouter, input: SpawnInput): Promise<AgentResult> {
  const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const messages = buildInitialMessages(input);
  const tools = skillRegistry.toolSchemas(input.allowedSkillIds);

  const maxSteps = input.maxSteps ?? 8;
  let budget = input.budget ?? 20_000;
  let stepCount = 0;
  const toolCalls: AgentResult['toolCallsExecuted'] = [];
  let reason: AgentResult['reason'] = 'finished';
  let lastText = '';
  let totalTokens = 0;

  try {
    while (stepCount < maxSteps) {
      stepCount++;
      const res = await router.chat({
        messages,
        tools: tools.length > 0 ? tools : undefined,
        toolChoice: 'auto',
        scenario: input.scenario ?? 'agentic',
        temperature: 0.5,
      });

      totalTokens += res.usage.totalTokens;
      budget -= res.usage.totalTokens;
      if (budget <= 0) {
        reason = 'budget_exhausted';
        break;
      }

      const msg = res.message;
      messages.push(msg);
      lastText = typeof msg.content === 'string' ? msg.content : lastText;

      // 没有 tool call → 完成
      if (!msg.toolCalls || msg.toolCalls.length === 0) {
        reason = 'finished';
        break;
      }

      // 并发执行所有 tool calls (CircleBot 性能优化点)
      const calls = msg.toolCalls;
      const results = await Promise.all(
        calls.map(async (tc) => {
          let args: unknown = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            /* malformed args */
          }
          const skillId = tc.function.name.replace(/_/g, '.');
          const result = await skillRegistry.execute(skillId, args, {
            ...input.ctx,
            remainingBudget: budget,
          });
          toolCalls.push({ skillId, ok: result.ok });
          totalTokens += result.tokensUsed ?? 100;
          budget -= result.tokensUsed ?? 100;
          return { tc, result };
        })
      );

      // 把 tool 结果回写到 messages (供下一轮 LLM 参考)
      for (const { tc, result } of results) {
        messages.push({
          role: 'tool',
          toolCallId: tc.id,
          content: JSON.stringify(result),
        });
      }

      if (budget <= 0) {
        reason = 'budget_exhausted';
        break;
      }
    }

    if (stepCount >= maxSteps) {
      reason = 'max_steps';
    }

    return {
      agentId,
      finalMessage: lastText,
      toolCallsExecuted: toolCalls,
      tokensUsed: totalTokens,
      steps: stepCount,
      reason,
    };
  } catch (err) {
    return {
      agentId,
      finalMessage: lastText,
      toolCallsExecuted: toolCalls,
      tokensUsed: totalTokens,
      steps: stepCount,
      reason: 'error',
      error: (err as Error).message,
    };
  }
}

/**
 * 异步启动 (后台运行) + agent_wait
 */
export function spawnAgentAsync(router: TandemRouter, input: SpawnInput): { agentId: string } {
  const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  activeAgents.set(agentId, spawnAgent(router, input));
  return { agentId };
}

export async function waitAgent(agentId: string, timeoutMs = 60_000): Promise<AgentResult | null> {
  const promise = activeAgents.get(agentId);
  if (!promise) return null;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const result = await Promise.race([promise, timeout]);
  if (result) {
    activeAgents.delete(agentId);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

function buildInitialMessages(input: SpawnInput): ChatMessage[] {
  const sys: ChatMessage = {
    role: 'system',
    content: `你是 Tandem 子 Agent. 任务: ${input.task}

规则:
- 优先调用工具获取真实数据, 不要编造
- 完成任务后用一句话总结, 不要继续 tool call
- 严格遵守 zone 权限 (红区禁止 AI 代行)`,
  };

  if (input.mode === 'fork' && input.parentMessages && input.parentMessages.length > 0) {
    return [sys, ...input.parentMessages.slice(-10), { role: 'user', content: input.task }];
  }
  return [sys, { role: 'user', content: input.task }];
}
