/**
 * OKR 批量创建服务 · "一键全景图" (vs Tita 2025 H2 #1 缺口)
 *
 * 输入: 公司战略一句话 + 周期名 + 部门列表
 * 输出: 4 套候选 OKR 全景图 (3+1 风格)
 *   A: SOP        从 OKR_TEMPLATES 库匹配最相近的模板套餐
 *   B: REASONING  LLM 根据战略推演定制
 *   C: HISTORICAL 从过往周期 Memory 提取相似成功 OKR
 *   D: ORIGINAL   留空让主管自己写 (humanOnly, 反 AI 欺诈)
 *
 * 每套候选 = 1 个公司层 Objective + N 个公司层 KR + 每部门 1 个 cascade Objective + N 个 KR
 *
 * 复用 `ThreePlusOneEngine` 的 4 选项哲学但**不直接调用** —
 * 因为该引擎是 DecisionOption 形态, 这里是 OKR 树形态.
 *
 * 路线图:
 *   - v0 (本 PR): 服务层 + API + 单测 (UI 留 backlog)
 *   - v1: SSE 流式 + UI dialog + 接 actual LLM
 *   - v2: Memory 检索 (C 选项接 retriever) + 多语言 prompt
 */

import type { TandemRouter } from '../taf/router';
import type { ChatMessage } from '../taf/provider/types';
import { OKR_TEMPLATES, type OKRTemplate } from '../okr/templates';
import { audit } from '../audit/log';

// ---------------------------------------------------------------------------
// 输入 / 输出
// ---------------------------------------------------------------------------

export type BulkCreateOptionType = 'SOP' | 'REASONING' | 'HISTORICAL' | 'ORIGINAL';

export interface BulkCreateInput {
  /** 当前周期 (display name, e.g. "2026 Q3") */
  cycleName: string;
  /** 公司一句话战略 (e.g. "本季度全力做 NRR ≥ 115%") */
  strategy: string;
  /** 部门列表 (用于生成 cascade) */
  departments: Array<{ id: string; name: string }>;
  /** 触发主管 userId (审计) */
  triggeredBy: string;
  /** 部门数量上限 (防 prompt 爆炸, 默认 8) */
  maxDepartments?: number;
}

export interface KrDraft {
  title: string;
  /** numeric / percentage / binary / milestone */
  type: 'numeric' | 'percentage' | 'binary' | 'milestone';
  startValue: number;
  targetValue: number;
  unit: string;
  /** 0-100 */
  weight: number;
  /** 推荐 initiatives (可选, 数组) */
  initiatives?: string[];
}

export interface ObjectiveDraft {
  title: string;
  description?: string;
  level: 'company' | 'team' | 'individual';
  /** 仅 cascade 层 (team/individual) 用 — 指向上级 Objective 的"序号" (1-based) */
  parentLocalIndex?: number;
  /** 部门 id (仅 team/individual) */
  ownerDepartmentId?: string;
  keyResults: KrDraft[];
}

export interface BulkCreateOption {
  /** 选项 ID (A/B/C/D) */
  id: 'A' | 'B' | 'C' | 'D';
  type: BulkCreateOptionType;
  /** 一句话描述选项思路 */
  description: string;
  /** 推荐理由 (LLM 推演逻辑 / SOP 引用 / 历史相似度 等) */
  reasoning?: string;
  /** D 选项强制 true, 此时 objectives 为空数组 */
  humanOnly?: boolean;
  /** 0-1 信心 */
  confidence: number;
  /** Objective 草稿列表 (1 个公司层 + N 个部门层) */
  objectives: ObjectiveDraft[];
  /** 选项 A 引用模板 id (审计 + 可追溯) */
  citedTemplateIds?: string[];
}

export interface BulkCreateResult {
  cycleName: string;
  strategy: string;
  options: BulkCreateOption[];
  generatedAt: string;
  /** 实际用到的 LLM model id (B/C 选项, A/D 留空) */
  modelUsed?: string;
  /** A/B/C/D 都出还是部分降级 */
  source: 'full' | 'partial' | 'fallback';
  /** 降级原因 */
  fallbackReason?: string;
}

// ---------------------------------------------------------------------------
// 模板匹配 (选项 A · SOP · 0 LLM 调用)
// ---------------------------------------------------------------------------

