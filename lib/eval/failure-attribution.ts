/**
 * lib/eval/failure-attribution.ts · P0-3 失败归因 pass
 *
 * 前沿 (Claw-Eval 失败归因): 一条失败 trace 里往往有一个"决定性错误步" (decisive step) —
 * 找到它才能定向改进 (改 prompt / 加工具 / 收紧白名单), 而非笼统"这次失败了"。
 *
 * 做法:
 *   1. 确定性判定 trace 是否"失败" (isFailedTrace): 未自然收敛 / 有工具报错 / 有 grader fail。
 *   2. best-effort LLM 定位决定性错误步 + 一句诊断 + 建议类别 (prompt/tool/whitelist/data/other)。
 *   3. 结果写回 trace.meta.failureAttribution (只记不改真值, 宪法 A)。
 *
 * 纪律: 纯只读只记, 永不抛, LLM 失败则用确定性兜底 (第一个报错工具 = 决定性步)。
 */

import type { EvalTrace } from '@/lib/types/eval';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';

export type FailureCategory = 'prompt' | 'tool' | 'whitelist' | 'data' | 'convergence' | 'other';

export interface FailureAttribution {
  /** 是否判定为失败 (false 时其余字段无意义) */
  failed: boolean;
  /** 决定性错误步的 0-based 序号 (指向 toolInvocations); -1 = 无具体工具步 (如收敛失败) */
  decisiveStepIndex: number;
  /** 决定性步的工具名 (若有) */
  decisiveTool?: string;
  /** 一句诊断 (≤80 字) */
  diagnosis: string;
  /** 建议改进类别 */
  category: FailureCategory;
  /** 是否走了 LLM (false = 确定性兜底) */
  llmUsed: boolean;
  attributedAt: string;
}

/** 确定性判定: 这条 trace 是否失败 (供是否触发归因)。 */
export function isFailedTrace(trace: Pick<EvalTrace, 'finishedNaturally' | 'toolInvocations' | 'grades'>): boolean {
  if (trace.finishedNaturally === false) return true;
  if ((trace.toolInvocations ?? []).some((t) => !t.ok)) return true;
  if ((trace.grades ?? []).some((g) => !g.pass)) return true;
  return false;
}

/** 确定性兜底: 第一个报错工具 = 决定性步; 否则收敛失败 = -1。 */
function deterministicAttribution(trace: EvalTrace): FailureAttribution {
  const idx = (trace.toolInvocations ?? []).findIndex((t) => !t.ok);
  if (idx >= 0) {
    const inv = trace.toolInvocations[idx];
    const category: FailureCategory = inv.error === 'tool_not_allowed' ? 'whitelist' : inv.error === 'planguard_blocked' ? 'whitelist' : 'tool';
    return {
      failed: true,
      decisiveStepIndex: idx,
      decisiveTool: inv.name,
      diagnosis: `工具 ${inv.name} 失败: ${inv.error ?? 'unknown'}`,
      category,
      llmUsed: false,
      attributedAt: new Date().toISOString(),
    };
  }
  return {
    failed: true,
    decisiveStepIndex: -1,
    diagnosis: trace.finishedNaturally === false ? '未自然收敛 (撞 maxRounds)' : 'grader 判定失败',
    category: trace.finishedNaturally === false ? 'convergence' : 'other',
    llmUsed: false,
    attributedAt: new Date().toISOString(),
  };
}

/**
 * 对一条 trace 跑失败归因。非失败 trace → { failed:false }。
 * best-effort: LLM 失败则确定性兜底; 永不抛。
 */
export async function attributeFailure(trace: EvalTrace, useLlm = true): Promise<FailureAttribution> {
  if (!isFailedTrace(trace)) {
    return { failed: false, decisiveStepIndex: -1, diagnosis: '', category: 'other', llmUsed: false, attributedAt: new Date().toISOString() };
  }
  const fallback = deterministicAttribution(trace);
  if (!useLlm) return fallback;

  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const steps = (trace.toolInvocations ?? []).map((t, i) => ({
      i,
      tool: t.name,
      ok: t.ok,
      error: t.error,
    }));
    const system =
      '你是 agent 轨迹失败归因分析官。给定一次失败的 agent pass (输入 + 工具调用序列 + 最终输出), ' +
      '找出**决定性错误步** (哪一步导致最终失败) + 一句诊断 + 建议改进类别。' +
      '类别 ∈ prompt(指令不清)/tool(工具本身错)/whitelist(越权被拦)/data(数据缺失)/convergence(未收敛)/other。' +
      '只输出 JSON: {"decisiveStepIndex":number(-1表示无具体工具步),"diagnosis":"≤80字","category":"..."}。';
    const payload = {
      input: trace.inputSummary,
      steps,
      finishedNaturally: trace.finishedNaturally ?? true,
      output: trace.finalOutputSummary,
    };
    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: 失败归因只读只记 (宪法A)
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `失败 pass (JSON):\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 250,
      metadata: { userId: '__failure_attribution__', feature: 'failure_attribution' },
    });
    const content = typeof reply.message.content === 'string' ? reply.message.content : JSON.stringify(reply.message.content);
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return fallback;
    const parsed = JSON.parse(m[0]) as { decisiveStepIndex?: unknown; diagnosis?: unknown; category?: unknown };
    const idx = typeof parsed.decisiveStepIndex === 'number' ? parsed.decisiveStepIndex : fallback.decisiveStepIndex;
    const validCats: FailureCategory[] = ['prompt', 'tool', 'whitelist', 'data', 'convergence', 'other'];
    const category = validCats.includes(parsed.category as FailureCategory) ? (parsed.category as FailureCategory) : fallback.category;
    const decisiveTool = idx >= 0 && trace.toolInvocations?.[idx] ? trace.toolInvocations[idx].name : undefined;
    return {
      failed: true,
      decisiveStepIndex: idx,
      decisiveTool,
      diagnosis: typeof parsed.diagnosis === 'string' ? parsed.diagnosis.slice(0, 80) : fallback.diagnosis,
      category,
      llmUsed: true,
      attributedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message, traceId: trace.id }, '[failure-attribution] llm failed, using deterministic fallback');
    return fallback;
  }
}

/**
 * 对一条已存储 trace 跑失败归因并写回 meta.failureAttribution (best-effort)。
 * 返回归因结果; trace 不存在或非失败 → null。
 */
export async function attributeTraceFailure(traceId: string, useLlm = true): Promise<FailureAttribution | null> {
  try {
    const store = getStore();
    const trace = await store.evalTraces.get(traceId);
    if (!trace) return null;
    const attribution = await attributeFailure(trace, useLlm);
    if (!attribution.failed) return null;
    await store.evalTraces.update(traceId, {
      meta: { ...(trace.meta ?? {}), failureAttribution: attribution },
    });
    return attribution;
  } catch (err) {
    logger.warn({ err: (err as Error).message, traceId }, '[failure-attribution] attributeTraceFailure failed');
    return null;
  }
}
