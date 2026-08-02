/**
 * lib/agent-runtime/parallel-reasoning.ts · P3 #19 PaCoRe 并行协调推理
 *
 * 前沿 (PaCoRe, ACL 2026): 传统推理串行受上下文窗口限制。PaCoRe 每轮启动多条并行推理路径,
 * 压缩发现为消息, 综合后指导下一轮。8B 模型在 HMMT 2025 达 94.5% (超 GPT-5)。
 *
 * TandemAI 翻译 (架构洞见, 不取训练): 对复杂问题启动 2-3 条并行 tool-loop, 每条用不同视角
 * 引导 (数据/风险/机会), 各自独立收集证据, 最后用一次 LLM synthesis 综合。
 *
 * 诚实边界 (backlog 级, 默认不接主链路): token 成本 ~Nx。仅在**显式高价值复杂问题**用。
 * fail-soft: 任一路径失败不影响其余; 全失败返回错误说明。
 */

import { runToolLoop, type ToolLoopInput, type ToolLoopResult } from './tool-loop';
import { logger } from '@/lib/infra/logger';

export interface ParallelPath {
  /** 路径名 (观测用) */
  name: string;
  /** 该路径的视角引导 (拼到 systemPrompt 末尾) */
  lens: string;
}

/** 默认三视角 (数据 / 风险 / 机会) — 企业经营分析常用三棱镜。 */
export const DEFAULT_PATHS: ParallelPath[] = [
  { name: 'data', lens: '聚焦**数据与事实**: 优先查真值 (OKR/KPI/进度), 用数字支撑结论。' },
  { name: 'risk', lens: '聚焦**风险与阻塞**: 找承压项、停滞点、越线风险, 给缓解建议。' },
  { name: 'opportunity', lens: '聚焦**机会与改进**: 找可放大的优势、可优化的路径、下一步行动。' },
];

export interface ParallelReasoningInput extends Omit<ToolLoopInput, 'systemPrompt'> {
  /** 基础 system prompt (各路径在其后追加自己的 lens) */
  baseSystemPrompt: string;
  /** 并行路径 (默认 DEFAULT_PATHS); 建议 2-3 条 */
  paths?: ParallelPath[];
}

export interface ParallelReasoningResult {
  /** 综合后的最终回答 */
  synthesis: string;
  /** 各路径原始结果 (观测/调试) */
  paths: Array<{ name: string; result: ToolLoopResult }>;
  totalTokensUsed: number;
  totalLatencyMs: number;
}

/**
 * 并行跑多条推理路径 + 综合。opt-in, 成本 ~Nx, 仅用于高价值复杂问题。
 */
export async function runParallelReasoning(
  input: ParallelReasoningInput,
): Promise<ParallelReasoningResult> {
  const paths = (input.paths ?? DEFAULT_PATHS).slice(0, 3);
  const started = Date.now();

  const settled = await Promise.allSettled(
    paths.map((p) =>
      runToolLoop({
        ...input,
        systemPrompt: `${input.baseSystemPrompt}\n\n【本次分析视角 · ${p.name}】${p.lens}`,
        feature: input.feature ? `${input.feature}.pacore_${p.name}` : `pacore_${p.name}`,
      }),
    ),
  );

  const pathResults: Array<{ name: string; result: ToolLoopResult }> = [];
  let totalTokensUsed = 0;
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === 'fulfilled') {
      pathResults.push({ name: paths[i].name, result: s.value });
      totalTokensUsed += s.value.totalTokensUsed;
    } else {
      logger.warn({ path: paths[i].name, err: String(s.reason) }, '[pacore] path failed (fail-soft)');
    }
  }

  if (pathResults.length === 0) {
    return {
      synthesis: '(并行推理各路径均失败, 无法综合。)',
      paths: [],
      totalTokensUsed,
      totalLatencyMs: Date.now() - started,
    };
  }

  // 综合: 一次 LLM 调用把多路径发现合成为最终回答
  let synthesis = pathResults.map((p) => `【${p.name}】${p.result.finalMessage}`).join('\n\n');
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const block = pathResults
      .map((p) => `## 视角 ${p.name}\n${p.result.finalMessage}`)
      .join('\n\n');
    const reply = await router.chat({
      messages: [
        { role: 'system', content: `${input.baseSystemPrompt}\n\n下面是从多个视角对同一问题的独立分析。请综合成一个连贯、去重、突出重点的最终回答, 保留各视角的关键发现。` },
        { role: 'user', content: `问题: ${input.userQuery}\n\n多视角分析:\n${block}\n\n综合回答:` },
      ],
      scenario: 'reasoning_complex',
      maxTokens: input.maxTokens ?? 1000,
      metadata: { userId: input.actorUserId, feature: input.feature ? `${input.feature}.pacore_synth` : 'pacore_synth' },
    });
    const text = typeof reply.message.content === 'string' ? reply.message.content : '';
    if (text.trim()) synthesis = text;
    totalTokensUsed += reply.usage?.totalTokens ?? 0;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[pacore] synthesis failed, returning concatenated paths');
  }

  return {
    synthesis,
    paths: pathResults,
    totalTokensUsed,
    totalLatencyMs: Date.now() - started,
  };
}