/**
 * 从 OKR_TEMPLATES 库挑最匹配战略的 1 个模板, 套到公司层 + 给每个部门派生 cascade.
 *
 * 启发式匹配 (不调 LLM, 关键词命中):
 *   - 战略含 "增长 / ARR / 收入" → category=sales
 *   - 战略含 "留存 / 用户 / 活跃" → category=product
 *   - 战略含 "招聘 / 人才 / 文化" → category=hr
 *   - 战略含 "效率 / 流程 / 成本" → category=ops
 *   - fallback → leadership / sales 第一条
 */
export function buildSopOption(input: BulkCreateInput): BulkCreateOption {
  const tpl = matchTemplate(input.strategy);

  const companyObjective: ObjectiveDraft = {
    title: tpl.title,
    description: tpl.description,
    level: 'company',
    keyResults: tpl.keyResults.map((kr) => ({
      title: kr.title,
      type: kr.type,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      unit: kr.unit,
      weight: kr.weight,
      initiatives: kr.initiatives,
    })),
  };

  // 每部门派生 1 个 cascade Objective (沿用同模板, 用部门名定制 title)
  const departments = input.departments.slice(0, input.maxDepartments ?? 8);
  const cascadeObjectives: ObjectiveDraft[] = departments.map((d) => ({
    title: `${d.name} · 服务公司 OKR "${tpl.title}"`,
    description: `${d.name} 团队如何承接公司目标的部门级拆解.`,
    level: 'team',
    parentLocalIndex: 1, // 指向公司 Objective (本 option 唯一一个公司层)
    ownerDepartmentId: d.id,
    keyResults: tpl.keyResults.slice(0, 2).map((kr) => ({
      title: `${d.name} · ${kr.title}`,
      type: kr.type,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      unit: kr.unit,
      weight: kr.weight,
    })),
  }));

  return {
    id: 'A',
    type: 'SOP',
    description: `按 ${tpl.category} 类目从 OKR 模板库套用经典模板 "${tpl.title}".`,
    reasoning: `匹配规则: 战略关键词 → 模板分类. 来源: ${tpl.source ?? 'OKR_TEMPLATES 内置'}.`,
    confidence: 0.7,
    objectives: [companyObjective, ...cascadeObjectives],
    citedTemplateIds: [tpl.id],
  };
}

/** 根据战略关键词命中分类, 选第一条匹配模板 */
export function matchTemplate(strategy: string): OKRTemplate {
  const s = strategy.toLowerCase();

  const categoryMap: Array<[RegExp, OKRTemplate['category']]> = [
    [/增长|arr|收入|sales|续约|客户/i, 'sales'],
    [/留存|用户|活跃|产品|retention|growth/i, 'product'],
    [/工程|架构|稳定|可用性|engineering|平台/i, 'engineering'],
    [/招聘|人才|文化|hr|人力|敬业/i, 'hr'],
    [/品牌|营销|获客|marketing|曝光/i, 'marketing'],
    [/效率|流程|成本|运营|ops/i, 'ops'],
    [/财务|利润|finance|现金/i, 'finance'],
  ];

  for (const [regex, cat] of categoryMap) {
    if (regex.test(s)) {
      const match = OKR_TEMPLATES.find((t) => t.category === cat);
      if (match) return match;
    }
  }
  // fallback: 第一条 leadership 或 sales
  return (
    OKR_TEMPLATES.find((t) => t.category === 'leadership') ??
    OKR_TEMPLATES.find((t) => t.category === 'sales') ??
    OKR_TEMPLATES[0]
  );
}

// ---------------------------------------------------------------------------
// LLM 推演 (选项 B · REASONING)
// ---------------------------------------------------------------------------

const REASONING_SYSTEM_PROMPT = `你是企业 OKR 教练. 用户给一句战略 + 周期 + 部门列表, 输出严格的 JSON.

JSON 结构:
{
  "companyObjective": {
    "title": "...",
    "description": "...",
    "keyResults": [
      { "title": "...", "type": "numeric"|"percentage"|"binary"|"milestone", "startValue": 数字, "targetValue": 数字, "unit": "...", "weight": 数字 }
    ]
  },
  "departmentObjectives": [
    {
      "departmentId": "...",
      "title": "...",
      "description": "...",
      "keyResults": [
        { "title": "...", "type": "...", "startValue": ..., "targetValue": ..., "unit": "...", "weight": ... }
      ]
    }
  ],
  "reasoning": "一句话解释你为什么这么拆"
}

要求:
1. 只输出 JSON, 不要 markdown 代码块
2. 公司 Objective 有 3-5 个 KR, weight 之和 = 100
3. 每个部门 Objective 有 2-3 个 KR, weight 之和 = 100
4. KR 必须可量化 (startValue ≠ targetValue)
5. type=binary 时 startValue=0 targetValue=1 unit="完成"
6. 中文输出`;

