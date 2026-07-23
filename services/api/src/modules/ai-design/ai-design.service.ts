import { Injectable, Logger } from '@nestjs/common';
import { ProductCatalogService } from '../product-catalog/product-catalog.service';
import { AiGatewayService } from '../growth/ai-gateway.service';

/**
 * W-BIM-AI · Sprint 4 AI 设计引擎 v0（骨架）
 *
 * 信任状态机：
 *   unverified → estimate → verified
 *   任何关键输入缺失 → insufficient_data（拒绝默认值）
 *
 * 当前仅提供骨架和规则编排入口，真实算法（自动盘管/自动布管/LLM 意图）
 * 在后续迭代中替换 rule-based stubs。
 */

export type TrustState = 'unverified' | 'estimate' | 'verified' | 'insufficient_data';

export interface DesignProposalInput {
  projectId: string;
  floorPlan?: any;
  systems?: string[];
  naturalLanguageRequirement?: string;
  constraints?: {
    maxBudget?: number;
    preferredBrand?: string;
    city?: string;
  };
}

export interface DesignProposal {
  trustState: TrustState;
  devices: Array<{ systemType: string; name: string; assetRef?: string; position?: any }>;
  pipes: Array<{ start: any; end: any; diameterMm: number; material: string }>;
  bom: any[];
  reasoning: string[];
  warnings: string[];
}

