/**
 * /tandem init · 客户冷启动 onboarding wizard
 *
 * 借鉴 Claude Code `/init`: 第一次进项目, AI 自己读 codebase → 推断技术栈 → 输出 CLAUDE.md 草稿.
 *
 * Tandem 化:
 *   客户上传 (a) 现有 OKR 表 (Excel/Tita 导出 JSON) (b) 上季议事记录 (c) 公司红线文档
 *   → AI 跑 init:
 *     1. 读 OKR → 推断公司层级 / cycle 长度 / 命名规范
 *     2. 读议事 → 推断决议密度 / 主题分布
 *     3. 读红线 → 抽出公司私有红线 (除 Tandem 4 件不变量之外)
 *   → 输出 draft WorkspaceManifest + 3 套 OKR 模板 (复用 lib/services/okr-bulk-create)
 *   → CEO + Steward 审签字 (走 lib/persona/workspace-manifest:signWorkspaceManifest)
 *
 * 关键: 本模块输出的 manifest **始终是草稿态** (signed=false), 必须人工审签才生效注入 Persona prompt.
 * 这是反 AI 偷渡治理规则的不变量.
 */

import type { TandemRouter } from '../taf/router';
import type {
  WorkspaceManifest,
  CycleLengthMonths,
  WorkspaceManifestRedline,
  WorkspaceManifestVocab,
} from '../types/workspace-manifest';
import { DEFAULT_WORKSPACE_MANIFEST, validateWorkspaceManifest } from '../types/workspace-manifest';
import { upsertWorkspaceManifest } from '../persona/workspace-manifest';

// ---------------------------------------------------------------------------
// 输入: 客户上传的原始数据
// ---------------------------------------------------------------------------

export interface InitInput {
  tenantId: string;
  initiatedBy: string;
  /** 公司展示名 */
  workspaceName: string;
  /** 1 段公司业务概述 (人填, 不让 AI 编) */
  workspaceOverview?: string;

  /**
   * 原始 OKR 表 (从 Tita/Excel 导出的简化 JSON).
   * 用于推断 cycle 长度 + 命名规范.
   */
  okrSamples?: Array<{
    objectiveTitle: string;
    krs: string[];
    cycle?: string; // e.g. "2026-Q1" / "2026 H1" / "Sep 2026"
  }>;

  /**
   * 公司红线原文 (员工手册 / 合规文档 / 价值观海报 的纯文本片段, 每段独立).
   * AI 抽取 → 转换为结构化 WorkspaceManifestRedline.
   */
  redlineDocuments?: string[];

  /**
   * 公司黑话 (可选, 人列). 缺省时 AI 不主动猜.
   */
  vocab?: WorkspaceManifestVocab[];

  /** 文化倾向标签 (人列, ≤ 10) */
  cultureTags?: string[];
}

export interface InitResult {
  manifest: WorkspaceManifest;
  warnings: string[];
  inferences: {
    okrCycleLengthMonths: { value: CycleLengthMonths; confidence: number; rationale: string };
    okrNamingConvention?: { value: string; confidence: number; rationale: string };
    redlineCount: number;
  };
}

// ---------------------------------------------------------------------------
// 主流程 (LLM 失败可降级到 heuristic-only)
// ---------------------------------------------------------------------------

export interface InitDependencies {
  router?: TandemRouter;
  /** 若提供则跳过 LLM 抽取红线, 直接用 (测试场景) */
  preExtractedRedlines?: WorkspaceManifestRedline[];
}

