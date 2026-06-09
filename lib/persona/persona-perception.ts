/**
 * lib/persona/persona-perception.ts · 搭子感知前置 (S1 肢体扩展到 persona · 2026-06-08 序2)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (DAZI-BEYOND-COWORK §五 路线①「装配执行肢体到搭子路径」):
 *   旧状态: invokePersonaReply 走 governedChat 单次 router.chat (+preSearch 联网),
 *           搭子不能查公司内部真值 (自己 owner 的 OKR / 决议 / 组织记忆) → "会说不会查",
 *           一问"我那个 KR 现在怎样"只能凭静态 styleProfile 含糊作答。
 *
 *   本层 (镜像 companyBrainPerceptionPass, 但 scoped 到 persona 本人):
 *     - actorUserId = persona.userId, isProxy=true → 工具执行经 skillRegistry.execute
 *       治理守门, 只能看该员工自己有权见的数据 (data scope 在 registry/skill 内生效)。
 *     - 只读白名单: okr.read / memory.search / decision_card.list (全 green · proxyAllowed · 无副作用)。
 *     - 启发式 gate 复用 company-brain-perception.shouldPerceive (闲聊不烧 tool-loop)。
 *     - fail-soft: 任何异常都返回"未感知", 绝不阻塞搭子回复。
 *     - 有界: maxRounds 3 / maxTokens 600。
 *
 * 诚实边界 (不越界):
 *   本 pass 只做"答前先查真值" (会查) —— **只读**。改企业数据 / 对外承诺等写动作仍走
 *   invokePersonaReply 原有的 governedChat 动作闸 (闸④ zone + 委托级别越权升红) + ProxyAction
 *   24h 否决窗。写侧执行肢体是后续单独设计, 不在本步混入 (避免动作闸单动作语义被 tool-loop 绕过)。
 */

import { shouldPerceive } from './company-brain-perception';

/** 搭子只读感知工具白名单 (scoped 到本人; 全 green · proxyAllowed · 无写动作) */
export const PERSONA_PERCEPTION_TOOLSET = [
  'okr.read',
  'memory.search',
  'decision_card.list',
] as const;

export interface PersonaPerceptionResult {
  /** 是否真跑了感知 pass 且至少调到一个工具并拿到结果 */
  perceived: boolean;
  /** 注入用 system prompt (已追加内部真值; 未感知则原样返回) */
  revisedSystemPrompt: string;
  /** 调用过的工具 (审计/调试) */
  toolInvocations: Array<{ name: string; ok: boolean }>;
  log: {
    query: string;
    triggerReason: string;
    toolCallCount: number;
    roundsExecuted: number;
    latencyMs: number;
    checkId: string;
  };
}

const PERSONA_PERCEPTION_SYSTEM = [
  '你是某员工 AI 分身的「感知前置」。你的唯一任务是: 调用提供的只读工具, 收集与该员工的问题相关的、该员工本人有权查看的内部真实数据 (本人/团队 OKR 真值进度 / 相关决议 / 个人与团队知识库)。',
  '规则:',
  '1. 只收集数据, 不要替员工回答问题本身, 不要做承诺或给最终方案。',
  '2. 用最少的工具调用拿到关键事实即可, 拿到后立即停止。',
  '3. 若问题与内部数据无关, 不调用任何工具, 直接简短说明"无需查询"。',
].join('\n');

/**
 * 搭子回复前的只读感知 pass: 查本人真值并注入 systemPrompt。
 * fail-soft: 永不抛, 出错即返回 baseSystemPrompt 原样 (perceived=false)。
 *
 * @param query  触发消息正文
 * @param baseSystemPrompt  已过治理闸的 system prompt
 * @param actorUserId  persona 本人 userId (工具以本人身份 + isProxy 执行, 受 skillRegistry 守门)
 */
export async function personaPerceptionPass(
  query: string,
  baseSystemPrompt: string,
  actorUserId: string,
): Promise<PersonaPerceptionResult> {
  const t0 = Date.now();
  const checkId = `ppp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const empty = (reason: string): PersonaPerceptionResult => ({
    perceived: false,
    revisedSystemPrompt: baseSystemPrompt,
    toolInvocations: [],
    log: { query, triggerReason: reason, toolCallCount: 0, roundsExecuted: 0, latencyMs: Date.now() - t0, checkId },
  });

  const gate = shouldPerceive(query);
  if (!gate.trigger) return empty(gate.reason);

  try {
    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const loop = await runToolLoop({
      systemPrompt: PERSONA_PERCEPTION_SYSTEM,
      userQuery: query,
      toolset: [...PERSONA_PERCEPTION_TOOLSET],
      scenario: 'tool_use',
      actorUserId,
      isProxy: true,
      maxRounds: 3,
      maxTokens: 600,
      aiTraceId: checkId,
    });

    const okInvocations = loop.toolInvocations.filter((t) => t.ok);
    const toolInvocations = loop.toolInvocations.map((t) => ({ name: t.name, ok: t.ok }));

    // 一个工具都没调到结果 → 没拿到真值, 不改 prompt (但记录跑过)
    if (okInvocations.length === 0) {
      return {
        perceived: false,
        revisedSystemPrompt: baseSystemPrompt,
        toolInvocations,
        log: {
          query,
          triggerReason: `${gate.reason} → 0 tool results`,
          toolCallCount: loop.toolInvocations.length,
          roundsExecuted: loop.roundsExecuted,
          latencyMs: Date.now() - t0,
          checkId,
        },
      };
    }

    const dataLines = [
      '',
      '【你 (该员工的 AI 分身) 本轮即时查到的本人内部真实数据 · 优先据此作答】',
      ...okInvocations.map((t, i) => `${i + 1}. [工具 ${t.name}] 返回:\n${t.result}`),
      '',
      '【约束】以上是你刚查到的系统真值 (S0 rollup 真实进度 / 决议 / 记忆)。回答必须基于这些真实数据, 不要臆测进度或数字; 若某项为空, 如实说明"暂无数据"而非编造。仍不得做超出委托级别的承诺。',
    ];
    const revisedSystemPrompt = `${baseSystemPrompt}\n\n---\n${dataLines.join('\n')}`;

    return {
      perceived: true,
      revisedSystemPrompt,
      toolInvocations,
      log: {
        query,
        triggerReason: gate.reason,
        toolCallCount: loop.toolInvocations.length,
        roundsExecuted: loop.roundsExecuted,
        latencyMs: Date.now() - t0,
        checkId,
      },
    };
  } catch (err) {
    return empty(`${gate.reason} → exception: ${(err as Error).message}`);
  }
}
