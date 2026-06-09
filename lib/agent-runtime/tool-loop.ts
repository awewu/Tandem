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
  /** true = 本轮已用相同 (skill+args) 调用过, 直接复用缓存结果, 未再执行 */
  cached?: boolean;
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
    //    ⚠️ OpenAI/DeepSeek function-calling 规范要求 name 匹配 ^[a-zA-Z0-9_-]+$,
    //    但 skill id 带点 (e.g. 'okr.health_digest')。若原样下发, 模型会把点
    //    归一化成下划线再回传 (okr_health_digest), 导致白名单/registry 查找全 miss
    //    → 每个 tool_call 被判 tool_not_allowed → 中央AI 永远"瞎"。
    //    故: 下发时 sanitize, 回传时按映射还原回真实 skill id。
    const nameToSkillId = new Map<string, string>();
    const tools: ToolSchema[] = input.toolset
      .map((id) => {
        const schema = skillRegistry.get(id)?.schema;
        if (!schema) return undefined;
        const safeName = sanitizeToolName(id);
        nameToSkillId.set(safeName, id);
        // 克隆, 不要 mutate 共享的 registry schema
        return {
          ...schema,
          function: { ...schema.function, name: safeName },
        } satisfies ToolSchema;
      })
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

    // 同一次 loop 内的工具结果缓存: key = skillId + 稳定序列化 args。
    //   只读工具幂等, 模型常重复调同一查询 (实测 reasoning-pass memory.search 调 4+ 次),
    //   命中缓存则直接复用 + 提示模型勿重复 → 省 DB/省 token + 助收敛。
    const resultCache = new Map<string, ToolInvocationRecord>();

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
        // 模型回传的 name 可能是 sanitize 后的形式 (点→下划线); 还原回真实 skill id
        const skillId = nameToSkillId.get(tc.function.name) ?? tc.function.name;
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
        const cacheKey = `${skillId}:${stableStringify(parsedArgs)}`;

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
        } else if (resultCache.has(cacheKey)) {
          // 同参数重复调用 → 复用缓存, 不再执行, 并提示模型勿重复查询
          const cached = resultCache.get(cacheKey)!;
          invocation = {
            toolCallId: tc.id,
            name: skillId,
            args: parsedArgs,
            result: cached.ok
              ? `${cached.result}\n(注: 本轮已用相同参数调用过 ${skillId}, 上为缓存结果; 请勿重复查询, 据此继续或收敛。)`
              : cached.result,
            ok: cached.ok,
            error: cached.error,
            latencyMs: 0,
            cached: true,
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
          resultCache.set(cacheKey, invocation);
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

/**
 * 稳定序列化 (对象键排序), 让 {a:1,b:2} 与 {b:2,a:1} 产生同一缓存 key。
 * 仅用于工具调用去重, 不追求完整 JSON 语义。
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * 把 skill id 转成 OpenAI/DeepSeek function-calling 规范允许的 name:
 * 仅 [a-zA-Z0-9_-], 其余 (尤其点 '.') 全部转下划线。
 * 例: 'okr.health_digest' → 'okr_health_digest', 'decision_card.list' → 'decision_card_list'。
 */
function sanitizeToolName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}
