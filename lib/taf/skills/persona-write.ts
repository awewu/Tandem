/**
 * lib/taf/skills/persona-write.ts · 搭子「装手」: tool-loop 可调的治理性写动作提议 (S1 · 2026-06-09)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (CSP-1 实测 + DAZI-BEYOND-COWORK §五「装配执行肢体到搭子路径」):
 *   旧状态: runToolLoop 只接 skillRegistry 里的**只读**工具 (memory.search / okr.read / ...) —
 *           搭子"会看不会动"。写动作肢体 (lib/ontology/propose-action) 已造好但只能从
 *           proposeAction 进, LLM 在 tool-loop 里够不到 → 眼睛与手不连通。
 *
 *   本文件: 把"提议写动作"封成两个 skill, 让搭子的 tool-loop 能调:
 *     - okr.checkin_propose    : 旗舰具体动作 (提议 KR 进度 check-in)
 *     - persona.propose_action : 泛化桥 (提议 actionRegistry 里任意已注册写动作)
 *   二者都**只路由到 proposeAction**, 绝不自己写库 —— 真治理在下游:
 *     ① 宪法 A: proposeAction 硬拒中央 AI 作为 proposer (只接员工本人分身, self-delegation);
 *     ② zone 判定: deriveActionZone(内容+委托级别) → 红拒 / 绿即执行留痕 / 黄建 ProxyAction;
 *     ③ 24h 否决窗: 黄区落 awaiting_veto, 员工本人确认或窗口静默过才兑现真写。
 *
 * 防御纵深: 即便误把本工具挂进中央 AI 的 tool-loop, proposeAction 仍按宪法 A 硬拒。
 * 故本文件只做"查本人分身 → 调 proposeAction → 映射结果", 不重复治理逻辑。
 */

import type { Skill, SkillContext, SkillResult } from './registry';

/** 找调用方本人的分身 (proposer); 查不到则 null。中央 AI 的分身交由 proposeAction 宪法 A 拒。 */
async function findProposerPersona(
  userId: string,
): Promise<{ id: string; delegationLevel?: string } | null> {
  const { getStore } = await import('../../storage/repository');
  const store = getStore();
  const personas = await store.personas.list();
  const p = personas.find((x) => x.userId === userId);
  return p ? { id: p.id, delegationLevel: p.delegationLevel } : null;
}

/** 统一: 查本人分身 → proposeAction → 映射成 SkillResult。永不抛 (registry 也兜底)。 */
async function routePropose(
  actionId: string,
  input: unknown,
  reason: string | undefined,
  ctx: SkillContext,
): Promise<SkillResult> {
  const persona = await findProposerPersona(ctx.userId);
  if (!persona) {
    return { ok: false, error: '未找到本人分身, 无法提议代行写动作 (须先有 Persona)', tokensUsed: 50 };
  }

  const { proposeAction } = await import('../../ontology');
  const res = await proposeAction({
    actionId,
    input,
    proposerPersonaId: persona.id,
    onBehalfOfUserId: ctx.userId,
    tenantId: ctx.tenantId,
    reason,
    delegationLevel: persona.delegationLevel as never,
  });

  const ok = res.status !== 'rejected';
  return {
    ok,
    data: {
      status: res.status, // 'executed' (绿区即执行) | 'pending_veto' (黄区24h窗) | 'rejected'
      zone: res.zone,
      proxyActionId: res.proxyActionId,
      reasons: res.reasons,
    },
    error: ok ? undefined : `提议被拒 (${res.zone}区): ${res.reasons.join('; ')}`,
    tokensUsed: 150,
  };
}

// ---------------------------------------------------------------------------
// okr.checkin_propose · 旗舰: 提议一次 KR 进度 check-in (经 24h 否决窗)
// ---------------------------------------------------------------------------

export const OkrCheckinProposeSkill: Skill<
  { krId: string; currentValue?: number; confidence?: 'on-track' | 'at-risk' | 'off-track'; reason?: string },
  unknown
> = {
  id: 'okr.checkin_propose',
  description:
    '替员工提议一次 KR 进度 check-in (更新关键结果的当前值/信心度). 不立即写: 落成待员工确认的代行 (24h 否决窗), 员工确认或窗口过才生效.',
  tags: ['okr', 'kr', 'check-in', '进度', '更新', '代行', '提议', '写'],
  zone: 'yellow', // 提议写动作; 真 zone 由下游 deriveActionZone(commit+内容+委托级别) 判定
  proxyAllowed: true,
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'okr_checkin_propose',
      description:
        '提议更新某 KR 的进度 (check-in). 用于员工说"帮我把 X 指标的进度更新到 N"/"把它标成 at-risk"等. 会落成待本人确认的代行, 不立即生效.',
      parameters: {
        type: 'object',
        properties: {
          krId: { type: 'string', description: '目标 KeyResult 的 id (可先用 okr_read 查到)' },
          currentValue: { type: 'number', description: '最新进度数值 (写回 KR.currentValue)' },
          confidence: {
            type: 'string',
            enum: ['on-track', 'at-risk', 'off-track'],
            description: '信心度',
          },
          reason: { type: 'string', description: '本次更新的理由/背景 (给本人看)' },
        },
        required: ['krId'],
      },
    },
  },
  async execute({ krId, currentValue, confidence, reason }, ctx) {
    return routePropose(
      'kr.checkin',
      { krId, currentValue, confidenceAfter: confidence },
      reason,
      ctx,
    );
  },
};

