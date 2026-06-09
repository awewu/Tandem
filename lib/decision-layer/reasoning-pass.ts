/**
 * lib/decision-layer/reasoning-pass.ts · 议事多步参谋推理 (S2·CA-5 · 2026-06-08)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (ROADMAP §智能主轴 S2 "一步脑"):
 *   旧状态: ThreePlusOneEngine.buildOptionB 是 single-shot LLM 调用 —— 直接拿
 *           SOP/案例 hints + 静态 OKR 锚, 一次推理给方案。不会"召回历史决议 →
 *           评估 OKR 对齐 → 查风险/相关案例"多步收集再下笔。
 *
 *   本层: 在 Option B 生成前, 跑一遍 runMultiStep (native → tool-loop) 让中央 AI
 *         用**只读**工具主动多步收集"参谋简报" (历史相似决议 / OKR 真值对齐 /
 *         风险案例), 把简报注入 Option B 的上下文。"一步脑 → 会参谋"。
 *
 * 设计 (镜像 company-brain-perception 的 perception pass):
 *   - 只读白名单: 4 个 green/proxyAllowed 工具, 无任何写/红区动作。
 *   - 工具执行仍走 skillRegistry.execute 治理守门 (runMultiStep native 内部)。
 *   - fail-soft: 任何异常 (含 getRouter 未 boot) 都返回空简报, 绝不阻塞 3+1 生成。
 *   - 有界: maxSteps 4 / 单测环境 getRouter 抛 → 直接空简报 (现有 engine 测零回归)。
 */

import type { DecisionContext } from './three-plus-one-engine';
import { COMPANY_BRAIN_USER_ID } from '../persona/company-brain';

/** 只读参谋工具白名单 (全部 green · proxyAllowed · 无副作用) */
export const REASONING_TOOLSET = [
  'decision_card.list',
  'okr.health_digest',
  'okr.read',
  'memory.search',
] as const;

export interface ReasoningBriefResult {
  /** 是否真跑了多步推理且至少调到一个工具 */
  reasoned: boolean;
  /** 参谋简报 (注入 Option B; 未推理则空串) */
  brief: string;
  /** 调用过的工具名 (审计/调试) */
  toolsUsed: string[];
  log: {
    stepsExecuted: number;
    toolCallCount: number;
    latencyMs: number;
    traceId: string;
  };
}

const REASONING_SYSTEM = [
  '你是议事的「多步参谋」。在给出决策方案前, 你的任务是用提供的只读工具, 多步收集与本议题相关的公司内部事实:',
  '  1. 历史相似决议 (decision_card.list) —— 公司以前怎么决的, 结果如何;',
  '  2. OKR 真值对齐 (okr.health_digest / okr.read) —— 本决策服务哪个目标, 该目标当前进度/是否 at-risk;',
  '  3. 风险与案例 (memory.search) —— 相关红线 / SOP / 踩过的坑。',
  '规则:',
  '  - 只收集事实, 不要替员工做决定, 不要写最终方案。',
  '  - 用最少的工具调用拿到关键事实即可, 拿到后立即收敛。',
  '  - 最终用 finalAnswer 输出一份结构化「参谋简报」(历史决议 / OKR 对齐 / 风险提示三段), 每段 1-3 条要点; 无数据的段如实写"暂无"。',
  '  - 若议题与内部数据无关, 直接 finalAnswer 简短说明"无需查询"。',
].join('\n');

/**
 * 议事 Option B 前的多步参谋推理。
 * fail-soft: 永不抛, 出错 (含未 boot router) 即返回空简报。
 */
export async function buildDecisionReasoningBrief(
  ctx: DecisionContext,
): Promise<ReasoningBriefResult> {
  const t0 = Date.now();
  const traceId = `drp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const empty = (): ReasoningBriefResult => ({
    reasoned: false,
    brief: '',
    toolsUsed: [],
    log: { stepsExecuted: 0, toolCallCount: 0, latencyMs: Date.now() - t0, traceId },
  });

  const query = [ctx.title, ctx.description]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join('. ');
  if (!query) return empty();

  try {
    const { runMultiStep } = await import('../agent-runtime/multi-step');
    const result = await runMultiStep({
      mode: 'native',
      scenario: 'reasoning_complex',
      systemPrompt: REASONING_SYSTEM,
      userQuery: query,
      toolset: [...REASONING_TOOLSET],
      maxSteps: 4,
      actorUserId: ctx.actorUserId ?? COMPANY_BRAIN_USER_ID,
      isProxy: true,
      aiTraceId: traceId,
    });

    const toolsUsed = result.trace
      .filter((s) => s.toolCall?.name)
      .map((s) => s.toolCall!.name);

    // 一个工具都没调到 → 没收集到真值, 不注入简报 (避免拿模型臆测当事实)
    if (toolsUsed.length === 0 || !result.finalAnswer.trim()) {
      return {
        reasoned: false,
        brief: '',
        toolsUsed,
        log: {
          stepsExecuted: result.stepsExecuted,
          toolCallCount: toolsUsed.length,
          latencyMs: Date.now() - t0,
          traceId,
        },
      };
    }

    const brief = [
      '【议事多步参谋简报 · 中央 AI 即时查到的公司内部事实 · 据此给方案】',
      result.finalAnswer.trim(),
      '【约束】以上为系统真值 (历史决议 / OKR rollup 真实进度 / 组织记忆), 你的 Option B 必须与之一致, 不要臆测进度或忽略已命中的风险。',
    ].join('\n');

    return {
      reasoned: true,
      brief,
      toolsUsed,
      log: {
        stepsExecuted: result.stepsExecuted,
        toolCallCount: toolsUsed.length,
        latencyMs: Date.now() - t0,
        traceId,
      },
    };
  } catch {
    return empty();
  }
}
