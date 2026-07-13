/**
 * lib/persona/expert-panel.ts · C 专家团: 多分身受控并行起草 (2026-06-15)
 *
 * ─────────────────────────────────────────────────────────
 * 对位 WorkBuddy「召唤 AI 专家团」, 但本质差异 (护城河):
 *   - WorkBuddy: 个人主权, 专家团自由执行、端到端落地。
 *   - Tandem: 专家 = 员工本人分身的多个**专业视角** (非自由 agent), 受「受控铁律」约束 ——
 *     只产出草稿供本人合稿审定, 不替员工承诺/对外发送/拍板, 须服务公司 OKR, 红区硬禁。
 *
 * 机制: 一个议题 → 选定若干专业视角 → 并行各起一份草稿 (Promise.all, 每个 fail-soft) →
 *       员工在工作台合稿 → 经 DeliverCard 受治理交付 (议事室/Memory/IM)。
 *
 * 诚实边界: 这里只做"并行生成草稿文本", 不创建 ProxyAction、不写任何业务库。
 *           真正的"动手"在员工合稿后经 DeliverCard / 起草类 ProxyAction (A) 走治理。
 */

import { getRouter } from '../boot';
import { getStore } from '../storage/repository';
import { getPrimaryPersona, listSkillPersonas } from './persona-lookup';
import { governedChat } from '../governance/governed-chat';

export interface ExpertMode {
  id: string;
  label: string;
  /** 该视角的专业聚焦 (注入 system prompt) */
  lens: string;
}

/** 5 个专业视角 (与工作台 PersonaCard 的技能模式对齐)。 */
export const EXPERT_MODES: ExpertMode[] = [
  { id: 'design', label: '设计', lens: '用户体验与产品设计视角: 关注可用性、信息架构、交互细节、视觉一致性。' },
  { id: 'pm', label: 'PM', lens: '产品管理视角: 关注需求优先级、范围与排期、验收标准、用户价值与取舍。' },
  { id: 'tech', label: '技术', lens: '工程技术视角: 关注可行性、架构与依赖、风险与工作量、实现路径与技术债。' },
  { id: 'marketing', label: '营销', lens: '市场营销视角: 关注目标人群、定位与卖点、渠道与话术、转化与增长。' },
  { id: 'strategy', label: '战略', lens: '战略视角: 关注与公司 OKR 的对齐、长期取舍、资源杠杆、竞争与护城河。' },
];

/** 受控铁律 (§19.5): 每个专家视角共享的约束前缀。 */
const CONTROLLED_PREAMBLE = [
  '你是某员工 AI 分身的一个「专业视角」, 不是自由 agent。铁律:',
  '1. 只产出草稿供本人审定与合稿, 绝不替员工做承诺、对外发送、或代为拍板。',
  '2. 所有建议须服务公司 OKR / 战略, 不偏离战略红线。',
  '3. 绝不碰薪资 / 裁员 / 法律 / 资金等红区事项。',
  '4. 诚实标注不确定与假设, 不编造数据或事实。',
  '输出要求: 直接给出该视角下的草稿正文 (markdown), 简洁有据, 控制在 400 字内, 不要寒暄或自我介绍。',
].join('\n');

export interface ExpertDraft {
  mode: string;
  label: string;
  ok: boolean;
  draft: string;
  error?: string;
}

export interface ExpertPanelResult {
  topic: string;
  drafts: ExpertDraft[];
  latencyMs: number;
}

function coerceContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'object' && p && 'text' in p ? String((p as { text?: unknown }).text ?? '') : ''))
      .join('');
  }
  return '';
}

/**
 * 并行运行专家团: 对每个选定视角生成一份草稿。
 * fail-soft: 单个视角失败不影响其它; 全部失败返回各自 error。有界 maxTokens。
 */