// ---------------------------------------------------------------------------
// okr.objective_checkin_propose · 提议一次 Objective 进度 check-in (经 24h 否决窗)
// ---------------------------------------------------------------------------

export const OkrObjectiveCheckinProposeSkill: Skill<
  { objectiveId: string; confidence?: 'on-track' | 'at-risk' | 'off-track'; reason?: string },
  unknown
> = {
  id: 'okr.objective_checkin_propose',
  description:
    '替员工提议一次目标 (Objective) 的 check-in (更新目标信心度并触发进度 rollup). 不立即写: 落成待员工确认的代行 (24h 否决窗).',
  tags: ['okr', 'objective', '目标', 'check-in', '进度', '代行', '提议', '写'],
  zone: 'yellow',
  proxyAllowed: true,
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'okr_objective_checkin_propose',
      description:
        '提议更新某 Objective 的信心度并做一次 check-in. 用于员工说"把我那个目标标成 at-risk"等. 会落成待本人确认的代行, 不立即生效.',
      parameters: {
        type: 'object',
        properties: {
          objectiveId: { type: 'string', description: '目标 Objective 的 id (可先用 okr_read 查到)' },
          confidence: {
            type: 'string',
            enum: ['on-track', 'at-risk', 'off-track'],
            description: '信心度',
          },
          reason: { type: 'string', description: '本次更新的理由/背景 (给本人看)' },
        },
        required: ['objectiveId'],
      },
    },
  },
  async execute({ objectiveId, confidence, reason }, ctx) {
    return routePropose('objective.checkin', { objectiveId, confidenceAfter: confidence }, reason, ctx);
  },
};

// ---------------------------------------------------------------------------
// persona.propose_action · 泛化桥: 提议 actionRegistry 里任意已注册写动作
// ---------------------------------------------------------------------------

export const PersonaProposeActionSkill: Skill<
  { actionId: string; input: Record<string, unknown>; reason?: string },
  unknown
> = {
  id: 'persona.propose_action',
  description:
    '替员工提议执行一个已注册的本体写动作 (actionRegistry). 不立即写: 经治理判定后, 绿区即执行留痕 / 黄区落 24h 否决窗 / 红区拒绝. 通用入口, 具体动作优先用专用工具 (如 okr.checkin_propose).',
  tags: ['代行', '提议', '写动作', 'ontology', 'action', 'propose'],
  zone: 'yellow',
  proxyAllowed: true,
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'persona_propose_action',
      description:
        '提议执行一个已注册写动作. actionId 必须是系统已注册的动作 id (如 "kr.checkin"); input 是该动作的入参对象. 会经红/黄/绿区治理, 不保证立即生效.',
      parameters: {
        type: 'object',
        properties: {
          actionId: { type: 'string', description: '已注册的 Action Type id, 如 "kr.checkin"' },
          input: { type: 'object', description: '该动作的入参对象 (按动作 schema)' },
          reason: { type: 'string', description: '提议理由 (给被代行人看)' },
        },
        required: ['actionId', 'input'],
      },
    },
  },
  async execute({ actionId, input, reason }, ctx) {
    if (!actionId || typeof actionId !== 'string') {
      return { ok: false, error: 'actionId 必填且须为字符串', tokensUsed: 30 };
    }
    return routePropose(actionId, input ?? {}, reason, ctx);
  },
};

// ---------------------------------------------------------------------------
// 起草类写动作 · 搭子代笔产出 (周报 / 行动项), 落成待本人确认的代行 (24h)
//   与 OKR check-in 提议的区别: 不经 ontology proposeAction (无对应 ActionType),
//   而是直接落 ProxyAction(kind='decision_draft', status='drafted') —— 内容草稿,
//   不自动对外、不自动写业务库; 本人确认=保留(executed) / 否决=丢弃 / 24h 未理=过期.
//   仍受治理: createProxyAction 红区硬拒 + OKR drift 检测 + 进代行台账可审计.
// ---------------------------------------------------------------------------

