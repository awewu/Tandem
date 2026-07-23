import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  listPainPoints, findPainPoint, autoDetectPainPoints, inferImplicitPainPoints,
  painPointsToSystems, progressiveNextQuestion, painPointsToGeoQuestions,
  type SystemCode, type GeoQuestionSeed,
} from './diagnosis-painpoints';
import { SYSTEM_LABELS, inferSystems } from './diagnosis-engine';
import { BailianDiagnosisModelClient } from './diagnosis-model-client';

/**
 * 问诊对话脑（进化 · 第 2 步）。
 *
 * 设计沿用增长中枢 AiGatewayService 的成熟策略（不重造轮子）：
 *  - 模型可插拔：有 DIAGNOSIS_AI_API_KEY / DASHSCOPE_API_KEY 走百炼，无 Key / 调用失败 → 确定性规则兜底（用收割的 48 项知识库）。
 *  - 诚实红线：只映射到已知痛点 id，禁止编造价格/节能率/ROI；未识别的新说法进 discoveredPains（人工审核后迭代词库）。
 *  - 迭代 hook：discoveredPains（发现新痛点）+ 选中痛点遥测（由 service 落库/发事件）驱动词库持续进化。
 *  - GEO 打通：随手产出 geoSeeds（痛点→AI 搜索选题），回流增长中枢 E3。
 */

export interface DiagnosisAdviceInput {
  text?: string;                    // 业主自由描述
  profile?: Record<string, any>;    // 户型/家庭 profile
  selected?: string[];              // 已手选痛点 id
}

export interface DiagnosisAdvice {
  requestId: string;                    // 服务端调用追踪号（不含 PII）
  source: 'model' | 'rules';        // 如实标注产出路径
  mappedPainIds: string[];          // 命中的已知痛点 id（受控词表内）
  discoveredPains: string[];        // 词表外的新痛点说法（迭代候选，待人工审核）
  implicit: { id: string; name: string; reason: string; strength: string }[]; // 推断的隐性痛点
  systems: SystemCode[];            // 系统建议 code
  systemLabels: string[];
  nextQuestion: string | null;      // 渐进追问；null 表示可进入归纳
  summary: string;                  // 需求共识画像（诚实，无编造数字）
  geoSeeds: GeoQuestionSeed[];      // 痛点 → GEO 选题
}

// 《广告法》绝对化用语最小基线（与 AiGateway 同源思路，防止归纳文案越线）。
const FORBIDDEN_TERMS = ['最好', '最佳', '第一', '唯一', '100%', '绝对', '永久', '根治', '包治', '顶级'];

const ModelOutSchema = z.object({
  mappedPainIds: z.array(z.string().max(80)).max(48).default([]),
  discoveredPains: z.array(z.string().max(80)).max(8).default([]),
  nextQuestion: z.string().max(300).nullable().default(null),
  summary: z.string().max(800).default(''),
});

@Injectable()
export class DiagnosisAiService {
  private readonly logger = new Logger('DiagnosisAi');
  private readonly model = process.env.DIAGNOSIS_AI_MODEL || 'deepseek-v4-pro';
  private readonly baseUrl =
    process.env.DIAGNOSIS_AI_BASE_URL ||
    process.env.DASHSCOPE_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1';

  async advise(input: DiagnosisAdviceInput = {}): Promise<DiagnosisAdvice> {
    const normalized = this.normalizeInput(input);
    const requestId = randomUUID();
    const startedAt = Date.now();
    const apiKey = process.env.DIAGNOSIS_AI_API_KEY || process.env.DASHSCOPE_API_KEY;
    if (apiKey && normalized.text) {
      this.log('diagnosis.ai.requested', {
        requestId,
        model: this.model,
        textLength: normalized.text.length,
        selectedCount: normalized.selected?.length || 0,
      });
      try {
        const result = await this.modelAdvise(normalized, apiKey, requestId);
        this.log('diagnosis.ai.completed', {
          requestId,
          model: this.model,
          durationMs: Date.now() - startedAt,
          mappedPainCount: result.mappedPainIds.length,
          discoveredPainCount: result.discoveredPains.length,
        });
        return result;
      } catch (err: unknown) {
        this.warn('diagnosis.ai.fallback', {
          requestId,
          model: this.model,
          durationMs: Date.now() - startedAt,
          reason: this.safeErrorReason(err),
        });
      }
    }
    const result = this.ruleAdvise(normalized, requestId);
    if (!apiKey || !normalized.text) {
      this.log('diagnosis.ai.rules', {
        requestId,
        durationMs: Date.now() - startedAt,
        reason: apiKey ? 'empty_text' : 'missing_api_key',
        mappedPainCount: result.mappedPainIds.length,
      });
    }
    return result;
  }