export async function buildReasoningOption(
  input: BulkCreateInput,
  router: TandemRouter,
): Promise<BulkCreateOption | null> {
  const userPrompt = [
    `周期: ${input.cycleName}`,
    `公司战略: ${input.strategy}`,
    `部门列表 (${input.departments.length} 个):`,
    ...input.departments.slice(0, input.maxDepartments ?? 8).map(
      (d) => `  - id=${d.id} 名称=${d.name}`,
    ),
  ].join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: REASONING_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  try {
    const res = await router.chat({
      messages,
      scenario: 'reasoning_complex',
      temperature: 0.4,
      responseFormat: 'json',
      maxTokens: 2000,
      metadata: { userId: input.triggeredBy },
    });
    const parsed = parseReasoningJson(
      typeof res.message.content === 'string' ? res.message.content : '',
    );
    if (!parsed) return null;

    const companyObj: ObjectiveDraft = {
      title: parsed.companyObjective.title,
      description: parsed.companyObjective.description,
      level: 'company',
      keyResults: parsed.companyObjective.keyResults.map(normalizeKr),
    };

    const cascade: ObjectiveDraft[] = parsed.departmentObjectives.map((d) => ({
      title: d.title,
      description: d.description,
      level: 'team' as const,
      parentLocalIndex: 1,
      ownerDepartmentId: d.departmentId,
      keyResults: d.keyResults.map(normalizeKr),
    }));

    return {
      id: 'B',
      type: 'REASONING',
      description: 'LLM 根据战略 + 部门结构推演的全景图',
      reasoning: parsed.reasoning,
      confidence: 0.6,
      objectives: [companyObj, ...cascade],
    };
  } catch {
    return null;
  }
}

interface ReasoningJson {
  companyObjective: {
    title: string;
    description?: string;
    keyResults: Array<Record<string, unknown>>;
  };
  departmentObjectives: Array<{
    departmentId: string;
    title: string;
    description?: string;
    keyResults: Array<Record<string, unknown>>;
  }>;
  reasoning: string;
}

export function parseReasoningJson(text: string): ReasoningJson | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  const slice = cleaned.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice) as Partial<ReasoningJson>;
    if (
      !obj.companyObjective ||
      typeof obj.companyObjective.title !== 'string' ||
      !Array.isArray(obj.companyObjective.keyResults) ||
      !Array.isArray(obj.departmentObjectives) ||
      typeof obj.reasoning !== 'string'
    ) {
      return null;
    }
    return obj as ReasoningJson;
  } catch {
    return null;
  }
}

