/**
 * §CA-5 · Multi-Step ReAct Agent Runtime (V1 骨架)
 *
 * 器官 #12 · 主循环精细化
 *
 * 设计哲学 (CENTRAL-AI-ARCHITECTURE §五):
 *   "不是议事压缩成一个 prompt, 而是把它拆成多个 step, 每 step 独立 subagent,
 *    主议事 agent 只收总结, 不污染上下文 (zero-context-cost)."
 *
 * V1 实现 (本文件): 简化 ReAct 循环, 不依赖 Mastra
 *   - 每个 step 是一次 LLM 调用, 输出 JSON {thought, action, finished}
 *   - action ∈ {tool_call: { name, args } | answer: string | continue}
 *   - 最多 maxSteps 轮 (默认 5), 超过即强制收敛
 *   - 中间 step 不进入最终上下文 (避免 prompt 爆炸); 仅保留 trace 用于 IM-7 popover
 *
 * V2 计划: 接入 Mastra (TS 原生 agent runtime), 替换本文件 runMultiStep 实现
 *
 * 用法:
 *   const result = await runMultiStep({
 *     scenario: 'reasoning_complex',
 *     systemPrompt: '...',
 *     userQuery: '...',
 *     toolset: ['memory.search', 'okr.read'],  // skill ids
 *     maxSteps: 5,
 *   });
 *   result.finalAnswer;  // 最终答复
 *   result.trace;         // [{step, thought, toolCall?, observation?}]
 */

import type { ChatMessage, ScenarioTag } from '@/lib/taf/provider/types';
import type { TandemRouter } from '@/lib/taf';
import { logger } from '@/lib/infra/logger';

/** Multi-step trace entry · 一轮 ReAct 步骤的完整记录 */
export interface AgentStepTrace {
  step: number;
  /** LLM 此步的思考 (chain-of-thought) */
  thought: string;
  /** 此步是否调用了工具 */
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  /** 工具执行返回 (truncated to 1000 chars) */
  observation?: string;
  /** 此步用 tokens (估算) */
  tokensUsed?: number;
  /** 此步耗时 ms */
  latencyMs?: number;
  /** 是否标记为 finished (LLM 主动停) */
  finished: boolean;
  /**
   * 精髓 (Claude Code TodoWrite 式可见性):
   *   pending → in_progress → completed / failed
   *   可逐步推流给前端任务面板; 同一时刻只允许一个 in_progress.
   */
  status: AgentStepStatus;
}

/** pending→in_progress→completed/failed (借鉴 Claude Code TodoWrite 精髓) */
export type AgentStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export interface MultiStepInput {
  /** TAF Router scenario, 默认 reasoning_complex (走 claude-opus-4-5) */
  scenario?: ScenarioTag;
  /** 主任务 system prompt (固定不变, 每步都注入) */
  systemPrompt: string;
  /** 用户最初的查询 */
  userQuery: string;
  /** 允许调用的 skill id 白名单. 留空 = 不允许工具调用 (退化为 chain-of-thought) */
  toolset?: string[];
  /** 最大 step 数, 默认 5 */
  maxSteps?: number;
  /** 调用方 (用于 skill execute ctx + audit) */
  actorUserId: string;
  /** 是否 AI 代行 (传给 skill ctx) */
  isProxy?: boolean;
  /** 租户 */
  tenantId?: string;
  /** ai trace id (跟 IM-7 trace 关联) */
  aiTraceId?: string;
  /**
   * §V2 执行模式:
   *   - 'prompt' (默认, 向后兼容): JSON in prompt 模拟 ReAct, 显式 thought 字段, 兼容 toolset 弱模型
   *   - 'native'                : LLM 原生 function calling (走 runToolLoop), 推荐用于 toolset 非空场景
   * 注: 'native' 模式下 toolset 必须非空, 否则等价 'prompt'.
   */
  mode?: 'prompt' | 'native';
}