  /** 确定性兜底：纯规则（自动勾选 + 隐性推断 + 渐进追问），无模型、无编造。 */
  ruleAdvise(input: DiagnosisAdviceInput = {}, requestId = randomUUID()): DiagnosisAdvice {
    const profile = input.profile || {};
    const selected = (input.selected || []).filter((id) => !!findPainPoint(id));
    const auto = autoDetectPainPoints(profile).map((x) => x.id);
    const mapped = [...new Set([...selected, ...auto])];
    return this.assemble(requestId, 'rules', mapped, [], profile);
  }

  /** 模型路径：把 free text + profile 交大模型做结构化抽取，Zod 校验，越界项过滤。 */
  private async modelAdvise(
    input: DiagnosisAdviceInput,
    apiKey: string,
    requestId: string,
  ): Promise<DiagnosisAdvice> {
    const client = new BailianDiagnosisModelClient({
      apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
    });

    const catalog = listPainPoints().map((p) => `${p.id}=${p.name}`).join('；');
    const system = [
      '你是瑞诺瓦舒适家的顾问式问诊助手（初诊，不做精算）。',
      '任务：听懂业主的生活化描述，映射到给定痛点清单，并推进一个自然的追问。',
      '严格规则：',
      '1) mappedPainIds 只能取自给定清单的 id，不得杜撰 id；',
      '2) 清单里没有、但业主确实提到的新困扰，放进 discoveredPains（用简短中文短语）；',
      '3) 绝对禁止编造价格、节能率、ROI、回收年限、匹配度等任何数字；',
      '4) summary 是需求共识画像，克制专业，不含绝对化用语；',
      '只输出 JSON：{"mappedPainIds":[],"discoveredPains":[],"nextQuestion":"","summary":""}',
    ].join('\n');
    const user = [
      `痛点清单：${catalog}`,
      `房屋/家庭：${JSON.stringify(this.toModelProfile(input.profile || {}))}`,
      `已选痛点：${JSON.stringify(input.selected || [])}`,
      `业主描述：${input.text || ''}`,
    ].join('\n');

    const completion = await client.completeJson({ system, user, maxTokens: 800 });
    const match = completion.content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json in model response');
    const parsed = ModelOutSchema.parse(JSON.parse(match[0]));

    // 只保留受控词表内的 id；模型自选 + 业主已选合并。
    const known = parsed.mappedPainIds.filter((id) => !!findPainPoint(id));
    const mapped = [...new Set([...(input.selected || []).filter((id) => !!findPainPoint(id)), ...known])];
    const discovered = [...new Set(parsed.discoveredPains.map((s) => String(s).trim()).filter(Boolean))].slice(0, 8);
    this.log('diagnosis.ai.provider', {
      requestId,
      provider: 'bailian',
      providerRequestId: completion.providerRequestId,
      providerModel: completion.model,
      promptTokens: completion.usage?.promptTokens,
      completionTokens: completion.usage?.completionTokens,
      totalTokens: completion.usage?.totalTokens,
    });
    return this.assemble(requestId, 'model', mapped, discovered, input.profile || {}, {
      nextQuestion: parsed.nextQuestion,
      summary: parsed.summary,
    });
  }

