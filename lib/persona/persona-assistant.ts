/**
 * lib/persona/persona-assistant.ts · 搭子「个人助理」pass (S1 执行肢体扩面 · 2026-07-29)
 *
 * ─────────────────────────────────────────────────────────
 * 与 persona-perception (只读查真值) / persona-act (OKR/起草写动作经 proposeAction) 并列:
 *   本 pass 专管「工作安排 / 日程 / 会议同步」助理场景 —— 员工说"我今天有什么安排"/
 *   "帮我约周二下午 3 点和老王开会"/"提醒一下明天会议参会人"时触发。
 *
 * 与 persona-act 的差别:
 *   - act pass 的写动作是组织治理动作 (改 OKR 数据), 全经 proposeAction (宪法 A + zone + 24h 窗)。
 *   - assistant pass 的写动作是个人生产力动作 (本人日历 / 本人会议群提醒), 直执行,
 *     由 skillRegistry 审计留痕, 不进 proposeAction —— 日程不是组织决议, 不该占否决窗。
 *
 * 诚实边界:
 *   - 严格意图门控 shouldAssist: 仅日程/会议/安排类才跑 (闲聊/OKR 提问不触发, 不烧 token)。
 *   - 全部 scoped 到本人 (skill 内 dataScope=personal + isProxy 执行经 registry 守门)。
 *   - fail-soft: 任何异常返回"未行动", 绝不阻塞搭子回复。
 *   - 有界: maxRounds 4 / maxTokens 800。
 */

import { ASSISTANT_SKILL_IDS, ASSISTANT_WRITE_SKILL_IDS } from '../taf/skills/assistant-skills';
import { recordEvalTraceSafe } from '../eval/service';
import { summarizeFindings } from '../guardrail';

/** assistant pass 工具集: 日程概览 / 找空档 / 工作安排 (读) + 创建日程 / 会议提醒 (写)。 */
export const PERSONA_ASSISTANT_TOOLSET = [...ASSISTANT_SKILL_IDS] as const;

/**
 * 助理「写」意图门控: 仅当消息明确要求创建日程 / 约会议 / 发会议提醒时才触发。
 * 纯查询类 (我今天有什么安排 / 帮我找空档) 由 persona-perception 只读处理, 不进本写 pass。
 * 与 shouldAct (OKR 写) / shouldPerceive (读) 分工, 避免误触发与重复 tool-loop。
 */
export function shouldAssist(query: string): { trigger: boolean; reason: string } {
  const q = (query ?? '').trim();
  if (q.length < 4) return { trigger: false, reason: 'too_short' };

  // 创建/预约类: "帮我约周二3点开会" / "加个日程" / "建个会议" / "订个会"
  const createVerb =
    /(帮我)?(约|预约|订|安排|加|建|新建|创建|排)(个|一?下)?.*(会议|会|日程|日历|时间|提醒)|schedule\s+a|book\s+a/i;
  // 会议提醒/通知参会人: "提醒一下明天会议的参会人" / "通知参会人"
  const remindVerb = /(提醒|通知|催).{0,6}(参会|与会|会议|大家|同事)|会议.{0,4}提醒/i;

  if (createVerb.test(q)) return { trigger: true, reason: 'assistant_create_intent' };
  if (remindVerb.test(q)) return { trigger: true, reason: 'assistant_remind_intent' };
  return { trigger: false, reason: 'no_assistant_write_intent' };
}

export interface AssistantActionRecord {
  /** 调用的助理写工具 skill id */
  tool: string;
  /** 是否成功执行 */
  ok: boolean;
  /** 结果摘要 (给本人看) */
  summary?: string;
  error?: string;
}

export interface PersonaAssistantResult {
  /** 是否真跑了助理 pass 且至少调到一个工具 */
  assisted: boolean;
  /** 只读感知注入 (若调了读工具, 追加到 systemPrompt 供搭子据实作答) */
  revisedSystemPrompt: string;
  /** 执行成功的写动作 (创建日程 / 会议提醒) */
  actions: AssistantActionRecord[];
  log: {
    query: string;
    triggerReason: string;
    toolCallCount: number;
    roundsExecuted: number;
    latencyMs: number;
    checkId: string;
  };
}

const ASSISTANT_SYSTEM = [
  '你是某员工 AI 分身的「个人助理肢体」。当且仅当该员工要求处理日程 / 会议 / 工作安排时, 你才行动。',
  '可用工具:',
  '- assistant_schedule_summary : 查本人今日/明日/本周日程 (回答"我今天有什么安排")。',
  '- assistant_find_time        : 找本人及参会人共同空档 (回答"帮我找和 X 都有空的 1 小时")。',
  '- assistant_task_plan        : 拉本人日程 + OKR 真值, 供你合成工作安排建议 (回答"帮我安排今天的节奏")。',
  '- assistant_create_event     : 创建本人日历事件 (员工明确要"约/加/建"某会议或日程时)。',
  '  ⚠️ startAt/endAt 必须是 ISO 8601, 由你根据员工说的自然语言时间自行换算 (当前时间见下)。',
  '- assistant_meeting_sync     : 向某会议参会人发 IM 群提醒 (先用 schedule_summary 拿到 eventId)。',
  '规则:',
  '1. 先用只读工具拿事实, 再决定是否需要写 (创建/提醒)。信息不足以确定时间/对象时, 不要瞎创建, 简短澄清即可。',
  '2. 创建日程 / 发提醒是**真执行** (会真的写入日历 / 真的发 IM), 执行成功后如实告知; 未执行不要声称已完成。',
  '3. 只处理本人的日程与会议, 不替员工对外承诺, 不碰薪资/裁员/法律/资金等事项。',
  `4. 当前时间: ${new Date().toISOString()} (换算"明天/下午 3 点/下周二"等相对时间时以此为基准)。`,
].join('\n');