export interface MultiStepResult {
  /** 最终答复 (LLM 主动收敛或 maxSteps 后) */
  finalAnswer: string;
  /** 步骤数 (含最终答复那步) */
  stepsExecuted: number;
  /** 是否 LLM 主动 finished (false = maxSteps 强制) */
  finishedNaturally: boolean;
  /** 完整 trace (供 IM-7 popover / audit) */
  trace: AgentStepTrace[];
  /** 累计 token 估算 */
  totalTokensUsed: number;
  /** 累计延迟 */
  totalLatencyMs: number;
}

/** LLM 每步必须输出的 JSON 结构 */
interface StepDecision {
  thought: string;
  /** 二选一: 调工具 or 给最终答案 */
  toolCall?: { name: string; args?: Record<string, unknown> };
  finalAnswer?: string;
  finished?: boolean;
}

const DEFAULT_MAX_STEPS = 5;

/**
 * 运行 multi-step ReAct 循环.
 * 永不抛错, 失败时返回 finishedNaturally=false + finalAnswer 为错误说明.
 */
export async function runMultiStep(input: MultiStepInput): Promise<MultiStepResult> {
  const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;

  // §V2 native function calling 模式: 转发到 runToolLoop, 适配返回结构
  if (input.mode === 'native' && input.toolset && input.toolset.length > 0) {
    try {
      const { runToolLoop } = await import('./tool-loop');
      const r = await runToolLoop({
        systemPrompt: input.systemPrompt,
        userQuery: input.userQuery,
        toolset: input.toolset,
        scenario: input.scenario,
        actorUserId: input.actorUserId,
        isProxy: input.isProxy,
        tenantId: input.tenantId,
        maxRounds: maxSteps,
      });
      // 把 toolInvocations 适配成 AgentStepTrace[]
      const adaptedTrace: AgentStepTrace[] = r.toolInvocations.map((inv, i) => ({
        step: i + 1,
        thought: '(native function calling)',
        toolCall: { name: inv.name, args: inv.args },
        observation: typeof inv.result === 'string' ? inv.result.slice(0, 1000) : JSON.stringify(inv.result).slice(0, 1000),
        latencyMs: inv.latencyMs,
        finished: false,
        status: 'failed',
        status: inv.ok ? 'completed' : 'failed',
      }));
      // 最后一步加 final answer
      adaptedTrace.push({
        step: adaptedTrace.length + 1,
        thought: '(native: final assistant message)',
        finished: r.finishedNaturally,
        status: r.finishedNaturally ? 'completed' : 'failed',
        status: r.finishedNaturally ? 'completed' : 'failed',
      });
      return {
        finalAnswer: r.finalMessage,
        stepsExecuted: r.roundsExecuted,
        finishedNaturally: r.finishedNaturally,
        trace: adaptedTrace,
        totalTokensUsed: r.totalTokensUsed,
        totalLatencyMs: r.totalLatencyMs,
      };
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        '[multi-step] native mode failed, fallback to prompt mode',
      );
      // 落入下面的 prompt-based 路径
    }
  }

  const trace: AgentStepTrace[] = [];
  let totalTokensUsed = 0;
  let totalLatencyMs = 0;
  let finalAnswer = '';
  let finishedNaturally = false;

  try {
    const { getRouter } = await import('@/lib/boot');
    const router: TandemRouter = getRouter();
    const { skillRegistry } = await import('@/lib/taf/skills/registry');

    // 准备工具描述 (供 LLM 知道能调啥). V1 用文字描述; V2 用 native function calling.
    const toolDescriptions =
      input.toolset && input.toolset.length > 0
        ? input.toolset
            .map((id) => skillRegistry.get(id))
            .filter((s): s is NonNullable<typeof s> => Boolean(s))
            .map(
              (s) =>
                `  - ${s.id}: ${s.description} (zone=${s.zone}, args: ${JSON.stringify(s.schema.function.parameters?.properties ?? {})})`,
            )
            .join('\n')
        : '';

    // 累积"已观察"消息 (供后续 step 参考)
    const observations: string[] = [];

    for (let step = 1; step <= maxSteps; step++) {
      const stepStart = Date.now();

      const reactSystem = buildReactSystemPrompt(input.systemPrompt, toolDescriptions, step, maxSteps);
      const reactUser = buildReactUserPrompt(input.userQuery, observations, step);

      const messages: ChatMessage[] = [
        { role: 'system', content: reactSystem },
        { role: 'user', content: reactUser },
      ];

      const reply = await router.chat({
        messages,
        scenario: (input.scenario ?? 'reasoning_complex') as ScenarioTag,
        maxTokens: 800,
        temperature: 0.2, // 降低随机性, 让 ReAct loop 更稳定
        metadata: {
          userId: input.actorUserId,
        },
      });

      const stepLatency = Date.now() - stepStart;
      totalLatencyMs += stepLatency;
      const stepTokens = reply.usage?.totalTokens ?? 0;
      totalTokensUsed += stepTokens;

      const decision = parseStepDecision(
        typeof reply.message.content === 'string' ? reply.message.content : '',
      );
      if (!decision) {
        // 解析失败 → 当作最终答复, 但标记 finished=false
        finalAnswer =
          (typeof reply.message.content === 'string' ? reply.message.content : '') ||
          '(LLM 输出无法解析为 JSON, 已直接返回原文)';
        trace.push({
          step,
          thought: '(parse failed)',
          observation: finalAnswer.slice(0, 1000),
          tokensUsed: stepTokens,
          latencyMs: stepLatency,
          finished: false,
          status: 'failed',
          status: 'failed',
        });
        break;
      }

      // 工具调用分支
      if (decision.toolCall && decision.toolCall.name) {
        const skillId = decision.toolCall.name;
        const args = decision.toolCall.args ?? {};

        // 安全: skill id 必须在 toolset 白名单内
        if (!input.toolset || !input.toolset.includes(skillId)) {
          const observation = `[ERROR] skill "${skillId}" 不在允许的 toolset 内. 允许列表: ${(input.toolset ?? []).join(', ') || '(无)'}`;
          observations.push(`Step ${step} → 工具调用被拒: ${observation}`);
          trace.push({
            step,
            thought: decision.thought,
            toolCall: { name: skillId, args: args as Record<string, unknown> },
            observation,
            tokensUsed: stepTokens,
            latencyMs: stepLatency,
            finished: false,
            status: 'failed',
          });
          continue;
        }

        const skillResult = await skillRegistry.execute(skillId, args, {
          userId: input.actorUserId,
          isProxy: input.isProxy ?? false,
          tenantId: input.tenantId ?? 'default',
        });

        const observation = skillResult.ok
          ? truncate(JSON.stringify(skillResult.data ?? null), 1000)
          : `[ERROR] ${skillResult.error}`;

        observations.push(`Step ${step} → 调 ${skillId}(${JSON.stringify(args)}) → ${observation}`);

        trace.push({
          step,
          thought: decision.thought,
          toolCall: { name: skillId, args: args as Record<string, unknown> },
          observation,
          tokensUsed: stepTokens,
          latencyMs: stepLatency,
          finished: false,
          status: skillResult.ok ? 'completed' : 'failed',
          status: skillResult.ok ? 'completed' : 'failed',
        });
        continue; // 进入下一轮, 让 LLM 看 observation 决定下一步
      }

      // 最终答复分支
      if (decision.finalAnswer || decision.finished) {
        finalAnswer = decision.finalAnswer ?? '(LLM 标记 finished 但未给 finalAnswer)';
        finishedNaturally = true;
        trace.push({
          step,
          thought: decision.thought,
          tokensUsed: stepTokens,
          latencyMs: stepLatency,
          finished: true,
          status: 'completed',
          status: 'completed',
        });
        break;
      }

      // LLM 给了 thought 但没决定动作 → 算无效一步, 强制下一轮 / 保护 maxSteps
      trace.push({
        step,
        thought: decision.thought,
        observation: '(no action chosen, looping)',
        tokensUsed: stepTokens,
        latencyMs: stepLatency,
        finished: false,
        status: 'failed',
      });
    }

    // maxSteps 强制收敛: 没主动 finish 时给个降级答复
    if (!finishedNaturally && !finalAnswer) {
      finalAnswer = '(达到 maxSteps 仍未收敛, 已强制中止. 建议简化议题或拆分为子议事.)';
    }

    return {
      finalAnswer,
      stepsExecuted: trace.length,
      finishedNaturally,
      trace,
      totalTokensUsed,
      totalLatencyMs,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[multi-step] runMultiStep failed');
    return {
      finalAnswer: `[ERROR] multi-step runtime 异常: ${(err as Error).message}`,
      stepsExecuted: trace.length,
      finishedNaturally: false,
      trace,
      totalTokensUsed,
      totalLatencyMs,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildReactSystemPrompt(
  taskSystem: string,
  toolDescriptions: string,
  step: number,
  maxSteps: number,
): string {
  const lines = [
    taskSystem,
    '',
    '【ReAct 多步推理协议】',
    `当前是第 ${step}/${maxSteps} 步. 你必须严格输出 JSON, 含字段:`,
    '  - thought: string (你这一步的思考 / 观察)',
    '  - toolCall?: { name, args } (要调用的工具; 没工具就不写)',
    '  - finalAnswer?: string (最终答复; 仅当你判断够信息时填)',
    '  - finished?: boolean (true = 你认为推理完成)',
    '',
    'finalAnswer 和 toolCall 二选一. 不要同时填.',
    '',
  ];

  if (toolDescriptions) {
    lines.push('【可用工具】');
    lines.push(toolDescriptions);
    lines.push('');
    lines.push('调用工具示例: { "thought": "我需要查询 OKR", "toolCall": { "name": "okr.read", "args": { "ownerId": "u1" } } }');
  } else {
    lines.push('【无可用工具】');
    lines.push('你只能基于已有上下文推理, 不能调用工具. 请直接给 finalAnswer.');
  }

  lines.push('');
  lines.push('给最终答案示例: { "thought": "信息已足够", "finalAnswer": "...", "finished": true }');
  lines.push('');
  lines.push('严禁输出 JSON 之外的任何文本. 不要 markdown code fence.');
  lines.push('');
  // 精髓 2 (Claude Code TodoWrite): 先声明再执行, 完成立即确认, 不批量
  lines.push('【任务纪律 (必须遵守)】');
  lines.push('- 每步只做一件事: 要么调一个工具, 要么给 finalAnswer. 不要同时做两件事.');
  lines.push('- 工具调用成功后立即消化结果, 下一步基于结果继续, 不要重复调同一工具.');
  lines.push('- 信息够了立刻给 finalAnswer; 不够才继续调工具. 不要凑步数.');
  lines.push('- 输出 ≤ 4 行散文; 不加前言后语; 结论先行.');
  return lines.join('\n');
}

function buildReactUserPrompt(query: string, observations: string[], step: number): string {
  if (step === 1 || observations.length === 0) {
    return `任务: ${query}\n\n请输出第 1 步的 JSON.`;
  }
  return [
    `任务: ${query}`,
    '',
    '已执行的步骤 + 观察:',
    ...observations,
    '',
    `请基于上述观察, 输出第 ${step} 步的 JSON. 如果信息已足够, 给 finalAnswer.`,
  ].join('\n');
}

function parseStepDecision(content: string): StepDecision | null {
  if (!content) return null;
  // 容错: 提取首段 JSON object (允许 LLM 偶尔包 markdown code fence)
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]) as Record<string, unknown>;
    const thought = typeof parsed.thought === 'string' ? parsed.thought : '';
    if (!thought) return null;
    const out: StepDecision = { thought };
    const tc = parsed.toolCall as { name?: unknown; args?: unknown } | undefined;
    if (tc && typeof tc.name === 'string') {
      out.toolCall = {
        name: tc.name,
        args:
          tc.args && typeof tc.args === 'object'
            ? (tc.args as Record<string, unknown>)
            : {},
      };
    }
    if (typeof parsed.finalAnswer === 'string') {
      out.finalAnswer = parsed.finalAnswer;
    }
    if (typeof parsed.finished === 'boolean') {
      out.finished = parsed.finished;
    }
    return out;
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}...(truncated)` : s;
}