async function routeDraft(
  opts: { title: string; body: string; draftType: string; metadata?: Record<string, unknown> },
  ctx: SkillContext,
): Promise<SkillResult> {
  if (!opts.title?.trim() || !opts.body?.trim()) {
    return { ok: false, error: '草稿标题与正文均不能为空', tokensUsed: 30 };
  }
  const persona = await findProposerPersona(ctx.userId);
  if (!persona) {
    return { ok: false, error: '未找到本人分身, 无法起草代行草稿 (须先有 Persona)', tokensUsed: 50 };
  }
  try {
    const { createProxyAction } = await import('../../persona/proxy-actions');
    const action = await createProxyAction({
      userId: ctx.userId,
      personaId: persona.id,
      tenantId: ctx.tenantId,
      kind: 'decision_draft',
      zone: 'yellow', // 内部草稿低风险; 红区由 createProxyAction 硬拒兜底
      title: opts.title.trim(),
      body: opts.body.trim(),
      refType: `draft:${opts.draftType}`,
      initialStatus: 'drafted', // 待本人确认; 24h 未理则过期 (不自动落定)
      metadata: { draftType: opts.draftType, source: 'persona_act', ...opts.metadata },
    });
    return {
      ok: true,
      data: { status: 'drafted', zone: 'yellow', proxyActionId: action.id, draftType: opts.draftType },
      tokensUsed: 120,
    };
  } catch (e) {
    return { ok: false, error: `起草失败: ${(e as Error).message}`, tokensUsed: 60 };
  }
}

export const PersonaDraftReportSkill: Skill<
  { title: string; body: string; period?: string },
  unknown
> = {
  id: 'persona.draft_report',
  description:
    '替员工起草一份周报/日报/汇报草稿, 落成待本人确认的代行 (24h), 不立即对外发送. 用于员工说"帮我起草本周周报"等.',
  tags: ['周报', '日报', '汇报', '报告', '起草', '草稿', '代行', '写'],
  zone: 'yellow',
  proxyAllowed: true,
  estimatedTokens: 250,
  schema: {
    type: 'function',
    function: {
      name: 'persona_draft_report',
      description:
        '起草一份周报/日报/汇报草稿 (markdown). 落成待本人确认的代行, 不立即对外发送, 员工可在工作台确认或否决.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '草稿标题, 如 "第 24 周周报"' },
          body: { type: 'string', description: '完整草稿正文 (markdown, 含进展/风险/下步)' },
          period: { type: 'string', description: '周期标识, 如 "2026-W24" (可选)' },
        },
        required: ['title', 'body'],
      },
    },
  },
  async execute({ title, body, period }, ctx) {
    return routeDraft({ title, body, draftType: 'report', metadata: period ? { period } : undefined }, ctx);
  },
};

export const PersonaDraftActionItemsSkill: Skill<
  { title: string; items: string[]; context?: string },
  unknown
> = {
  id: 'persona.draft_action_items',
  description:
    '替员工把一段讨论/会议/对话整理成行动项清单草稿, 落成待本人确认的代行 (24h). 用于员工说"帮我把这次讨论拟成待办"等.',
  tags: ['行动项', 'action item', '待办', '任务清单', '整理', '起草', '代行', '写'],
  zone: 'yellow',
  proxyAllowed: true,
  estimatedTokens: 250,
  schema: {
    type: 'function',
    function: {
      name: 'persona_draft_action_items',
      description:
        '把讨论整理成行动项清单草稿. items 为逐条行动项 (建议含负责人/期限). 落成待本人确认的代行, 不立即派发.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '清单标题, 如 "渠道复盘会 · 行动项"' },
          items: {
            type: 'array',
            items: { type: 'string' },
            description: '逐条行动项 (一条一项, 建议含负责人/期限)',
          },
          context: { type: 'string', description: '来源背景 (可选, 给本人看)' },
        },
        required: ['title', 'items'],
      },
    },
  },
  async execute({ title, items, context }, ctx) {
    const list = Array.isArray(items) ? items.filter((s) => typeof s === 'string' && s.trim()) : [];
    if (list.length === 0) {
      return { ok: false, error: 'items 至少需要一条行动项', tokensUsed: 30 };
    }
    const body = list.map((it, i) => `${i + 1}. ${it.trim()}`).join('\n');
    return routeDraft({ title, body, draftType: 'action_items', metadata: context ? { context } : undefined }, ctx);
  },
};

/** 起草类写动作白名单 (内容草稿, 不经 ontology)。 */
export const PERSONA_DRAFT_SKILL_IDS = [
  PersonaDraftReportSkill.id,
  PersonaDraftActionItemsSkill.id,
] as const;

/** 搭子写动作工具白名单 (供 personaActPass 的 tool-loop 使用)。 */
export const PERSONA_WRITE_SKILL_IDS = [
  OkrCheckinProposeSkill.id,
  OkrObjectiveCheckinProposeSkill.id,
  PersonaProposeActionSkill.id,
  ...PERSONA_DRAFT_SKILL_IDS,
] as const;