function normalizeKr(raw: Record<string, unknown>): KrDraft {
  const type = (typeof raw.type === 'string' ? raw.type : 'numeric') as KrDraft['type'];
  const validTypes: KrDraft['type'][] = ['numeric', 'percentage', 'binary', 'milestone'];
  return {
    title: String(raw.title ?? ''),
    type: validTypes.includes(type) ? type : 'numeric',
    startValue: Number(raw.startValue ?? 0),
    targetValue: Number(raw.targetValue ?? 100),
    unit: String(raw.unit ?? ''),
    weight: Math.max(0, Math.min(100, Number(raw.weight ?? 0))),
    initiatives: Array.isArray(raw.initiatives)
      ? raw.initiatives.map(String).slice(0, 5)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// 历史 case (选项 C · HISTORICAL · 当前 v0 是占位, v2 接 Memory retriever)
// ---------------------------------------------------------------------------

export function buildHistoricalOption(input: BulkCreateInput): BulkCreateOption {
  // v0: 用模板库的第二条作为"历史成功案例"占位 (避开 SOP 命中那条)
  const sopTpl = matchTemplate(input.strategy);
  const histTpl =
    OKR_TEMPLATES.find((t) => t.category === sopTpl.category && t.id !== sopTpl.id) ??
    OKR_TEMPLATES[1];

  const companyObjective: ObjectiveDraft = {
    title: histTpl.title,
    description: `(历史相似案例) ${histTpl.description}`,
    level: 'company',
    keyResults: histTpl.keyResults.map((kr) => ({
      title: kr.title,
      type: kr.type,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      unit: kr.unit,
      weight: kr.weight,
      initiatives: kr.initiatives,
    })),
  };

  const departments = input.departments.slice(0, input.maxDepartments ?? 8);
  const cascadeObjectives: ObjectiveDraft[] = departments.map((d) => ({
    title: `${d.name} · 沿用历史范式承接 "${histTpl.title}"`,
    level: 'team',
    parentLocalIndex: 1,
    ownerDepartmentId: d.id,
    keyResults: histTpl.keyResults.slice(0, 2).map((kr) => ({
      title: `${d.name} · ${kr.title}`,
      type: kr.type,
      startValue: kr.startValue,
      targetValue: kr.targetValue,
      unit: kr.unit,
      weight: kr.weight,
    })),
  }));

  return {
    id: 'C',
    type: 'HISTORICAL',
    description: `(v0 占位 — v2 接 Memory retriever) 引用历史相似案例 "${histTpl.title}"`,
    reasoning: `当前用模板库次优匹配作为历史案例占位; v2 将从 Memory 真实历史 OKR 提取相似度 top-1.`,
    confidence: 0.4,
    objectives: [companyObjective, ...cascadeObjectives],
    citedTemplateIds: [histTpl.id],
  };
}

// ---------------------------------------------------------------------------
// 原创 (选项 D · ORIGINAL · humanOnly 强制)
// ---------------------------------------------------------------------------

export function buildOriginalOption(): BulkCreateOption {
  return {
    id: 'D',
    type: 'ORIGINAL',
    description: '留空 — 主管自己写, 反 AI 欺诈 (humanOnly)',
    reasoning: '宪章 §2 第 4 选项必员工原创. 系统拒绝 AI 代写, 主管选 D 后进入空 dialog 自己填.',
    humanOnly: true,
    confidence: 0,
    objectives: [],
  };
}

// ---------------------------------------------------------------------------
// 主入口 · 4 选项一次性生成
// ---------------------------------------------------------------------------

export async function generateBulkCreateOptions(
  input: BulkCreateInput,
  router?: TandemRouter,
): Promise<BulkCreateResult> {
  const generatedAt = new Date().toISOString();

  // A · SOP — 永不失败 (内置库)
  const optionA = buildSopOption(input);

  // C · HISTORICAL — v0 永不失败 (用模板占位)
  const optionC = buildHistoricalOption(input);

  // D · ORIGINAL — 永不失败 (humanOnly)
  const optionD = buildOriginalOption();

  // B · REASONING — 调 LLM, 失败降级
  let optionB: BulkCreateOption | null = null;
  let modelUsed: string | undefined;
  let fallbackReason: string | undefined;

  if (router && router.listProviders().length > 0) {
    optionB = await buildReasoningOption(input, router);
    if (optionB) {
      modelUsed = router.listProviders()[0]; // v0 简化: 取第一个 provider 名 (v1 用 res.model)
    } else {
      fallbackReason = 'llm_parse_failed';
    }
  } else {
    fallbackReason = 'no_provider_registered';
  }

  // B 降级: 用模板库第三条作为占位
  if (!optionB) {
    const fallbackTpl =
      OKR_TEMPLATES.find((t) => t.category === 'leadership') ?? OKR_TEMPLATES[2] ?? OKR_TEMPLATES[0];
    optionB = {
      id: 'B',
      type: 'REASONING',
      description: `(降级模式: ${fallbackReason ?? 'unknown'}) 用 leadership 模板代替 LLM 推演`,
      reasoning: '当前未调用 LLM 或 LLM 解析失败, 使用模板库降级. 配置 LLM provider 后获取真实推演.',
      confidence: 0.3,
      objectives: [
        {
          title: fallbackTpl.title,
          description: fallbackTpl.description,
          level: 'company',
          keyResults: fallbackTpl.keyResults.map((kr) => ({
            title: kr.title,
            type: kr.type,
            startValue: kr.startValue,
            targetValue: kr.targetValue,
            unit: kr.unit,
            weight: kr.weight,
          })),
        },
      ],
      citedTemplateIds: [fallbackTpl.id],
    };
  }

  // audit: 4 选项已生成
  await audit('persona_brief.options_generated', input.triggeredBy, {
    targetType: 'okr_cycle',
    metadata: {
      action: 'okr.bulk_create_options_generated',
      cycleName: input.cycleName,
      strategy: input.strategy.slice(0, 80),
      departmentCount: input.departments.length,
      source: optionB.confidence >= 0.5 ? 'full' : 'partial',
      fallbackReason,
    },
  });

  return {
    cycleName: input.cycleName,
    strategy: input.strategy,
    options: [optionA, optionB, optionC, optionD],
    generatedAt,
    modelUsed,
    source: optionB.confidence >= 0.5 ? 'full' : fallbackReason ? 'fallback' : 'partial',
    fallbackReason,
  };
}
