/**
 * lib/persona/company-brain-reasoning.ts · 中央 AI 主回复深推理 pass (S2 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (ROADMAP-EXECUTION §S2 全路径深推理 · 主回复路径):
 *   旧状态: invokeCompanyBrainReply / boss-ai/stream 走完 preSearch → S1 感知 (单
 *           轮 runToolLoop 查只读真值) → 直接 router.chatStream 出最终回复。
 *           对"哪个项目应该砍?" / "Q3 战略对吗?" / "为什么 R&D 落后?" 这类
 *           **多面向决策类** 提问, S1 只能拉到 1-2 个 tool 结果就出回答, 缺
 *           "召回 → 评估 → 风险 → 相关人" 的结构化推理。
 *
 *   本层: 在最终流式前, 对 **复杂决策类** 提问额外跑一次 multi-step ReAct
 *         (`runMultiStep` mode='native'), 让中央 AI 用结构化步骤多次调用只读
 *         工具, 拿到完整事实链, 再据此作答。S1/S2 互斥触发, S2 命中即跳过 S1
 *         (避免重复调用 + 成本翻倍)。
 *
 * 与 lib/decision-layer/reasoning-pass.ts 的关系:
 *   - reasoning-pass.ts: 议事 Option B 前的"参谋简报", 接 three-plus-one-engine
 *   - 本文件:           IM / BossAI 主回复前的"深推理简报", 接 invokeCompanyBrainReply
 *   两者共用 REASONING_TOOLSET 与 multi-step runtime, 但触发面 + 注入点不同。
 *
 * 设计:
 *   - 严格 gate: 仅命中 "决策性 / 比较性 / 因果性 / 处方性" 关键词才跑 (避免烧 token)。
 *   - 只读白名单: 4 个 green/proxyAllowed 工具, 不含任何写动作。
 *   - fail-soft: 任何异常 (含未 boot router) 即返回原 prompt, 绝不阻塞主回复。
 *   - 有界: maxSteps 6 / maxRounds budget 由 runMultiStep 自己控制。
 */

import { COMPANY_BRAIN_USER_ID } from './company-brain';

/**
 * 只读深推理工具白名单。
 * 除 OKR/记忆/决议外, 还接入 KPI 底线 / 人才 9 宫格 / 年终奖金 三个维度,
 * 让跨维度经营推演 (进化机会 / 全景盘点) 能同时看到 目标+底线+人+钱。
 */
export const REASONING_TOOLSET = [
  'decision_card.list',
  'okr.health_digest',
  'okr.read',
  'kpi.health_digest',
  'talent.nine_box',
  'bonus.digest',
  'analytics.cross_rollup',
  'memory.search',
] as const;

export interface ReasoningResult {
  /** 是否真跑了深推理 pass 且至少调到一个工具 */
  reasoned: boolean;
  /** 注入用 system prompt (已追加深推理简报; 未推理则原样返回) */
  revisedSystemPrompt: string;
  /** 调用过的工具 (审计/调试) */
  toolsUsed: string[];
  log: {
    query: string;
    triggerReason: string;
    stepsExecuted: number;
    toolCallCount: number;
    latencyMs: number;
    traceId: string;
  };
}

/**
 * 复杂决策类提问启发式:
 *   - 比较: 比较 / 对比 / vs / 哪个更 / 谁更
 *   - 因果: 为什么 / 原因 / 导致
 *   - 处方: 怎么办 / 应该 / 建议 / 推荐 / 优先级 / 砍哪个 / 留哪个
 *   - 评估: 看法 / 判断 / 评估 / 分析
 *   - 战略: 策略 / 方案 / 路线 / 计划
 * 命中才跑 S2 (避免对"R&D 进度怎样"这种事实问题烧二次推理)。
 */
const COMPLEX_QUERY_RE =
  /比较|对比|\bvs\b|哪个更|谁更|为什么|原因|导致|怎么办|应该|建议|推荐|优先级|砍哪|留哪|看法|判断|评估|分析|策略|方案|路线|该不该/i;

export function shouldDeepReason(query: string): { trigger: boolean; reason: string } {
  const q = (query ?? '').trim();
  if (!q) return { trigger: false, reason: 'empty query' };
  if (q.length < 8) {
    return { trigger: false, reason: 'query too short for multi-step' };
  }
  if (COMPLEX_QUERY_RE.test(q)) {
    return { trigger: true, reason: 'complex-query keywords (比较/为什么/应该/分析...)' };
  }
  return {
    trigger: false,
    reason: 'no complex-query keywords; S1 perception sufficient',
  };
}

