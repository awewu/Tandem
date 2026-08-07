import { Injectable, Logger } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { AiGatewayService } from './ai-gateway.service';
import { selectStrategies, type GeoContentKind } from './geo-strategies';
import { executeGeoAction, geoActionRegistry, type GeoActionContext } from './geo-actions';
import { GeoFocusService } from './geo-focus.service';

/**
 * AgenticGEO 自主闭环（借鉴 Tandem 分身×搭子；宪章基座4/5：飞轮第一环）。
 * 编排：探测入口 → 选策略(自进化) → 生成(draft) → 受治理动作提案(分区) → lift 验证(占位)。
 * 硬约束(基座4)：无 factRefs 的内容不得对外；写动作经 geo-actions 分区闸(green自动/yellow代行需核准/red人工)；
 *                无 lift 不得标"有效"。推理经 ai-gateway → Tandem governed-chat(provider=hermes-center-ai)。
 */
@Injectable()
export class AgenticGeoService {
  private readonly logger = new Logger('AgenticGeo');

  constructor(private readonly ai: AiGatewayService, private readonly focus: GeoFocusService) {}

  // 品类引爆（借鉴分众"引爆"）：集中火力对一个品类的高优先级选点做千问千面生成，
  // 打透该品类在主流 AI 引擎的答案首选位（受治理·基座4：须事实源+lift）。
  async planIgnition(actor: JwtPayload, category: string, opts: { segment?: string; limit?: number } = {}) {
    const { targets } = await this.focus.selectTargets(actor, category, { segment: opts.segment, limit: Math.min(opts.limit || 5, 10) });
    const kindOf = (scenario?: string | null): GeoContentKind => scenario === 'compare' ? 'comparison' : scenario === 'topic' ? 'topic' : 'faq';
    const plays = [] as any[];
    for (const t of targets as any[]) {
      const kind = kindOf(t.scenario);
      const strategies = selectStrategies(kind).map((s) => s.key);
      const prompt = `【品类引爆·${category}】针对 AI 查询「${t.query}」（人群段=${t.segment || '通用'}/引擎=${t.engine || '全部'}）`
        + `按策略[${strategies.join(', ')}]生成${kind}内容(千问千面)。严格依据产品事实/国标，禁绝对化，无据写"待补充"。`;
      const draft = await this.ai.generateDraft({ prompt, provider: 'hermes-center-ai', bannedTerms: [], requireRealProvider: false });
      plays.push({ targetId: t.id, query: t.query, segment: t.segment, engine: t.engine, priorityScore: t.priorityScore, strategies, draft: { text: draft.draft, provider: draft.provider, complianceFlags: draft.complianceFlags } });
    }
    return {
      mode: 'ignition', category, selected: plays.length, plays,
      governance: '受治理：写动作走分区闸，红/黄区不自动对外；须复投验证 lift 后方可判定有效（基座4）。',
      note: plays.length ? '集中火力已就位——建议对 lift 最高目标 reallocate 加权，持续压强直至答案首选位。' : '该品类暂无选点，请先在 GEO 选点(geo-target)录入高潜查询。',
    };
  }

  private auditFactory(actor: Pick<JwtPayload, 'userId' | 'tenantId'>) {
    return async (event: string, meta: Record<string, unknown>) => {
      this.logger.log(`[audit] ${event} actor=${actor.userId} tenant=${actor.tenantId} ${JSON.stringify(meta)}`);
    };
  }

  /**
   * 生成受治理的 AgenticGEO 计划（不自动对外发布；黄/红区提案待核准）。
   */
  async planLoop(
    actor: JwtPayload,
    input: { topic?: string; kind?: GeoContentKind; factRefs?: Array<{ type: string; id: string }>; bannedTerms?: string[] },
  ) {
    const topic = String(input.topic || '').trim();
    const kind: GeoContentKind = (input.kind as GeoContentKind) || 'faq';
    const factRefs = input.factRefs ?? [];
    const hasFacts = factRefs.length > 0;

    // ① 选策略（自进化：ALWAYS_ON 高增益 + 权重排序；weightOverrides 由实验 lift 提权）
    const strategies = selectStrategies(kind).map((s) => s.key);

    // ② 生成 draft（基座4：无 factRefs 不出对外内容——仅产内部草稿并显式标注）
    const prompt = `围绕主题「${topic || '(未指定)'}」，按 GEO 策略[${strategies.join(', ')}]生成${kind}内容草稿。`
      + `严格依据事实源(${factRefs.map((f) => `${f.type}:${f.id}`).join('; ') || '无——不得杜撰参数'})，禁绝对化/虚假承诺。`;
    const draftRes = await this.ai.generateDraft({ prompt, provider: 'hermes-center-ai', bannedTerms: input.bannedTerms ?? [], requireRealProvider: false });

    // ③ 受治理动作提案（AI 代行 isProxy=true → 黄/红区被拦，返回需核准）
    const ctx: GeoActionContext = { actorUserId: actor.userId, tenantId: actor.tenantId, isProxy: true, role: actor.role };
    const audit = this.auditFactory(actor);
    const proposals = [];
    for (const action of geoActionRegistry.list()) {
      const res = await executeGeoAction(action.id, { topic, draft: draftRes.draft, kind }, ctx, audit);
      proposals.push({ actionId: action.id, label: action.label, zone: action.zone, ok: res.ok, blocked: res.blocked ?? null, needsApproval: !res.ok && res.blocked?.stage === 'gate' && action.zone === 'yellow', checkId: res.checkId });
    }

    return {
      topic, kind, strategies,
      draft: { text: draftRes.draft, provider: draftRes.provider, complianceFlags: draftRes.complianceFlags, factGrounded: hasFacts },
      proposals,
      lift: { status: 'pending', note: '基座4：须复投实验验证 lift，无 lift 不得宣称有效' },
      governance: { registeredActions: geoActionRegistry.list().length, autoPublishBlocked: true },
    };
  }

  /**
   * 黄区代行动作的人工核准执行（approved=true 放行；红区仍不可）。
   */
  async approve(actor: JwtPayload, actionId: string, input: unknown) {
    const ctx: GeoActionContext = { actorUserId: actor.userId, tenantId: actor.tenantId, isProxy: true, approved: true, role: actor.role };
    const res = await executeGeoAction(actionId, input, ctx, this.auditFactory(actor));
    return res;
  }

  status() {
    return { registeredActions: geoActionRegistry.list().map((a) => ({ id: a.id, zone: a.zone, label: a.label })) };
  }
}
