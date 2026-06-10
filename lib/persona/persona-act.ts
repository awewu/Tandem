/**
 * lib/persona/persona-act.ts · 搭子「装手」执行肢体 act pass (S1 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 与 persona-perception.ts 的分工 (后者明确把写侧留给"后续单独设计", 见其文件头):
 *   - persona-perception = 答前**只读**查真值 (会看)。
 *   - persona-act (本文件) = 当员工消息表达"帮我改/更新某 OKR 数据"时, 用**写使能** tool-loop
 *     提议写动作 —— 但**只走 proposeAction**, 故每个写动作都过宪法 A + zone + 24h 否决窗。
 *
 * 诚实边界 (不越界):
 *   - 严格意图门控: 仅当消息明确像"更新进度/check-in/标信心度"才跑 (闲聊/提问不触发, 不烧 token、不造噪音 ProxyAction)。
 *   - 写动作只提议不直写: okr.checkin_propose / persona.propose_action 内部调 proposeAction;
 *     绿区即执行留痕 / 黄区落 awaiting_veto (24h) / 红区拒。中央 AI 永不可 proposer (宪法 A 下游硬拒)。
 *   - fail-soft: 任何异常都返回"未行动", 绝不阻塞搭子回复。
 *   - 有界: maxRounds 4 / maxTokens 700。
 */

import { PERSONA_WRITE_SKILL_IDS } from '../taf/skills/persona-write';

/** act pass 工具集: 先 okr.read 定位 KR, 再提议写动作 (全经 proposeAction 治理)。 */
export const PERSONA_ACT_TOOLSET = ['okr.read', ...PERSONA_WRITE_SKILL_IDS] as const;

/**
 * 行动意图门控: 仅当消息明确表达"对自己 OKR 数据做更新/check-in"才触发。
 * 比 shouldPerceive 更严 (perception 只是查, act 要写, 误触发代价更高)。
 */
export function shouldAct(query: string): { trigger: boolean; reason: string } {
  const q = (query ?? '').trim();
  if (q.length < 4) return { trigger: false, reason: 'too_short' };

  // 动作动词 (改写意图)
  const actionVerb =
    /(更新|改成|改为|调成|调整到|设成|设为|标记?成|标为|录入|登记|提交|填(报|一下)?|check.?in|签到|更?新进度|update|set\s+.*\s+to)/i;
  // 对象限定 (必须是 OKR/KR/进度类, 避免"更新一下文档"这种误触)
  const okrObject = /(进度|kr|key\s*result|关键结果|目标|okr|指标|完成度|信心度|on-track|at-risk|off-track|百分比|%)/i;

  if (actionVerb.test(q) && okrObject.test(q)) {
    return { trigger: true, reason: 'okr_write_intent' };
  }
  return { trigger: false, reason: 'no_action_intent' };
}

export interface ProposedActionRecord {
  /** 调用的写工具 skill id */
  tool: string;
  /** 'executed' (绿区即执行) | 'pending_veto' (黄区24h窗) | 'rejected' */
  status: string;
  zone?: string;
  proxyActionId?: string;
  reasons?: string[];
}

export interface PersonaActResult {
  /** 是否真提议了至少一个写动作 (无论最终绿/黄/红) */
  acted: boolean;
  /** 落成待确认/已执行的提议 (status !== 'rejected') */
  proposals: ProposedActionRecord[];
  /** 被拒的提议 (审计/提示用) */
  rejected: ProposedActionRecord[];
  log: {
    query: string;
    triggerReason: string;
    toolCallCount: number;
    roundsExecuted: number;
    latencyMs: number;
    checkId: string;
  };
}

const ACT_SYSTEM = [
  '你是某员工 AI 分身的「行动肢体」。当且仅当该员工明确要求"更新/登记自己某个 OKR (关键结果 KR 或目标 Objective) 的进度或信心度"时, 你才行动。',
  '步骤:',
  '1. 先用 okr_read 找到该员工对应的 KR / 目标及其 id (必要时按 ownerId=该员工 查)。',
  '2. 找到唯一明确的目标后, 调对应提议工具:',
  '   - 更新 KR 进度/信心度 → okr_checkin_propose (传 krId + currentValue 或 confidence + 简短 reason)。',
  '   - 更新目标 (Objective) 信心度 → okr_objective_checkin_propose (传 objectiveId + confidence + reason)。',
  '3. 这只是"提议": 系统会落成待本人确认的代行 (24h 否决窗), 不会立即生效。不要声称已完成。',
  '规则:',
  '- 目标对象不唯一/不明确, 或员工只是提问而非要求更新 → 不调用任何写工具, 直接简短说明需要澄清。',
  '- 永远不要替员工做承诺、对外发送、或碰薪资/裁员/法律/资金等红区事项。',
].join('\n');

/**
 * 搭子行动 pass: 当员工要求更新自己 OKR 数据时, 经治理提议写动作。
 * fail-soft: 永不抛。actorUserId = persona 本人 (工具以本人 isProxy 身份执行, 受治理守门)。
 */
export async function personaActPass(
  query: string,
  actorUserId: string,
  opts?: { tenantId?: string; maxRounds?: number },
): Promise<PersonaActResult> {
  const t0 = Date.now();
  const checkId = `pap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const empty = (reason: string): PersonaActResult => ({
    acted: false,
    proposals: [],
    rejected: [],
    log: { query, triggerReason: reason, toolCallCount: 0, roundsExecuted: 0, latencyMs: Date.now() - t0, checkId },
  });

  const gate = shouldAct(query);
  if (!gate.trigger) return empty(gate.reason);

  try {
    const { runToolLoop } = await import('../agent-runtime/tool-loop');
    const loop = await runToolLoop({
      systemPrompt: ACT_SYSTEM,
      userQuery: query,
      toolset: [...PERSONA_ACT_TOOLSET],
      scenario: 'tool_use',
      actorUserId,
      isProxy: true,
      tenantId: opts?.tenantId ?? 'default',
      maxRounds: opts?.maxRounds ?? 4,
      maxTokens: 700,
      aiTraceId: checkId,
    });

    const writeIds = new Set<string>(PERSONA_WRITE_SKILL_IDS);
    const proposals: ProposedActionRecord[] = [];
    const rejected: ProposedActionRecord[] = [];

    for (const inv of loop.toolInvocations) {
      if (!writeIds.has(inv.name)) continue;
      // inv.result 是 proposeAction 结果的 JSON 序列 (skillRegistry → SkillResult.data)
      let parsed: { status?: string; zone?: string; proxyActionId?: string; reasons?: string[] } = {};
      try {
        parsed = JSON.parse(inv.result) as typeof parsed;
      } catch {
        /* 非 JSON (如 [ERROR] ...) → 视为拒 */
      }
      const rec: ProposedActionRecord = {
        tool: inv.name,
        status: parsed.status ?? (inv.ok ? 'unknown' : 'rejected'),
        zone: parsed.zone,
        proxyActionId: parsed.proxyActionId,
        reasons: parsed.reasons,
      };
      if (rec.status === 'rejected' || !inv.ok) rejected.push(rec);
      else proposals.push(rec);
    }

    return {
      acted: proposals.length > 0 || rejected.length > 0,
      proposals,
      rejected,
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