  /** 统一装配结果（两条路径共用）：系统建议、隐性痛点、追问、归纳、GEO 选题。 */
  private assemble(
    requestId: string,
    source: 'model' | 'rules',
    mapped: string[],
    discovered: string[],
    profile: Record<string, any>,
    modelText?: { nextQuestion: string | null; summary: string },
  ): DiagnosisAdvice {
    const systems = painPointsToSystems(mapped);
    const implicit = inferImplicitPainPoints(profile, mapped).map((x) => ({
      id: x.id, name: x.name, reason: x.reason, strength: x.strength,
    }));
    const nextQuestion = modelText?.nextQuestion ?? progressiveNextQuestion(mapped)?.question ?? null;
    const summary = this.sanitize(modelText?.summary || this.ruleSummary(profile, mapped, systems));
    return {
      requestId,
      source,
      mappedPainIds: mapped,
      discoveredPains: discovered,
      implicit,
      systems,
      systemLabels: systems.map((s) => SYSTEM_LABELS[s]),
      nextQuestion,
      summary,
      geoSeeds: painPointsToGeoQuestions(mapped),
    };
  }

  /** 规则归纳（无模型时）：只用已知信息拼装，不含任何编造数字。 */
  private ruleSummary(profile: Record<string, any>, mapped: string[], systems: SystemCode[]): string {
    const bits: string[] = [];
    const t = profile.propertyType || profile.type;
    if (t) bits.push(String(t));
    if (profile.area) bits.push(`${profile.area}㎡`);
    if (profile.city) bits.push(String(profile.city));
    const head = bits.length ? `${bits.join(' · ')}。` : '';
    const painNames = mapped.map((id) => findPainPoint(id)?.name).filter(Boolean).slice(0, 5);
    const painPart = painNames.length ? `主要关注：${painNames.join('、')}。` : '暂未锁定具体痛点，建议继续沟通。';
    const sysPart = systems.length ? `方向建议：${systems.map((s) => SYSTEM_LABELS[s]).join('、')}（具体选型与报价以现场勘测为准）。` : '';
    return `${head}${painPart}${sysPart}`.trim();
  }

  private sanitize(text: string): string {
    let out = String(text || '');
    for (const term of FORBIDDEN_TERMS) if (out.includes(term)) out = out.split(term).join('');
    return out.trim();
  }

  private toModelProfile(profile: Record<string, any>): Record<string, unknown> {
    const allowed = [
      'city', 'area', 'type', 'houseType', 'floors', 'hasBasement', 'hasElderly',
      'hasInfant', 'hasPet', 'renovationStage', 'residents', 'budget',
    ];
    return Object.fromEntries(
      allowed
        .filter((key) => profile[key] !== undefined && profile[key] !== null && profile[key] !== '')
        .map((key) => [key, profile[key]]),
    );
  }

  private normalizeInput(input: DiagnosisAdviceInput): DiagnosisAdviceInput {
    const profile = input.profile;
    return {
      text: typeof input.text === 'string' ? input.text.trim().slice(0, 2000) : '',
      profile: profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {},
      selected: Array.isArray(input.selected)
        ? input.selected.map((id) => String(id)).slice(0, 48)
        : [],
    };
  }

  private safeErrorReason(error: unknown): string {
    if (!(error instanceof Error)) return 'unknown_error';
    if (/^Bailian request failed with HTTP \d+$/.test(error.message)) return error.message;
    return error.name || 'model_error';
  }

