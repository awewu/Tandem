/**
 * lib/persona/reflexion.ts · 搭子真学习 (B-024 Reflexion · 2026-06-08)
 *
 * ─────────────────────────────────────────────────────────
 * 解决的缺口 (CENTRAL-AI-ARCHITECTURE §B-024「假学习」):
 *   旧状态: learning-collector.ingestDecisionCard 只做纯计数器累加
 *           (totalDecisions / vetoRate / styleProfile), 没有「为什么被否」「下次怎么改」
 *           的归因, 分身永远学不到具体教训 → 同一种错误反复犯。
 *
 * 本模块 (Reflexion, Shinn et al. 2023):
 *   1. 反思 (reflect): 当一次决议拿到**结果反馈** (被员工否决 / 员工弃 AI 选项改用原创 D /
 *      复盘回填 learning) 时, 用 LLM 生成一段**语言化自省** —— 我当时建议了什么、
 *      实际结果是什么、差异根因、下次具体怎么改 (actionable hint)。
 *   2. 存储 (store): 自省落库为该员工的**个人情景记忆** (type='lesson', kind='episodic',
 *      ownershipLevel='personal', tags 含 'reflexion'), 不进公司签批门 (是分身私货, 不是组织真理)。
 *   3. 召回 (retrieve): 分身下次回复前, 把相关自省作为「self-hint」注入 systemPrompt,
 *      让分身带着过去的教训作答 —— 这才是「越用越懂老板」的真闭环。
 *
 * 诚实边界:
 *   - 自省只写**个人** memory (ownerUserId 本人 + 主管可见), 绝不自动升级为公司 Memory。
 *   - 全程 fail-soft: 反思/召回任何异常都不阻塞主流程 (决议提交 / IM 回复)。
 *   - 只在**有结果反馈**时反思 (反 reward hacking: 没有失败/差异信号就不臆造教训)。
 */

import { getStore } from '../storage/repository';
import { generateId } from '../storage/repository';
import { logger } from '../infra/logger';
import type { DecisionCard } from '../types/decision-card';
import type { Persona } from '../types/persona';
import type { MemoryEntry } from '../types/memory';

/** 自省记忆的标签 (召回时按此过滤) */
export const REFLEXION_TAG = 'reflexion';
/** 单个员工保留的自省上限 (超出按时间淘汰最旧) */
export const REFLEXION_RETENTION_CAP = 200;
/** 召回默认条数 */
const DEFAULT_HINT_LIMIT = 3;

export type ReflexionTrigger =
  | 'veto' // 员工 24h 内否决了 AI 提交的决议 (最强失败信号)
  | 'rejected_for_original' // 员工弃 AI 选项 (A/B/C) 改用自己原创 D
  | 'retrospective'; // 复盘回填了 actualOutcome / learning

/**
 * B-024 结构化反推 · 教训分类 (2026-06-09).
 * LLM 反思后必须把这次失败归到一个类别, 才能被下游消费:
 *   - skill_misuse → 未来用 analyzeSkillMisusePattern() 聚合, 命中阈值后建议卸该 skill (B-024 mutate 路径, 后续 sprint)
 *   - okr_drift   → 喂给 B-025 战略引擎, 提示该分身偏离当前 OKR
 *   - knowledge_gap → 提示员工补 Persona Knowledge (B-021, 已降级, 暂只标记)
 *   - judgment    → 单纯判断失误, 无法机器修, 仅供员工 review
 *   - other       → 兜底
 */
export type ReflexionCategory =
  | 'skill_misuse'
  | 'okr_drift'
  | 'knowledge_gap'
  | 'judgment'
  | 'other';

export interface ReflexionResult {
  reflected: boolean;
  trigger?: ReflexionTrigger;
  memoryId?: string;
  lesson?: string;
  hint?: string;
  /** B-024 结构化反推: LLM 给出的失败类别, 供下游 (B-025 realign / 自动卸 skill) 聚合 */
  category?: ReflexionCategory;
  /** 当 category=skill_misuse 时, LLM 指出涉嫌被误用的 skill id (best-effort, 可空) */
  skillId?: string;
  reason: string;
}

/**
 * 判定一次决议是否携带「结果反馈」, 值得反思。
 * 返回 null 表示无信号 (不反思)。
 */
