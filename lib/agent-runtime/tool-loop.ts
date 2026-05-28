/**
 * §CA-6/CA-7 · Tool Calling Loop · LLM 真正能"调工具"的桥
 *
 * 器官 #13 · 执行肢体
 *
 * 设计:
 *   - 不同于 multi-step.ts 用 JSON in prompt 模拟工具, 本文件走 LLM 原生 function calling
 *     (TAF Provider 层已支持: ChatRequest.tools / ChatResponse.toolCalls)
 *   - 循环: LLM → toolCalls? → skillRegistry.execute → 把 result 作为 'tool' role 喂回 → LLM
 *   - 收敛: LLM 不再 toolCalls, 给最终 assistant message
 *
 * V1 实现 (本文件):
 *   - 单线程顺序工具执行 (不并行); 复杂场景 LLM 自己拆步
 *   - 工具白名单 = skillRegistry 内的子集
 *   - 安全: 走 skillRegistry.execute() 的 5 道守门 (governance / 红区 / 预算 / 审计 / 错误兜底)
 *   - maxRounds 默认 5
 *
 * V2 计划: 加并行工具调用 + 流式输出 + tool_choice 强制策略
 *
 * 用法:
 *   const result = await runToolLoop({
 *     systemPrompt: 'You are CompanyBrain...',
 *     userQuery: '本季度的 OKR 进度怎么样?',
 *     toolset: ['okr.read', 'memory.search'],
 *     actorUserId: 'u1',
 *   });
 *   result.finalMessage; // assistant 最终回复
 *   result.toolInvocations; // [{name, args, result}]
 */

import type { ChatMessage, ScenarioTag, ToolSchema } from '@/lib/taf/provider/types';
import { logger } from '@/lib/infra/logger';

export interface ToolInvocationRecord {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  /** 工具执行结果的 JSON 序列 (truncated) */
  result: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export interface ToolLoopInput {
  systemPrompt: string;
  userQuery: string;
  /** 允许调用的 skill id 白名单 */
  toolset: string[];
  scenario?: ScenarioTag;
  actorUserId: string;
  isProxy?: boolean;
  tenantId?: string;
  /** 最大轮次, 默认 5; 超过则强制收敛 (返回此时 LLM 最后输出, 即使含未执行 toolCalls) */
  maxRounds?: number;
  /** 单轮 maxTokens, 默认 800 */
  maxTokens?: number;
  /** ai trace id, 写入 metadata 关联 LlmUsageLog */
  aiTraceId?: string;
}

export interface ToolLoopResult {
  finalMessage: string;
  roundsExecuted: number;
  finishedNaturally: boolean;
  toolInvocations: ToolInvocationRecord[];
  totalTokensUsed: number;
  totalLatencyMs: number;
}

const DEFAULT_MAX_ROUNDS = 5;

export async function runToolLoop(input: ToolLoopInput): Promise<ToolLoopResult> {
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const maxTokens = input.maxTokens ?? 800;
  const toolInvocations: ToolInvocationRecord[] = [];
  let totalTokensUsed = 0;
  let totalLatencyMs = 0;
  let finalMessage = '';
  let finishedNaturally = false;
  let roundsExecuted = 0;

  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const { skillRegistry } = await import('@/lib/taf/skills/registry');

    // 1. 拼工具 schemas (从白名单 skill 取)
    const tools: ToolSchema[] = input.toolset
      .map((id) => skillRegistry.get(id)?.schema)
      .filter((s): s is ToolSchema => Boolean(s));

    if (tools.length === 0) {
      logger.warn(
        { toolset: input.toolset },
        '[tool-loop] no valid tool schemas in toolset, falling back to plain chat',
      );
    }

    // 2. 初始消息
    const messages: ChatMessage[] = [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userQuery },
    ];

    for (let round = 1; round <= maxRounds; round++) {
      roundsExecuted = round;
      const roundStart = Date.now();

      const reply = await router.chat({
        messages,
        scenario: (input.scenario ?? 'tool_use') as ScenarioTag,
        tools: tools.length > 0 ? tools : undefined,
        toolChoice: tools.length > 0 ? 'auto' : undefined,
        maxTokens,
        metadata: {
          userId: input.actorUserId,
        },
      });

      const roundLatency = Date.now() - roundStart;
      totalLatencyMs += roundLatency;
      totalTokensUsed += reply.usage?.totalTokens ?? 0;

      const assistantMsg = reply.message;
      const content = typeof assistantMsg.content === 'string' ? assistantMsg.content : '';
      const toolCalls = assistantMsg.toolCalls;

      // 把 assistant message 加入历史 (tool_calls 也跟着)
      messages.push({
        role: 'assistant',
        content,
        ...(toolCalls ? { toolCalls } : {}),
      });

      // 没工具调用 → LLM 已收敛
      if (!toolCalls || toolCalls.length === 0) {
        finalMessage = content;
        finishedNaturally = true;
        break;
      }

      // 顺序执行每个 tool_call, 把 result 喂回 messages (role='tool')
      for (const tc of toolCalls) {
        const skillId = tc.function.name;
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = tc.function.arguments
            ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
            : {};
        } catch {
          parsedArgs = {};
        }

        const invStart = Date.now();
        let invocation: ToolInvocationRecord;

        if (!input.toolset.includes(skillId)) {
          // 安全: LLM 调了不在白名单的工具
          invocation = {
            toolCallId: tc.id,
            name: skillId,
            args: parsedArgs,
            result: `[ERROR] tool "${skillId}" not in allowed toolset`,
            ok: false,
            error: 'tool_not_allowed',
            latencyMs: Date.now() - invStart,
          };
        } else {
          const skillResult = await skillRegistry.execute(skillId, parsedArgs, {
            userId: input.actorUserId,
            isProxy: input.isProxy ?? false,
            tenantId: input.tenantId ?? 'default',
          });
          invocation = {
            toolCallId: tc.id,
            name: skillId,
            args: parsedArgs,
            result: skillResult.ok
              ? truncate(JSON.stringify(skillResult.data ?? null), 1500)
              : `[ERROR] ${skillResult.error}`,
            ok: skillResult.ok,
            error: skillResult.error,
            latencyMs: Date.now() - invStart,
          };
        }

        toolInvocations.push(invocation);

        // 把 tool result 加进消息历史 (OpenAI 兼容 role='tool')
        messages.push({
          role: 'tool',
          content: invocation.result,
          toolCallId: tc.id,
        });
      }

      // 进入下一轮, 让 LLM 看 tool result 决定下一步
    }

    if (!finishedNaturally && !finalMessage) {
      finalMessage =
        '(达到 maxRounds 仍未收敛 tool 循环. 最后一轮 LLM 仍想调工具, 已强制中止.)';
    }

    return {
      finalMessage,
      roundsExecuted,
      finishedNaturally,
      toolInvocations,
      totalTokensUsed,
      totalLatencyMs,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[tool-loop] runToolLoop failed');
    return {
      finalMessage: `[ERROR] tool-loop runtime 异常: ${(err as Error).message}`,
      roundsExecuted,
      finishedNaturally: false,
      toolInvocations,
      totalTokensUsed,
      totalLatencyMs,
    };
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}...(truncated)` : s;
}