/**
 * 搭子助理 pass: 处理日程/会议/工作安排。
 * fail-soft: 永不抛。actorUserId = persona 本人 (工具以本人 isProxy 身份执行, 受治理守门)。
 *
 * @param query  触发消息正文
 * @param baseSystemPrompt  已过治理闸的 system prompt (读工具结果会追加到此之后)
 * @param actorUserId  persona 本人 userId
 */
export async function personaAssistantPass(
  query: string,
  baseSystemPrompt: string,
  actorUserId: string,
  opts?: { tenantId?: string; maxRounds?: number },
): Promise<PersonaAssistantResult> {
  const t0 = Date.now();
  const checkId = `paa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const empty = (reason: string): PersonaAssistantResult => ({
    assisted: false,
    revisedSystemPrompt: baseSystemPrompt,
    actions: [],
    log: { query, triggerReason: reason, toolCallCount: 0, roundsExecuted: 0, latencyMs: Date.now() - t0, checkId },
  });

  const gate = shouldAssist(query);
  if (!gate.trigger) return empty(gate.reason);

  try {
    const { runToolLoop } = await import('../agent-runtime/tool-loop');
    const loop = await runToolLoop({
      systemPrompt: ASSISTANT_SYSTEM,
      userQuery: query,
      toolset: [...PERSONA_ASSISTANT_TOOLSET],
      scenario: 'tool_use',
      actorUserId,
      isProxy: true,
      tenantId: opts?.tenantId ?? 'default',
      maxRounds: opts?.maxRounds ?? 4,
      maxTokens: 800,
      aiTraceId: checkId,
      // 高价值前沿接线: 成本归因 + FIDES 信息流硬拦截 (含写工具时 context 污染即拦截)
      feature: 'persona_assistant',
      enableInfoFlow: true,
    });

    const writeIds = new Set<string>(ASSISTANT_WRITE_SKILL_IDS);
    const actions: AssistantActionRecord[] = [];
    const readResults: Array<{ name: string; result: string }> = [];

    for (const inv of loop.toolInvocations) {
      if (writeIds.has(inv.name)) {
        actions.push({
          tool: inv.name,
          ok: inv.ok,
          summary: inv.ok ? inv.result : undefined,
          error: inv.ok ? undefined : inv.result,
        });
      } else if (inv.ok) {
        readResults.push({ name: inv.name, result: inv.result });
      }
    }

    // 读工具结果注入 systemPrompt, 供搭子据实回答日程类问题
    let revisedSystemPrompt = baseSystemPrompt;
    if (readResults.length > 0) {
      const dataLines = [
        '',
        '【你 (该员工的 AI 分身) 本轮即时查到的本人日程/安排真实数据 · 据此作答】',
        ...readResults.map((r, i) => `${i + 1}. [工具 ${r.name}] 返回:\n${r.result}`),
        '',
        '【约束】以上是刚查到的日历/OKR 真值。回答须基于此, 不要编造时间或安排; 为空则如实说明。',
      ];
      revisedSystemPrompt = `${baseSystemPrompt}\n\n---\n${dataLines.join('\n')}`;
    }

    // P0 Eval: 采集 assistant trace (fail-soft)
    await recordEvalTraceSafe({
      traceId: checkId,
      tenantId: opts?.tenantId ?? 'default',
      kind: 'act',
      actorUserId,
      isProxy: true,
      inputSummary: query,
      toolInvocations: loop.toolInvocations.map((inv) => ({
        name: inv.name,
        ok: inv.ok,
        cached: inv.cached,
        error: inv.error,
        latencyMs: inv.latencyMs,
      })),
      finalOutputSummary: loop.finalMessage,
      roundsExecuted: loop.roundsExecuted,
      finishedNaturally: loop.finishedNaturally,
      tokensUsed: loop.totalTokensUsed,
      latencyMs: loop.totalLatencyMs,
      triggerReason: gate.reason,
      meta: (() => {
        const g = summarizeFindings(loop.guardrailFindings);
        return {
          writeActionCount: actions.filter((a) => a.ok).length,
          readToolCount: readResults.length,
          guardrailInjection: g.injection,
          guardrailJailbreak: g.jailbreak,
          guardrailPii: g.pii,
        };
      })(),
    });

    return {
      assisted: loop.toolInvocations.length > 0,
      revisedSystemPrompt,
      actions,
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