  private log(event: string, fields: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ event, ...fields }));
  }

  private warn(event: string, fields: Record<string, unknown>): void {
    this.logger.warn(JSON.stringify({ event, ...fields }));
  }

  /**
   * 快速痛点分析（收割自 Legacy /api/v2/diagnosis/public/ai-analyze，契约兼容）。
   * 输出形状与 Legacy 一致：{ systems, systemLabels, combination, reasoning, priority }，
   * 额外带 source 如实标注产出路径。有 Key 走模型，无 Key / 失败 → inferSystems 规则兜底（无编造数字）。
   */
  async aiAnalyze(input: QuickAnalyzeInput = {}): Promise<QuickAnalyzeResult> {
    const apiKey = process.env.DIAGNOSIS_AI_API_KEY || process.env.DASHSCOPE_API_KEY;
    if (apiKey) {
      try {
        return await this.modelQuickAnalyze(input, apiKey);
      } catch (err: unknown) {
        this.logger.warn(`quick analyze model call failed, falling back to rules: ${String(err)}`);
      }
    }
    return this.ruleQuickAnalyze(input);
  }

  /** 规则兜底：痛点文本 → 系统分类（inferSystems），组合命名 + 诚实说明，无编造数字。 */
  private ruleQuickAnalyze(input: QuickAnalyzeInput): QuickAnalyzeResult {
    const painPoints = (input.painPoints || []).map((p) => String(p)).filter(Boolean);
    const systems = inferSystems({ painPoints });
    const systemLabels = systems.map((s) => SYSTEM_LABELS[s] || s);
    const coreLabels = systemLabels.filter((l) => l !== SYSTEM_LABELS.smart_control);
    const wuheng = systems.includes('hot_water') && (systems.includes('heating') || systems.includes('air'));
    const combination = wuheng ? '五恒系统' : coreLabels.join('+') || '舒适家基础组合';
    const painPart = painPoints.length ? `围绕您反馈的「${painPoints.slice(0, 3).join('、')}」等困扰，` : '按常见舒适家需求，';
    const reasoning = this.sanitize(
      `${painPart}建议以 ${combination} 为方向，覆盖 ${coreLabels.join('、')}${systems.includes('smart_control') ? '，并配套智能控制联动' : ''}。具体选型与报价以现场勘测为准。`,
    );
    return {
      source: 'rules',
      systems,
      systemLabels,
      combination,
      reasoning,
      priority: painPoints[0] || '',
    };
  }

  /** 模型路径：沿 Legacy prompt 口径做结构化推荐，Zod 校验 + 词表内过滤。 */
  private async modelQuickAnalyze(input: QuickAnalyzeInput, apiKey: string): Promise<QuickAnalyzeResult> {
    const client = new BailianDiagnosisModelClient({
      apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
    });

    const codes = Object.keys(SYSTEM_LABELS).join('|');
    const system = [
      '你是瑞诺瓦舒适家 AI 顾问，专注于住宅暖通空调（HVAC）方案设计。',
      '根据用户的居家舒适痛点、房屋信息，给出系统推荐和简短说明。',
      '严格规则：绝对禁止编造价格、节能率、ROI、回收年限等任何数字；不使用绝对化用语。',
      `只输出 JSON：{"systems":["${codes} 之一"],"combination":"方案组合名称","reasoning":"2-3句专业解释","priority":"最优先解决的一个痛点"}`,
    ].join('\n');
    const user = [
      `城市：${input.city || '未填写'}`,
      `建筑面积：${input.area || '未填写'} ㎡`,
      `预期预算：${input.budget || '未填写'}`,
      `房屋阶段：${input.branch === 'retrofit' ? '已入住改造' : '新建/装修中'}`,
      input.occupants ? `常住人数：${input.occupants}` : '',
      `居家困扰：${(input.painPoints || []).length ? (input.painPoints || []).join('、') : '未选择（按默认舒适需求推荐）'}`,
      '请分析并推荐最合适的 HVAC 系统组合。',
    ].filter(Boolean).join('\n');

    const completion = await client.completeJson({ system, user, maxTokens: 512 });
    const match = completion.content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json in model response');
    const parsed = QuickModelOutSchema.parse(JSON.parse(match[0]));

    const systems = parsed.systems.filter((s) => !!SYSTEM_LABELS[s]);
    if (!systems.length) return this.ruleQuickAnalyze(input);
    return {
      source: 'model',
      systems,
      systemLabels: systems.map((s) => SYSTEM_LABELS[s]),
      combination: this.sanitize(parsed.combination) || systems.map((s) => SYSTEM_LABELS[s]).join('+'),
      reasoning: this.sanitize(parsed.reasoning),
      priority: this.sanitize(parsed.priority),
    };
  }
}

export interface QuickAnalyzeInput {
  painPoints?: string[];
  area?: number;
  budget?: string;
  city?: string;
  branch?: string;
  occupants?: number;
}

export interface QuickAnalyzeResult {
  source: 'model' | 'rules';
  systems: string[];
  systemLabels: string[];
  combination: string;
  reasoning: string;
  priority: string;
}

const QuickModelOutSchema = z.object({
  systems: z.array(z.string()).default([]),
  combination: z.string().default(''),
  reasoning: z.string().default(''),
  priority: z.string().default(''),
});