export async function runExpertPanel(
  topic: string,
  modeIds: string[],
  opts?: { tenantId?: string; actorUserId?: string; maxTokensPerExpert?: number },
): Promise<ExpertPanelResult> {
  const t0 = Date.now();
  const cleanTopic = (topic ?? '').trim();
  const selected = EXPERT_MODES.filter((m) => modeIds.includes(m.id));

  if (!cleanTopic || selected.length === 0) {
    return { topic: cleanTopic, drafts: [], latencyMs: Date.now() - t0 };
  }

  const router = getRouter();
  const maxTokens = opts?.maxTokensPerExpert ?? 700;

  const drafts = await Promise.all(
    selected.map(async (mode): Promise<ExpertDraft> => {
      try {
        // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: expert-panel 多角色并行草稿，无用户 session；待接入 governedChat 需拆分 actorUserId 映射
        const res = await router.chat({
          scenario: 'high_frequency',
          maxTokens,
          temperature: 0.5,
          messages: [
            { role: 'system', content: `${CONTROLLED_PREAMBLE}\n\n你的专业视角: ${mode.label}。${mode.lens}` },
            { role: 'user', content: `议题:\n${cleanTopic}\n\n请从「${mode.label}」视角起一份草稿。` },
          ],
          metadata: { userId: opts?.actorUserId, requestId: `expert-panel:${mode.id}` },
        });
        const draft = coerceContent(res.message.content).trim();
        if (!draft) return { mode: mode.id, label: mode.label, ok: false, draft: '', error: '空草稿' };
        return { mode: mode.id, label: mode.label, ok: true, draft };
      } catch (e) {
        return { mode: mode.id, label: mode.label, ok: false, draft: '', error: (e as Error).message };
      }
    }),
  );

  return { topic: cleanTopic, drafts, latencyMs: Date.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// M3 · 战斗小组编排 (分身编队 B-037): 主分身 dispatch 真实技能分身实体
//
// 与 runExpertPanel (同分身多"视角") 的本质差异:
//   - 这里 dispatch 给员工**真实的技能分身实体** (kind='skill'), 各自带
//     从 AgentTemplate fork 来的 basePrompt + 独立进化出的 styleProfile/stage。
//   - 主分身 (班长) 汇总合稿; 草稿被采纳时调 recordSkillPersonaAdoption 回流 (独立进化燃料)。
// 受控铁律不变: 只产草稿, 不写库、不对外、不拍板; 红区硬禁; 服务 OKR。
// ═══════════════════════════════════════════════════════════════════════════

export interface SquadDraft {
  /** 起草的技能分身 id (采纳时用于回流 recordSkillPersonaAdoption) */
  personaId: string;
  specialty: string;
  templateName?: string;
  stage: string;
  ok: boolean;
  draft: string;
  error?: string;
}

export interface SquadPanelResult {
  topic: string;
  userId: string;
  /** 班长 (主分身) id, 用于合稿归属 */
  primaryPersonaId: string | null;
  drafts: SquadDraft[];
  latencyMs: number;
}

/**
 * 战斗小组并行起草: 主分身把议题派给员工的技能分身实体, 各起一份草稿。
 * fail-soft: 单个分身失败不影响其它; 无技能分身或空议题返回空。有界 maxTokens。
 * @param opts.personaIds 限定只用哪些技能分身 (缺省=全部技能分身)
 */
export async function runSquadPanel(
  userId: string,
  topic: string,
  opts?: { personaIds?: string[]; tenantId?: string; maxTokensPerExpert?: number },
): Promise<SquadPanelResult> {
  const t0 = Date.now();
  const cleanTopic = (topic ?? '').trim();
  const primary = await getPrimaryPersona(userId);

  let skills = await listSkillPersonas(userId);
  if (opts?.personaIds && opts.personaIds.length > 0) {
    const set = new Set(opts.personaIds);
    skills = skills.filter((p) => set.has(p.id));
  }

  if (!cleanTopic || skills.length === 0) {
    return {
      topic: cleanTopic,
      userId,
      primaryPersonaId: primary?.id ?? null,
      drafts: [],
      latencyMs: Date.now() - t0,
    };
  }

  const store = getStore();
  const maxTokens = opts?.maxTokensPerExpert ?? 700;

  const drafts = await Promise.all(
    skills.map(async (persona): Promise<SquadDraft> => {
      const specialty = persona.specialty ?? '通用';
      try {
        // 取模板 basePrompt (技能分身的专业人格基底)
        let basePrompt = '';
        let templateName: string | undefined;
        if (persona.templateId) {
          const tpl = await store.agentTemplates.get(persona.templateId);
          if (tpl) {
            basePrompt = tpl.basePrompt;
            templateName = tpl.name;
          }
        }
        const styleHint = `你的沟通风格: ${persona.styleProfile?.communicationStyle ?? 'analytical'}。`;
        const basePersonaPrompt = [
          CONTROLLED_PREAMBLE,
          `你的专业域: ${specialty}${templateName ? ` (${templateName})` : ''}。`,
          basePrompt ? `专业人格基线:\n${basePrompt}` : '',
          styleHint,
        ]
          .filter(Boolean)
          .join('\n\n');

        // 走统一治理出口: 注入企业基线/OKR锚/价值观锚 + 手抄语料(方案丙按 personaId 定向) + 红线 HARD_BLOCK。
        // 草稿阶段跳过输出闸 (合稿/交付时再治理), 但输入闸红线仍一票否决。
        const gc = await governedChat({
          actorUserId: userId,
          personaId: persona.id,
          intent: cleanTopic,
          basePersonaPrompt,
          messages: [
            { role: 'user', content: `议题:\n${cleanTopic}\n\n请从你的专业域起一份草稿。` },
          ],
          agentKind: 'skill',
          scenario: 'high_frequency',
          temperature: 0.5,
          maxTokens,
          skipOutputGuard: true,
          metadata: { userId, requestId: `squad-panel:${persona.id}` },
        });
        if (!gc.ok) {
          return {
            personaId: persona.id,
            specialty,
            templateName,
            stage: persona.stage,
            ok: false,
            draft: '',
            error: gc.blocked?.reasons.join('; ') ?? '被治理拦截',
          };
        }
        const draft = (gc.answer ?? '').trim();
        if (!draft) {
          return { personaId: persona.id, specialty, templateName, stage: persona.stage, ok: false, draft: '', error: '空草稿' };
        }
        return { personaId: persona.id, specialty, templateName, stage: persona.stage, ok: true, draft };
      } catch (e) {
        return { personaId: persona.id, specialty, stage: persona.stage, ok: false, draft: '', error: (e as Error).message };
      }
    }),
  );

  return {
    topic: cleanTopic,
    userId,
    primaryPersonaId: primary?.id ?? null,
    drafts,
    latencyMs: Date.now() - t0,
  };
}

export interface ConsolidateResult {
  ok: boolean;
  consolidated: string;
  /** 参与合稿 (草稿被纳入) 的技能分身 id — 供采纳回流 */
  contributingPersonaIds: string[];
  error?: string;
}

/**
 * 主分身 (班长) 合稿: 把技能分身的多份草稿合成一份连贯、去重、可执行的合稿。
 * 只合并 ok 的草稿; 无可用草稿返回 error。受控铁律不变 (只产文本)。
 */
export async function consolidateSquadDrafts(
  userId: string,
  topic: string,
  drafts: SquadDraft[],
  opts?: { maxTokens?: number },
): Promise<ConsolidateResult> {
  const oks = drafts.filter((d) => d.ok && d.draft.trim());
  const contributingPersonaIds = oks.map((d) => d.personaId);
  if (oks.length === 0) {
    return { ok: false, consolidated: '', contributingPersonaIds: [], error: '无可合稿的草稿' };
  }
  const primary = await getPrimaryPersona(userId);
  try {
    const body = oks.map((d) => `【${d.specialty}】\n${d.draft}`).join('\n\n---\n\n');
    // 合稿由主分身(班长)产出, 走统一治理出口: 企业基线 + 手抄语料(主分身口径) + 红线。
    const gc = await governedChat({
      actorUserId: userId,
      personaId: primary?.id,
      intent: topic,
      basePersonaPrompt: `${CONTROLLED_PREAMBLE}\n\n你是主分身(班长), 负责把技能分身的多份草稿合成一份连贯、去重、可执行的合稿。保留各专业域要点, 明确标注分歧与取舍。`,
      messages: [
        { role: 'user', content: `议题:\n${topic}\n\n各技能分身草稿:\n${body}\n\n请合成一份合稿。` },
      ],
      agentKind: 'persona',
      scenario: 'high_frequency',
      temperature: 0.4,
      maxTokens: opts?.maxTokens ?? 900,
      skipOutputGuard: true,
      metadata: { userId, requestId: `squad-consolidate:${userId}` },
    });
    if (!gc.ok) {
      return {
        ok: false,
        consolidated: '',
        contributingPersonaIds,
        error: gc.blocked?.reasons.join('; ') ?? '合稿被治理拦截',
      };
    }
    const consolidated = (gc.answer ?? '').trim();
    if (!consolidated) {
      return { ok: false, consolidated: '', contributingPersonaIds, error: '空合稿' };
    }
    return { ok: true, consolidated, contributingPersonaIds };
  } catch (e) {
    return { ok: false, consolidated: '', contributingPersonaIds, error: (e as Error).message };
  }
}