export function detectReflexionTrigger(card: DecisionCard): ReflexionTrigger | null {
  if (card.convergenceState === 'VETOED') return 'veto';
  const hasRetro =
    !!card.retrospective &&
    (!!card.retrospective.actualOutcome?.trim() || !!card.retrospective.learning?.trim());
  if (hasRetro) return 'retrospective';
  // 员工弃 AI 推演/SOP/历史选项, 选自己原创 D → AI 的建议没被采纳 (弱失败信号)
  if (card.selected === 'D' && card.convergenceState === 'COMMIT') {
    const aiOptions = (card.options ?? []).filter((o) => o.id !== 'D');
    if (aiOptions.length > 0) return 'rejected_for_original';
  }
  return null;
}

/**
 * 对一次决议做语言化反思并落库 (B-024 核心).
 * fail-soft: 永不抛。无结果反馈信号时直接跳过。
 *
 * @param card    已结束的决议卡 (COMMIT / VETOED)
 * @param persona 决议归属的分身 (可选; 不传则按 card.createdBy 查)
 */
export async function reflectOnDecision(
  card: DecisionCard,
  persona?: Persona,
): Promise<ReflexionResult> {
  const trigger = detectReflexionTrigger(card);
  if (!trigger) return { reflected: false, reason: 'no-outcome-signal' };

  try {
    const store = getStore();
    let p = persona;
    if (!p) {
      const personas = await store.personas.list({ userId: card.createdBy } as never);
      p = personas[0];
    }
    if (!p || !p.learningActive) {
      return { reflected: false, trigger, reason: 'no-active-persona' };
    }

    const { lesson, hint, category, skillId } = await generateReflectionText(card, trigger);
    if (!lesson.trim() && !hint.trim()) {
      return { reflected: false, trigger, reason: 'empty-reflection' };
    }

    const now = new Date().toISOString();
    // B-024 结构化反推 · tags 增量: category:xxx 必填, skill:xxx 仅当 LLM 给出 skillId
    const tags = [REFLEXION_TAG, `trigger:${trigger}`, `category:${category}`];
    if (skillId && skillId.trim()) tags.push(`skill:${skillId.trim()}`);

    const entry: MemoryEntry = {
      id: generateId('reflexion'),
      type: 'lesson',
      kind: 'episodic',
      title: `自省: ${card.title}`.slice(0, 120),
      body: formatReflectionBody(card, trigger, lesson, hint, category, skillId),
      status: 'active',
      signers: [],
      ownershipLevel: 'personal',
      ownerUserId: p.userId,
      agentId: p.id,
      referenceCount: 0,
      tags,
      priority: trigger === 'veto' ? 'high' : 'medium',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    // 直接同步落库 (反思低频, 只在被否/复盘时触发; 立即可被 retrieve 读到).
    await store.memories.create(entry as never);
    await pruneOldReflections(p.userId);

    return {
      reflected: true,
      trigger,
      memoryId: entry.id,
      lesson,
      hint,
      category,
      skillId: skillId || undefined,
      reason: 'ok',
    };
  } catch (err) {
    logger.warn(
      { cardId: card.id, trigger, err: (err as Error).message },
      '[reflexion] reflect failed (fail-soft)',
    );
    return { reflected: false, trigger, reason: `exception: ${(err as Error).message}` };
  }
}

/**
 * 召回该员工最相关的自省作为 self-hint (Reflexion 闭环的「读」侧).
 * fail-soft: 出错返回 []。
 */
export async function retrievePersonaSelfHints(
  userId: string,
  query: string,
  limit = DEFAULT_HINT_LIMIT,
): Promise<Array<{ id: string; title: string; body: string; score: number }>> {
  try {
    const store = getStore();
    const all = await store.memories.list();
    const mine = all.filter(
      (m: MemoryEntry) =>
        m.ownershipLevel === 'personal' &&
        m.ownerUserId === userId &&
        m.type === 'lesson' &&
        (m.tags ?? []).includes(REFLEXION_TAG) &&
        m.status === 'active' &&
        m.isActive !== false,
    );
    if (mine.length === 0) return [];

    const scored = mine
      .map((m: MemoryEntry) => ({
        id: m.id,
        title: m.title,
        body: m.body,
        score: hintScore(query, m),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // 飞轮: 被召回即 +referenceCount (验证过的教训优先)
    void Promise.all(
      scored.map((s) =>
        store.memories
          .update(s.id, {
            referenceCount:
              ((mine.find((m) => m.id === s.id)?.referenceCount ?? 0) as number) + 1,
            lastReferencedAt: new Date().toISOString(),
          } as never)
          .catch(() => {}),
      ),
    ).catch(() => {});

    return scored;
  } catch (err) {
    logger.warn({ userId, err: (err as Error).message }, '[reflexion] retrieve failed (fail-soft)');
    return [];
  }
}

/**
 * 把 self-hint 注入 systemPrompt (供 invokePersonaReply / brief 调用).
 * 无相关自省时原样返回。fail-soft。
 */
export async function injectSelfHints(
  systemPrompt: string,
  userId: string,
  query: string,
  limit = DEFAULT_HINT_LIMIT,
): Promise<{ revisedSystemPrompt: string; hintCount: number }> {
  const hints = await retrievePersonaSelfHints(userId, query, limit);
  if (hints.length === 0) return { revisedSystemPrompt: systemPrompt, hintCount: 0 };

  const lines = [
    '',
    '---',
    '【过去的自省教训 · 来自你 (该分身) 历史决议的复盘, 务必避免重蹈覆辙】',
    ...hints.map((h, i) => `${i + 1}. ${h.body}`),
    '【约束】以上是你过去犯错后的自省。本轮作答前先回顾这些教训, 不要重复同类错误。',
  ];
  return {
    revisedSystemPrompt: `${systemPrompt}\n${lines.join('\n')}`,
    hintCount: hints.length,
  };
}

// ---------------------------------------------------------------------------
// 内部: LLM 生成反思文本
// ---------------------------------------------------------------------------

const REFLEXION_SYSTEM = [
  '你是一个 AI 工作分身的「自省模块」。一次决议刚拿到结果反馈, 你要为分身本人写一段简短、诚实、可执行的自省。',
  '只输出 JSON, 严格 schema:',
  '{',
  '  "lesson": "<这次发生了什么 + 根因, 1-2 句, 对事不对人>",',
  '  "hint": "<下次遇到同类情况的具体行动建议, 1 句, 必须可执行而非空话>",',
  '  "category": "<skill_misuse | okr_drift | knowledge_gap | judgment | other>",',
  '  "skillId": "<可选, 仅当 category=skill_misuse 时填. 涉嫌被误用的 skill id, 如 web.search / okr.health_digest>"',
  '}',
  'category 选择规则:',
  '  - skill_misuse: 该分身调用了不该调的工具/skill, 或调了对的 skill 但用法错',
  '  - okr_drift:   该决议偏离了当前 OKR 主题, 不该花时间做',
  '  - knowledge_gap: 缺乏关键事实/资料, 凭空推测导致错',
  '  - judgment:    资料齐, 工具用对, 但判断失误 (不可机器修)',
  '  - other:       不属上述任一',
  '要求: 诚实归因 (承认分身判断的不足), 不甩锅给员工; hint 必须具体 (如"涉及预算>10万先确认 ROI 再提交"), 禁止"要更谨慎"这类空话。',
].join('\n');

const VALID_CATEGORIES: ReadonlySet<ReflexionCategory> = new Set<ReflexionCategory>([
  'skill_misuse',
  'okr_drift',
  'knowledge_gap',
  'judgment',
  'other',
]);

function normalizeCategory(raw: unknown): ReflexionCategory {
  if (typeof raw !== 'string') return 'other';
  const v = raw.trim().toLowerCase();
  return VALID_CATEGORIES.has(v as ReflexionCategory) ? (v as ReflexionCategory) : 'other';
}

const TRIGGER_DESC: Record<ReflexionTrigger, string> = {
  veto: '员工在 24h 否决窗口内撤回了我 (AI 分身) 提交的这个决议。',
  rejected_for_original: '我生成了 A/B/C 选项, 但员工全弃用, 自己写了原创方案 D 并采纳。说明我的选项没切中。',
  retrospective: '这个决议已复盘, 回填了实际结果。',
};

/**
 * 解析 router: 优先 globalThis.__tandem_router__ (测试 / 已 boot), 避免 import 整条 boot
 * 链 (boot → drizzle-store → drizzle-client 在 DATABASE_URL 缺省时模块级抛错).
 * 与 governance/governed-chat.resolveRouter 同模式。
 */
async function resolveRouter() {
  const g = globalThis as { __tandem_router__?: { chat: (...a: never[]) => unknown } };
  if (g.__tandem_router__) return g.__tandem_router__;
  const { getRouter } = await import('@/lib/boot');
  return getRouter();
}

async function generateReflectionText(
  card: DecisionCard,
  trigger: ReflexionTrigger,
): Promise<{ lesson: string; hint: string; category: ReflexionCategory; skillId: string }> {
  const router = (await resolveRouter()) as { chat: (req: unknown) => Promise<{ message: { content: unknown } }> };

  const selectedOpt = (card.options ?? []).find((o) => o.id === card.selected);
  const aiRecommended = (card.options ?? []).find((o) => o.id === 'B') ?? (card.options ?? [])[0];

  const userPrompt = [
    `## 决议标题\n${card.title}`,
    `## 结果反馈类型\n${TRIGGER_DESC[trigger]}`,
    aiRecommended
      ? `## 我 (AI) 当时主推的选项\n[${aiRecommended.id}/${aiRecommended.type}] ${aiRecommended.description}${aiRecommended.reasoning ? `\n理由: ${aiRecommended.reasoning}` : ''}`
      : '',
    selectedOpt
      ? `## 最终被选中的选项\n[${selectedOpt.id}/${selectedOpt.type}] ${selectedOpt.description}`
      : card.selected
        ? `## 最终选择\n选项 ${card.selected}`
        : '',
    card.retrospective?.actualOutcome
      ? `## 实际结果\n${card.retrospective.actualOutcome}`
      : '',
    card.retrospective?.learning ? `## 复盘记录的教训\n${card.retrospective.learning}` : '',
    '',
    '请输出自省 JSON:',
  ]
    .filter(Boolean)
    .join('\n\n');

  // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: reflexion 是系统内部自省，无用户 session，不需要 persona baseline 闸；迁移至 governedChat 需引入 actorUserId=actorId
  const res = await router.chat({
    messages: [
      { role: 'system', content: REFLEXION_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    scenario: 'reasoning_complex',
    temperature: 0.3,
    maxTokens: 400,
    responseFormat: 'json',
  });

  const raw = res.message.content;
  const content = typeof raw === 'string' ? raw : '{}';
  try {
    const parsed = JSON.parse(extractJson(content)) as {
      lesson?: string;
      hint?: string;
      category?: string;
      skillId?: string;
    };
    return {
      lesson: (parsed.lesson ?? '').trim(),
      hint: (parsed.hint ?? '').trim(),
      category: normalizeCategory(parsed.category),
      skillId: (parsed.skillId ?? '').trim(),
    };
  } catch {
    // 解析失败 → 退化为整段文本当 lesson (仍比丢弃强), category 兜底 'other'
    return { lesson: content.trim().slice(0, 500), hint: '', category: 'other', skillId: '' };
  }
}

function formatReflectionBody(
  card: DecisionCard,
  trigger: ReflexionTrigger,
  lesson: string,
  hint: string,
  category: ReflexionCategory,
  skillId: string,
): string {
  const catLabel = `[分类] ${category}${category === 'skill_misuse' && skillId ? ` (skill=${skillId})` : ''}`;
  const parts = [
    `[场景] ${card.title} (反馈: ${trigger})`,
    catLabel,
    lesson ? `[教训] ${lesson}` : '',
    hint ? `[下次怎么做] ${hint}` : '',
  ].filter(Boolean);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// B-024 结构化反推 · 聚合 API (供下游消费, 数据收集层. mutate 路径在后续 sprint)
// ---------------------------------------------------------------------------

export interface ReflexionPatternSummary {
  /** 按 category 计数 */
  byCategory: Record<ReflexionCategory, number>;
  /** skill_misuse 类别下, 每个 skill 出现频次 (按 skillId 聚合) */
  skillMisuseCounts: Array<{ skillId: string; count: number }>;
  /** 窗口内自省总数 */
  total: number;
  /** 窗口起始时间 (ISO) */
  windowStart: string;
}

/**
 * 聚合某员工自省模式: 用于回答"我哪个 skill 被误用最多 / 是否漂离 OKR"。
 *
 * 用法:
 *   - B-025 战略引擎: byCategory.okr_drift ≥ 阈值 → 触发 realignPersonaToOkr
 *   - 自动卸 skill (后续 sprint): skillMisuseCounts[i].count ≥ 3 → 写 ProxyAction 提议从 enabledSkills 移除
 *   - /admin/persona-evolution 看板: 直接展示
 *
 * fail-soft: 出错返回空 summary。
 *
 * @param userId   员工 id
 * @param windowDays  时间窗口 (默认 30 天)
 */
export async function analyzeReflexionPatterns(
  userId: string,
  windowDays = 30,
): Promise<ReflexionPatternSummary> {
  const empty: ReflexionPatternSummary = {
    byCategory: { skill_misuse: 0, okr_drift: 0, knowledge_gap: 0, judgment: 0, other: 0 },
    skillMisuseCounts: [],
    total: 0,
    windowStart: new Date(Date.now() - windowDays * 86400_000).toISOString(),
  };
  try {
    const store = getStore();
    const all = await store.memories.list();
    const since = Date.now() - windowDays * 86400_000;
    const mine = all.filter(
      (m: MemoryEntry) =>
        m.ownershipLevel === 'personal' &&
        m.ownerUserId === userId &&
        m.type === 'lesson' &&
        (m.tags ?? []).includes(REFLEXION_TAG) &&
        new Date(m.createdAt ?? 0).getTime() >= since,
    );
    if (mine.length === 0) return empty;

    const skillCounter = new Map<string, number>();
    const summary: ReflexionPatternSummary = { ...empty, total: mine.length };
    summary.byCategory = { skill_misuse: 0, okr_drift: 0, knowledge_gap: 0, judgment: 0, other: 0 };

    for (const m of mine) {
      // tags 形如 [REFLEXION_TAG, 'trigger:veto', 'category:skill_misuse', 'skill:web.search']
      const catTag = (m.tags ?? []).find((t) => t.startsWith('category:'));
      const cat = catTag ? normalizeCategory(catTag.slice('category:'.length)) : 'other';
      summary.byCategory[cat] = (summary.byCategory[cat] ?? 0) + 1;

      if (cat === 'skill_misuse') {
        const skillTag = (m.tags ?? []).find((t) => t.startsWith('skill:'));
        if (skillTag) {
          const sid = skillTag.slice('skill:'.length);
          skillCounter.set(sid, (skillCounter.get(sid) ?? 0) + 1);
        }
      }
    }

    summary.skillMisuseCounts = Array.from(skillCounter.entries())
      .map(([skillId, count]) => ({ skillId, count }))
      .sort((a, b) => b.count - a.count);

    return summary;
  } catch (err) {
    logger.warn(
      { userId, err: (err as Error).message },
      '[reflexion] analyzeReflexionPatterns failed (fail-soft)',
    );
    return empty;
  }
}

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/** 关键词重叠 + 近因加权 (轻量, 无 embedding 依赖, 测试可复现) */
function hintScore(query: string, m: MemoryEntry): number {
  const overlap = keywordOverlap(query, `${m.title}\n${m.body}`);
  // 近因: 30 天内线性衰减到 0, 最高 +0.2
  const ageDays = (Date.now() - new Date(m.updatedAt ?? m.createdAt).getTime()) / 86400_000;
  const recency = Math.max(0, 0.2 * (1 - ageDays / 30));
  // 引用加权: 验证过的教训略上浮 (上限 +0.1)
  const refBoost = Math.min(0.1, (m.referenceCount ?? 0) * 0.02);
  return overlap + recency + refBoost;
}

function keywordOverlap(query: string, doc: string): number {
  const tokenize = (t: string): string[] => {
    const out: string[] = [];
    const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(t)) !== null) out.push((mt[1] ?? mt[2]).toLowerCase());
    return out;
  };
  const q = Array.from(new Set(tokenize(query)));
  const d = new Set(tokenize(doc));
  if (q.length === 0 || d.size === 0) return 0;
  let hits = 0;
  for (const tok of q) if (d.has(tok)) hits++;
  return hits / q.length;
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

/** 超出保留上限时淘汰最旧自省 (按 createdAt) */
async function pruneOldReflections(userId: string): Promise<void> {
  try {
    const store = getStore();
    const all = await store.memories.list();
    const mine = all
      .filter(
        (m: MemoryEntry) =>
          m.ownershipLevel === 'personal' &&
          m.ownerUserId === userId &&
          m.type === 'lesson' &&
          (m.tags ?? []).includes(REFLEXION_TAG),
      )
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
    const excess = mine.length - REFLEXION_RETENTION_CAP;
    if (excess <= 0) return;
    for (const m of mine.slice(0, excess)) {
      await store.memories.delete(m.id).catch(() => {});
    }
  } catch {
    /* fail-soft */
  }
}