const REASONING_SYSTEM = [
  '你是中央 AI 的内部参谋。当前任务: 在主回答前为复杂决策类提问做一次多步推理。',
  '你**只读**, 严禁写入。允许调用的工具: decision_card.list / okr.health_digest / okr.read / kpi.health_digest / talent.nine_box / bonus.digest / analytics.cross_rollup / memory.search。',
  '推理框架 (按需选用, 不必全跑):',
  '  ① 召回: memory.search 拉相关历史记忆 / decision_card.list 拉历史决议',
  '  ② 评估: okr.health_digest 看全层级 KR/at-risk 真值; okr.read 拉具体 Objective',
  '  ③ 底线与人与钱: kpi.health_digest 看 KPI 达成/权重/cascade; talent.nine_box 看人才 9 宫格 (star/risk_burnout/must_intervene); bonus.digest 看奖金池与下发就绪度',
  '  ③.5 错配交叉: analytics.cross_rollup 一次拿到四维 (OKR/KPI/9宫格/奖金) 在「人」上对齐后的错配得分/信号/重点风险人 — 跨维度问题优先用它定位杠杆点',
  '  ④ 风险: 综合 at-risk + 历史失败模式, 标出风险点',
  '  ⑤ 相关人: 从 OKR.owner / Decision.owner / 9 宫格重点人找出涉及的人',
  '重要: 若问题是跨维度经营分析 (提到"融合/综合/交叉/全景/盘点/进化机会/经营推演", 或同时涉及 目标+KPI+人才+奖金 中的多项), 必须调用 analytics.cross_rollup 拿四维错配真值, 并按需补充 okr.health_digest + kpi.health_digest + talent.nine_box + bonus.digest, 不要只查单一维度就收敛, 否则下游会误判"数据缺失"。',
  '输出: 一段结构化的"深推理简报", 列出查到的真实事实 (含具体数字), 不臆测、不结论。',
  '若工具返回为空, 如实说明"暂无数据", 不要编造。',
].join('\n');

/**
 * 中央 AI 深推理 pass: 复杂决策类提问跑 multi-step, 把简报注入 systemPrompt。
 * fail-soft: 永不抛, 出错 (含未 boot router) 即返回 baseSystemPrompt 原样。
 */
export async function companyBrainReasoningPass(
  query: string,
  baseSystemPrompt: string,
  opts?: { actorUserId?: string },
): Promise<ReasoningResult> {
  const t0 = Date.now();
  const traceId = `cbr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const empty = (reason: string): ReasoningResult => ({
    reasoned: false,
    revisedSystemPrompt: baseSystemPrompt,
    toolsUsed: [],
    log: {
      query,
      triggerReason: reason,
      stepsExecuted: 0,
      toolCallCount: 0,
      latencyMs: Date.now() - t0,
      traceId,
    },
  });

  const gate = shouldDeepReason(query);
  if (!gate.trigger) return empty(gate.reason);

  try {
    const { runMultiStep } = await import('../agent-runtime/multi-step');
    const result = await runMultiStep({
      mode: 'native',
      scenario: 'reasoning_complex',
      systemPrompt: REASONING_SYSTEM,
      userQuery: query,
      toolset: [...REASONING_TOOLSET],
      maxSteps: 6,
      actorUserId: opts?.actorUserId ?? COMPANY_BRAIN_USER_ID,
      isProxy: false,
      aiTraceId: traceId,
    });

    const toolsUsed = result.trace
      .filter((s) => s.toolCall?.name)
      .map((s) => s.toolCall!.name);

    // 一个工具都没调到 → 没收集到真值, 不注入简报 (避免拿模型臆测当事实)
    if (toolsUsed.length === 0 || !result.finalAnswer.trim()) {
      return {
        reasoned: false,
        revisedSystemPrompt: baseSystemPrompt,
        toolsUsed,
        log: {
          query,
          triggerReason: `${gate.reason} → 0 tool results`,
          stepsExecuted: result.stepsExecuted,
          toolCallCount: toolsUsed.length,
          latencyMs: Date.now() - t0,
          traceId,
        },
      };
    }

    const briefBlock = [
      '',
      '---',
      '【中央 AI 主回复深推理简报 · 多步参谋查到的公司内部事实】',
      result.finalAnswer.trim(),
      '【约束】以上为系统真值 (历史决议 / OKR rollup 真实进度 / 组织记忆), 你的回答必须与之一致, 不要臆测进度或忽略已命中的风险; 若简报中标注"暂无数据", 如实说明而非编造。',
    ].join('\n');

    return {
      reasoned: true,
      revisedSystemPrompt: `${baseSystemPrompt}\n\n${briefBlock}`,
      toolsUsed,
      log: {
        query,
        triggerReason: gate.reason,
        stepsExecuted: result.stepsExecuted,
        toolCallCount: toolsUsed.length,
        latencyMs: Date.now() - t0,
        traceId,
      },
    };
  } catch (err) {
    return empty(`${gate.reason} → exception: ${(err as Error).message}`);
  }
}