@Injectable()
export class AiDesignService {
  private readonly logger = new Logger(AiDesignService.name);
  constructor(
    private readonly productCatalog: ProductCatalogService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async propose(input: DesignProposalInput): Promise<DesignProposal> {
    const missing: string[] = [];
    if (!input.floorPlan) missing.push('floorPlan');
    if (!input.systems || input.systems.length === 0) missing.push('systems');

    if (missing.length > 0) {
      return {
        trustState: 'insufficient_data',
        devices: [],
        pipes: [],
        bom: [],
        reasoning: [],
        warnings: [`缺少关键输入：${missing.join(', ')}`],
      };
    }

    const systems = input.systems!;

    // TODO: replace with rule automation + LLM orchestration
    const devices = systems.map((systemType, i) => ({
      systemType,
      name: `${systemType}-${i + 1}`,
      assetRef: `catalog:sku:${systemType}:placeholder`,
      position: { x: 0, y: 0, z: 0 },
    }));

    const proposal: DesignProposal = {
      trustState: 'estimate',
      devices,
      pipes: [],
      bom: devices.map((d) => ({ name: d.name, assetRef: d.assetRef, quantity: 1 })),
      reasoning: [`根据户型与系统要求 ${systems.join(', ')} 生成初步方案`],
      warnings: ['当前为规则占位输出，尚未接入真实算法与 LLM 编排'],
    };

    this.logger.log(`AI proposal generated for project ${input.projectId}: trust=${proposal.trustState}`);
    return proposal;
  }

  async verify(proposal: DesignProposal): Promise<DesignProposal> {
    if (proposal.trustState === 'insufficient_data') return proposal;
    // TODO: 人工/算法校验后提升到 verified
    return { ...proposal, trustState: 'verified' };
  }

  /**
   * 4.4 · 对 calc-gate 结果做 LLM 解读挑错（编排铁律：LLM 不自出合规结论）。
   * 输入须包含 gate/checks 与原始 input；输出仅作为设计师/工程师的复核提示，
   * 不能替代人工最终确认。
   */
  async reviewCalcGate(input: {
    projectId: string;
    calcResult: any;
    gateResult: any;
    question?: string;
  }) {
    const { projectId, gateResult } = input;
    const checks = gateResult?.checks ?? [];
    const failed = checks.filter((c: any) => c.status === 'fail' || c.status === 'blocked');
    const warnings = checks.filter((c: any) => c.status === 'warning');

    // 规则派生的结构化 notes（作为 LLM 的事实锚点，防幻觉；始终返回，不依赖模型）。
    const notes: string[] = [];
    if (failed.length > 0) {
      notes.push(`以下 ${failed.length} 项校验未通过，需人工复核：${failed.map((c: any) => c.key).join(', ')}`);
    }
    if (warnings.length > 0) {
      notes.push(`以下 ${warnings.length} 项存在警告：${warnings.map((c: any) => c.key).join(', ')}`);
    }
    if (failed.length === 0 && warnings.length === 0) {
      notes.push('当前校验闸无失败/警告，但仍需设计师确认合规与选型。');
    }
    notes.push('LLM 仅做挑错提示，不输出最终合规结论；最终责任由经销商/设计师承担。');

    // 接入统一 AI 网关做自然语言解读（有 ANTHROPIC_API_KEY 走大模型，否则确定性兜底）。
    // 编排铁律：只把「规则已判定的事实」喂给模型展开表述，模型不自出合规结论。
    const facts = [
      ...failed.map((c: any) => `未通过校验：${c.key}${c.message ? `（${c.message}）` : ''}`),
      ...warnings.map((c: any) => `警告校验：${c.key}${c.message ? `（${c.message}）` : ''}`),
    ];
    const prompt = [
      `请用中文、专业克制地向暖通设计师解读以下必算校验闸结果，逐条给出复核建议与可能的整改方向。`,
      `严禁给出"合规/达标"等最终结论（最终由设计师判定），仅做挑错提示。`,
      input.question ? `设计师追加问题：${input.question}` : '',
      failed.length || warnings.length ? `校验事实：\n- ${facts.join('\n- ')}` : '校验事实：本次无失败/警告项。',
    ].filter(Boolean).join('\n');

    let interpretation = '';
    let model = 'stub:deterministic';
    let complianceFlags: string[] = [];
    try {
      const r = await this.aiGateway.generateDraft({
        system: '你是暖通设计复核助手。只对给定校验事实做专业解读与整改提示，不输出最终合规结论，不使用绝对化用语。',
        prompt,
        channel: 'zhihu',
      });
      interpretation = r.draft;
      model = r.model;
      complianceFlags = r.complianceFlags;
    } catch (err: unknown) {
      this.logger.warn(`ai-gateway review failed, notes-only: ${String(err)}`);
    }

    this.logger.log(`[review] project=${projectId} failed=${failed.length} warnings=${warnings.length} model=${model}`);
    return {
      trustState: 'estimate' as const,
      projectId,
      notes,
      interpretation,
      checkedBy: model,
      complianceFlags,
      // 明确声明：非合规结论，仅辅助阅读
      disclaimer: '本解读为 AI 辅助提示，不构成设计合规或选型结论。',
    };
  }

  /**
   * 4.5 · 根据方案推荐产品并生成报价快照（与 quote 模块联动）。
   * 当前会尝试调用 product-catalog 价格带获取真实牌价；未命中时返回占位价格并诚实标注。
   */
  async selectQuote(input: {
    projectId: string;
    proposal: DesignProposal;
    lockMinutes?: number;
  }) {
    const { projectId, proposal } = input;
    const systemCodes = Array.from(new Set(proposal.devices.map((d) => d.systemType).filter(Boolean)));
    const priceBands = systemCodes.length
      ? await this.productCatalog.priceBandsForSystems(
          { tenantId: 'rhautt_shared' }, // 共享目录占位；真实报价需按用户 tenantId/dealerId
          systemCodes.map((code) => ({ code, label: code, keywords: [code] })),
        )
      : { data: { bands: [] } };

    const bands = priceBands.data?.bands ?? [];
    const items = proposal.devices.map((d) => {
      const band = bands.find((b: any) => b.code === d.systemType);
      const price = band?.priced && band.prices?.length ? band.prices[0] : 0;
      return {
        category: 'device',
        name: d.name,
        assetRef: d.assetRef,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        priced: band?.priced ?? false,
      };
    });

    const pipeItems = proposal.pipes.map((p) => ({
      category: 'pipe',
      material: p.material,
      diameterMm: p.diameterMm,
      lengthM: 1,
      unitPrice: 0,
      totalPrice: 0,
      priced: false,
    }));

    const totalEstimate = items.reduce((s, it) => s + Number(it.totalPrice || 0), 0)
      + pipeItems.reduce((s, it) => s + Number(it.totalPrice || 0), 0);

    this.logger.log(`[select-quote] project=${projectId} items=${items.length} total=${totalEstimate}`);
    return {
      quoteId: `quote-stub-${Date.now()}`,
      projectId,
      trustState: proposal.trustState,
      lockedUntil: new Date(Date.now() + (input.lockMinutes ?? 30) * 60 * 1000).toISOString(),
      items: [...items, ...pipeItems],
      totalEstimate,
      note: totalEstimate > 0
        ? '已按 product-catalog 牌价填充设备单价；管材价格待后续接入。'
        : '报价快照为占位；product-catalog 未命中价格或系统为空，待接入真实价格。',
    };
  }
}
