/**
 * 场景 → prompt 簇派生 + 选题商业价值打分（GTM 战略分析层 · GEO 选题上游）
 *
 * 背景：消费者不问"变频参数"，而是问"北方老房没地暖怎么改""回南天太潮怎么办"。
 * **场景即 prompt**；且角色不同问法不同（业主/装修公司/设计师/安装工），AI 答案也不同。
 *
 * 设计要点：
 *  - 模板只做"骨架"，填充词来自场景字段 → **换品类只换填充词**，新品牌/品类零人工获得初始选题
 *    （这是新增品牌/品类后自循环能起转的关键：闭环不缺输入）。
 *  - 缺少必需字段的模板自动跳过，绝不产出"{houseType}"这类未填充占位问句。
 *  - 打分透明可解释：意向强度为主导因子，具体度与我方胜算为辅。
 *
 * ⚠️ 诚实边界：真实搜索量/提问频次目前没有数据源，故**不臆造热度因子**；
 * 打分只用可得的三项（意向/具体度/胜算），接入真实频次后再扩展。
 */

export type ScenarioAudience = 'owner' | 'decorator' | 'designer' | 'installer';
export type ScenarioIntent = 'info' | 'compare' | 'decide';
export type QuestionStage = 'pre' | 'mid' | 'post' | 'followup';

export interface ScenarioSeed {
  category: string;
  audience: ScenarioAudience;
  painPoint: string;
  houseType?: string | null;
  climateZone?: string | null;
  intent: ScenarioIntent;
}

interface Template {
  id: string;
  /** 该模板产出问题的意向层级（决定打分，与场景自身 intent 独立） */
  intent: ScenarioIntent;
  stage: QuestionStage;
  /** 缺这些字段则跳过本模板（防止产出未填充占位） */
  requires: Array<'houseType' | 'climateZone'>;
  /** 限定角色；缺省=适用全部角色 */
  audiences?: ScenarioAudience[];
  render: (s: ScenarioSeed) => string;
}

/** 场景骨架模板库（品类无关，靠填充词适配任意品类）。 */
export const SCENARIO_TEMPLATES: Template[] = [
  // ── 信息型（认知阶段）
  { id: 'cause', intent: 'info', stage: 'pre', requires: [],
    render: (s) => `${s.category}${s.painPoint}是什么原因？` },
  { id: 'fit-house', intent: 'info', stage: 'pre', requires: ['houseType'],
    render: (s) => `${s.houseType}适合装${s.category}吗？` },
  { id: 'zone-effect', intent: 'info', stage: 'pre', requires: ['climateZone'],
    render: (s) => `${s.climateZone}地区用${s.category}效果怎么样？` },

  // ── 对比型（评估阶段，AI 最常被问）
  { id: 'how-to-choose', intent: 'compare', stage: 'mid', requires: [],
    render: (s) => `${s.category}怎么选才能解决${s.painPoint}？` },
  { id: 'zone-type', intent: 'compare', stage: 'mid', requires: ['climateZone'],
    render: (s) => `${s.climateZone}地区${s.category}选哪种类型好？` },
  { id: 'house-type', intent: 'compare', stage: 'mid', requires: ['houseType'],
    render: (s) => `${s.houseType}装${s.category}选什么类型合适？` },
  { id: 'vs-alternative', intent: 'compare', stage: 'mid', requires: [],
    render: (s) => `解决${s.painPoint}，${s.category}和其他方案哪个更合适？` },

  // ── 决策型（购买阶段，意向最强）
  { id: 'cost', intent: 'decide', stage: 'post', requires: ['houseType'],
    render: (s) => `${s.houseType}装${s.category}大概要多少钱？` },
  { id: 'regret', intent: 'decide', stage: 'post', requires: [],
    render: (s) => `${s.category}装了会后悔吗？有哪些坑？` },
  { id: 'zone-house-pick', intent: 'decide', stage: 'post', requires: ['climateZone', 'houseType'],
    render: (s) => `${s.climateZone}${s.houseType}装${s.category}怎么选不踩坑？` },

  // ── 角色专属（问法差异 → AI 答案差异）
  { id: 'layout-reserve', intent: 'compare', stage: 'mid', requires: ['houseType'],
    audiences: ['decorator', 'designer'],
    render: (s) => `${s.houseType}的${s.category}点位和预留怎么做？` },
  { id: 'install-issue', intent: 'compare', stage: 'mid', requires: [],
    audiences: ['installer'],
    render: (s) => `${s.category}安装时${s.painPoint}怎么处理？` },
  { id: 'maintenance', intent: 'info', stage: 'followup', requires: [],
    render: (s) => `${s.category}后期维护麻烦吗？${s.painPoint}会复发吗？` },
];

const INTENT_SCORE: Record<ScenarioIntent, number> = { info: 20, compare: 50, decide: 80 };

export interface TopicScore {
  /** 0-100，越高越有商业价值 */
  score: number;
  /** 落库用的 priority：**数字越小越优先**（与 growth_geo_question 的 ASC 排序一致） */
  priority: number;
  factors: { intent: number; specificity: number; winnability: number };
}

/**
 * 选题商业价值打分。
 * score = 意向强度(主导) + 具体度 + 我方胜算；priority = 100 - score（越小越优先）。
 * @param winnability 0-20，我方胜算（由调用方按该品类我方被引率换算；未知传 10）
 */
export function scoreTopic(input: {
  intent: ScenarioIntent;
  hasHouseType?: boolean;
  hasClimateZone?: boolean;
  winnability?: number;
}): TopicScore {
  const intent = INTENT_SCORE[input.intent] ?? INTENT_SCORE.compare;
  // 具体度：更具体的问题竞争度低、意向更明确
  const specificity = (input.hasHouseType ? 8 : 0) + (input.hasClimateZone ? 8 : 0);
  const winnability = Math.min(Math.max(Number(input.winnability ?? 10), 0), 20);
  const score = Math.min(100, intent + specificity + winnability);
  const priority = Math.min(Math.max(100 - score, 1), 199);
  return { score, priority, factors: { intent, specificity, winnability } };
}

export interface DerivedTopic {
  templateId: string;
  question: string;
  stage: QuestionStage;
  intent: ScenarioIntent;
  score: number;
  priority: number;
  factors: TopicScore['factors'];
}

/** 由场景派生 prompt 簇（缺字段的模板自动跳过），按商业价值排序。 */
export function deriveTopics(seed: ScenarioSeed, opts: { winnability?: number } = {}): DerivedTopic[] {
  const has = { houseType: !!(seed.houseType || '').trim(), climateZone: !!(seed.climateZone || '').trim() };
  const out: DerivedTopic[] = [];
  for (const t of SCENARIO_TEMPLATES) {
    if (t.audiences && !t.audiences.includes(seed.audience)) continue;
    if (t.requires.some((f) => !has[f])) continue;
    const question = t.render(seed).trim();
    if (!question) continue;
    const scored = scoreTopic({
      intent: t.intent,
      hasHouseType: has.houseType,
      hasClimateZone: has.climateZone,
      winnability: opts.winnability,
    });
    out.push({
      templateId: t.id, question, stage: t.stage, intent: t.intent,
      score: scored.score, priority: scored.priority, factors: scored.factors,
    });
  }
  // 商业价值高者在前（priority 小者在前）
  return out.sort((a, b) => a.priority - b.priority || a.question.localeCompare(b.question));
}