export async function runInit(input: InitInput, deps: InitDependencies = {}): Promise<InitResult> {
  const warnings: string[] = [];

  // 1. cycle 长度推断 (heuristic + LLM 双轨)
  const cycleInference = inferOkrCycleLength(input.okrSamples ?? []);

  // 2. 命名规范推断 (heuristic)
  const namingInference = inferOkrNaming(input.okrSamples ?? []);

  // 3. 红线抽取 (LLM 主, heuristic 降级)
  let redlines: WorkspaceManifestRedline[];
  if (deps.preExtractedRedlines) {
    redlines = deps.preExtractedRedlines;
  } else if (deps.router && input.redlineDocuments && input.redlineDocuments.length > 0) {
    try {
      redlines = await extractRedlinesViaLLM(input.redlineDocuments, deps.router);
    } catch (err) {
      warnings.push(`LLM 红线抽取失败, 降级为 heuristic: ${(err as Error).message}`);
      redlines = extractRedlinesHeuristic(input.redlineDocuments);
    }
  } else if (input.redlineDocuments && input.redlineDocuments.length > 0) {
    warnings.push('未提供 LLM router, 用 heuristic 抽取红线 (准确率较低)');
    redlines = extractRedlinesHeuristic(input.redlineDocuments);
  } else {
    redlines = [];
  }

  // 4. 体积保护: 红线超 20 条 → 截断 + warning
  if (redlines.length > 20) {
    warnings.push(`抽取出 ${redlines.length} 条红线超出上限 20, 截断保留前 20 条 (按出现顺序)`);
    redlines = redlines.slice(0, 20);
  }

  // 5. 写入 manifest (始终 signed=false 草稿)
  const patch: Parameters<typeof upsertWorkspaceManifest>[0]['patch'] = {
    ...DEFAULT_WORKSPACE_MANIFEST,
    workspaceName: input.workspaceName,
    workspaceOverview: input.workspaceOverview,
    okrCycleLengthMonths: cycleInference.value,
    okrNamingConvention: namingInference?.value,
    redlines,
    vocab: input.vocab ?? [],
    cultureTags: input.cultureTags ?? [],
  };

  // 体积校验 (validateWorkspaceManifest 会跑, 但提前 fail-fast 给出更清晰错误)
  const validateError = validateWorkspaceManifest({ ...DEFAULT_WORKSPACE_MANIFEST, ...patch });
  if (validateError) throw new Error(`init 失败 — manifest validation: ${validateError}`);

  const manifest = await upsertWorkspaceManifest({
    tenantId: input.tenantId,
    patch,
    updatedBy: input.initiatedBy,
  });

  return {
    manifest,
    warnings,
    inferences: {
      okrCycleLengthMonths: cycleInference,
      okrNamingConvention: namingInference,
      redlineCount: redlines.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Inference helpers (heuristic, 0 依赖 LLM, 可测)
// ---------------------------------------------------------------------------

export function inferOkrCycleLength(
  samples: NonNullable<InitInput['okrSamples']>,
): InitResult['inferences']['okrCycleLengthMonths'] {
  if (samples.length === 0) {
    return { value: 3, confidence: 0, rationale: '无样本, 用默认 3 个月 (季度制)' };
  }

  let q = 0;
  let h = 0;
  let m = 0;
  let y = 0;
  for (const s of samples) {
    if (!s.cycle) continue;
    const c = s.cycle.toLowerCase();
    if (/q[1-4]|quarter|季|qtr/.test(c)) q++;
    else if (/h[12]|half|上半|下半/.test(c)) h++;
    else if (/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|月/.test(c)) m++;
    else if (/^\d{4}$|year|年(?!度)/.test(c)) y++;
  }

  const total = q + h + m + y;
  if (total === 0) {
    return { value: 3, confidence: 0.2, rationale: '样本 cycle 字段无法识别, 用默认 3 个月' };
  }

  const max = Math.max(q, h, m, y);
  const confidence = max / total;
  if (max === q) return { value: 3, confidence, rationale: `${q}/${total} 样本是季度 (Q1/Q2 等)` };
  if (max === h) return { value: 6, confidence, rationale: `${h}/${total} 样本是半年 (H1/H2)` };
  if (max === m) return { value: 1, confidence, rationale: `${m}/${total} 样本是月度` };
  return { value: 12, confidence, rationale: `${y}/${total} 样本是年度` };
}

export function inferOkrNaming(
  samples: NonNullable<InitInput['okrSamples']>,
): InitResult['inferences']['okrNamingConvention'] | undefined {
  if (samples.length === 0) return undefined;

  // 提取 O 标题中开头的形如 "O1" "O2.1" "Objective 1" 的模式
  const objPattern = /^(O\d+|Objective\s*\d+|目标\d*|O[a-z]?-?\d+)/i;
  let matched = 0;
  for (const s of samples) {
    if (objPattern.test(s.objectiveTitle)) matched++;
  }
  const confidence = matched / samples.length;
  if (confidence < 0.5) {
    return undefined;
  }
  return {
    value: 'O{n} / KR{n}.{m}',
    confidence,
    rationale: `${matched}/${samples.length} 样本 Objective 以 O数字 开头`,
  };
}

// ---------------------------------------------------------------------------
// 红线抽取 — heuristic 版 (LLM 不可用时降级)
// ---------------------------------------------------------------------------

/** 关键词 → 红线 verdict 的启发规则 */
const REDLINE_KEYWORDS: Array<{ pattern: RegExp; verdict: 'HARD_BLOCK' | 'SOFT_WARN' }> = [
  { pattern: /严禁|绝对不(允许|得)|严格禁止|不得对外/, verdict: 'HARD_BLOCK' },
  { pattern: /禁止|不允许|不得/, verdict: 'HARD_BLOCK' },
  { pattern: /避免|尽量不|应当谨慎|须谨慎/, verdict: 'SOFT_WARN' },
  { pattern: /鼓励|提倡|建议/, verdict: 'SOFT_WARN' },
];

export function extractRedlinesHeuristic(documents: string[]): WorkspaceManifestRedline[] {
  const redlines: WorkspaceManifestRedline[] = [];
  let counter = 0;
  for (const doc of documents) {
    // 按句号 / 换行切分
    const sentences = doc
      .split(/[。\n.;；]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 200);

    for (const sentence of sentences) {
      for (const { pattern, verdict } of REDLINE_KEYWORDS) {
        if (pattern.test(sentence)) {
          counter++;
          redlines.push({
            id: `redline_auto_${counter}`,
            title: sentence.length > 50 ? sentence.slice(0, 47) + '...' : sentence,
            rationale: sentence,
            triggers: [],
            verdict,
          });
          break; // 同一句只命中一条规则
        }
      }
      if (redlines.length >= 30) break; // heuristic 上限 30, upsert 时再截到 20
    }
    if (redlines.length >= 30) break;
  }
  return redlines;
}

// ---------------------------------------------------------------------------
// 红线抽取 — LLM 版 (结构化输出)
// ---------------------------------------------------------------------------

export async function extractRedlinesViaLLM(
  documents: string[],
  router: TandemRouter,
): Promise<WorkspaceManifestRedline[]> {
  const corpus = documents.join('\n\n---\n\n').slice(0, 12_000); // 限制 12K 字符

  const res = await router.chat({
    messages: [
      {
        role: 'system',
        content: `你是 Tandem 治理 Agent. 任务: 从客户上传的员工手册/合规文档/价值观文本中, 抽取**公司层私有红线** (Tandem 默认 4 件不变量之外的).
规则:
- 每条红线: id (slug, snake_case, ≤ 30 字符) / title (≤ 50 字, 一句话) / rationale (≤ 300 字) / verdict ('HARD_BLOCK' 严禁类 | 'SOFT_WARN' 谨慎类) / triggers (string[], 触发关键词, ≤ 5 个)
- 严禁/绝不/不得 → HARD_BLOCK; 避免/尽量 → SOFT_WARN
- 同义合并 (不要重复抽 5 条几乎一样的)
- 上限 15 条 (优先级靠前)
输出 JSON: { redlines: [{...}, ...] }`,
      },
      {
        role: 'user',
        content: corpus,
      },
    ],
    scenario: 'reasoning_complex',
    responseFormat: {
      type: 'json_schema',
      name: 'tandem_init_redlines',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['redlines'],
        properties: {
          redlines: {
            type: 'array',
            maxItems: 15,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'title', 'rationale', 'verdict', 'triggers'],
              properties: {
                id: { type: 'string', maxLength: 30 },
                title: { type: 'string', maxLength: 50 },
                rationale: { type: 'string', maxLength: 300 },
                verdict: { type: 'string', enum: ['HARD_BLOCK', 'SOFT_WARN'] },
                triggers: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 30 } },
              },
            },
          },
        },
      },
    },
    temperature: 0.3,
  });

  const parsed = JSON.parse(typeof res.message.content === 'string' ? res.message.content : '{}');
  const raw = Array.isArray(parsed.redlines) ? parsed.redlines : [];
  // 防御性: 校验 verdict 合法 (即使 LLM 返回怪值)
  return raw
    .filter(
      (r: unknown): r is WorkspaceManifestRedline =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as Record<string, unknown>).id === 'string' &&
        typeof (r as Record<string, unknown>).title === 'string' &&
        ['HARD_BLOCK', 'SOFT_WARN'].includes((r as Record<string, unknown>).verdict as string),
    )
    .map((r: WorkspaceManifestRedline) => ({
      ...r,
      triggers: Array.isArray(r.triggers) ? r.triggers : [],
    }));
}
