import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { EventBusService } from '../mdm/event-bus.service';
import { OutboxEventEntity } from '../mdm/outbox-event.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { AiGatewayService } from './ai-gateway.service';
import { AttributionService } from './attribution.service';
import { BrandBrainService } from './brand-brain.service';
import { GeoAnalyzerService } from './geo-analyzer.service';
import { OpinionClassifierService } from './opinion-classifier.service';
import { OpinionSourceService } from './opinion-source.service';
import {
  GrowthCampaignEntity,
  GrowthCampaignMetricEntity,
  GrowthCopyAssetEntity,
  GrowthGeoProbeEntity,
  GrowthOpinionAlertEntity,
  GrowthOpinionMentionEntity,
} from './growth.entities';

const rls = (user: JwtPayload): TenantScope => ({
  tenantId: user.tenantId,
  actorId: user.userId ?? undefined,
  role: user.role,
});

// ── E1 · 舆情监测 Sentiment Radar ───────────────────────────────────────────
@Injectable()
export class GrowthOpinionService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly classifier: OpinionClassifierService,
    private readonly sources: OpinionSourceService,
  ) {}

  /** 采集一条公开源舆情 → AI/启发式分级 → P0/P1 触发危机预警（含话术草稿，待核准）。 */
  async ingestMention(
    user: JwtPayload,
    dto: { source: string; content: string; url?: string; authorHash?: string; entities?: string[] },
  ) {
    if (!dto?.source || !dto?.content) throw new BadRequestException('source and content required');
    const graded = await this.classifier.classify(dto.content);
    const entities = (dto.entities && dto.entities.length ? dto.entities : graded.entities) ?? [];
    return withRlsTransaction(this.ds, async (em) => {
      const mentions = em.getRepository(GrowthOpinionMentionEntity);
      const mention = await mentions.save(mentions.create({
        tenantId: user.tenantId,
        source: dto.source,
        url: dto.url ?? null,
        authorHash: dto.authorHash ?? null,
        content: dto.content,
        sentiment: graded.sentiment,
        intent: graded.intent,
        severity: graded.severity,
        entities,
      }));
      let alertId: string | null = null;
      if (graded.severity === 'P0' || graded.severity === 'P1') {
        const alerts = em.getRepository(GrowthOpinionAlertEntity);
        const alert = await alerts.save(alerts.create({
          tenantId: user.tenantId,
          mentionIds: [mention.id],
          severity: graded.severity,
          status: 'open',
          playbookDraft: `【危机应对话术草稿 · 待核准】就「${dto.content.slice(0, 40)}…」的负面反馈，先致歉共情、给出核实与解决时间线，避免绝对化承诺。`,
        }));
        alertId = alert.id;
        await this.eventBus.publishInTx(em, {
          tenantId: user.tenantId,
          eventType: 'growth.opinion.crisis_detected',
          aggregateType: 'growth_opinion_alert',
          aggregateId: alert.id,
          payload: { alertId: alert.id, mentionId: mention.id, severity: graded.severity, source: dto.source },
        });
      }
      return { success: true, data: { mention, alertId, grading: graded } };
    }, rls(user));
  }

  async listMentions(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthOpinionMentionEntity).find({
        where: { tenantId: user.tenantId }, order: { capturedAt: 'DESC' }, take: 100,
      });
      return { success: true, data: { items } };
    }, rls(user));
  }

  async listAlerts(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthOpinionAlertEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 100,
      });
      return { success: true, data: { items } };
    }, rls(user));
  }

  /**
   * 危机处置闭环：推进预警状态 open → ack（认领/处理中）→ resolved（已解决）。
   * 只允许合法迁移（不可从 resolved 回退），已解决时发 growth.opinion.crisis_resolved 供复盘归档。
   */
  async updateAlertStatus(user: JwtPayload, id: string, dto: { status: string }) {
    const target = String(dto?.status || '').toLowerCase();
    const ALLOWED = ['ack', 'resolved', 'open'];
    if (!ALLOWED.includes(target)) throw new BadRequestException(`status must be one of ${ALLOWED.join('/')}`);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthOpinionAlertEntity);
      const alert = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!alert) throw new BadRequestException('alert not found');
      // 合法迁移矩阵：resolved 为终态，不可回退；open→ack→resolved 前进，允许 ack↔open。
      const transitions: Record<string, string[]> = {
        open: ['ack', 'resolved'],
        ack: ['resolved', 'open'],
        resolved: [],
      };
      const from = (alert.status || 'open').toLowerCase();
      if (from !== target && !(transitions[from] || []).includes(target)) {
        throw new BadRequestException(`illegal transition ${from} → ${target}`);
      }
      alert.status = target;
      await repo.save(alert);
      if (target === 'resolved') {
        await this.eventBus.publishInTx(em, {
          tenantId: user.tenantId,
          eventType: 'growth.opinion.crisis_resolved',
          aggregateType: 'growth_opinion_alert',
          aggregateId: alert.id,
          payload: { alertId: alert.id, severity: alert.severity, resolvedBy: user.userId ?? 'unknown' },
        });
      }
      return { success: true, data: { alert } };
    }, rls(user));
  }

  /** 舆情源连接器就绪度（哪些公开源已接通）。 */
  connectors() {
    return { success: true, data: { connectors: this.sources.statuses() } };
  }

  /** 从指定源拉取原始舆情并逐条分级入库（外部源未配凭证会显式报错）。 */
  async pullFromSource(user: JwtPayload, dto: { source: string; query: string; limit?: number }) {
    if (!dto?.source || !dto?.query) throw new BadRequestException('source and query required');
    const raw = await this.sources.pull(dto.source, dto.query, dto.limit ?? 20);
    const results = [];
    for (const r of raw) {
      results.push(await this.ingestMention(user, { source: r.source, content: r.content, url: r.url, authorHash: r.authorHash }));
    }
    return { success: true, data: { pulled: raw.length, ingested: results.length } };
  }
}

// ── E2 · 文案 Copilot ───────────────────────────────────────────────────────
@Injectable()
export class GrowthCopyService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly ai: AiGatewayService,
    private readonly brandBrain: BrandBrainService,
  ) {}

  /** 生成文案草稿（永远 draft，附合规打标与成本）。经品牌大脑接地：品牌事实+语气+禁语。 */
  async generateCopy(
    user: JwtPayload,
    dto: { channel: string; prompt: string; brandSlug?: string },
  ) {
    if (!dto?.channel || !dto?.prompt) throw new BadRequestException('channel and prompt required');
    const brandCtx = this.brandBrain.context(dto.brandSlug ?? null);
    const result = await this.ai.generateDraft({
      prompt: dto.prompt,
      channel: dto.channel,
      brandSlug: dto.brandSlug ?? null,
      system: this.brandBrain.buildSystemPrompt(dto.brandSlug ?? null),
      bannedTerms: brandCtx ? brandCtx.bannedClaims : this.brandBrain.globalBannedClaims(),
      brand: brandCtx
        ? {
            name: brandCtx.name,
            positioning: brandCtx.positioning,
            facts: brandCtx.facts,
            audiences: brandCtx.audiences,
            tone: brandCtx.tone,
          }
        : null,
    });
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.save(repo.create({
        tenantId: user.tenantId,
        channel: dto.channel,
        brandSlug: dto.brandSlug ?? null,
        prompt: dto.prompt,
        draft: result.draft,
        status: 'draft',
        model: result.model,
        tokensCost: String(result.tokensCost),
        complianceFlags: result.complianceFlags,
      }));
      return { success: true, data: { asset } };
    }, rls(user));
  }

  /** 人工核准闸门：命中合规词禁止核准；核准后发 growth.copy.approved 供归档/发布管线消费。 */
  async approveCopy(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!asset) throw new BadRequestException('copy asset not found');
      if ((asset.complianceFlags || []).length > 0) {
        throw new BadRequestException(`合规词命中，禁止核准：${asset.complianceFlags.join('、')}`);
      }
      asset.status = 'approved';
      asset.reviewer = user.userId ?? 'unknown';
      await repo.save(asset);
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'growth.copy.approved',
        aggregateType: 'growth_copy_asset',
        aggregateId: asset.id,
        payload: { assetId: asset.id, channel: asset.channel, brandSlug: asset.brandSlug, reviewer: asset.reviewer },
      });
      return { success: true, data: { asset } };
    }, rls(user));
  }

  async listCopy(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthCopyAssetEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 100,
      });
      return { success: true, data: { items } };
    }, rls(user));
  }
}

// ── E3 · GEO 分析 GEO Analyzer ──────────────────────────────────────────────
@Injectable()
export class GrowthGeoService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly analyzer: GeoAnalyzerService,
  ) {}

  /**
   * 对一个问题在某引擎跑探测。若给定答案快照，则由 GeoAnalyzer 自动判定我方引用/位次/竞品/AIVS
   * （不轻信调用方自报）；未给快照时回落到调用方提供值（离线/占位）。
   * 真实引擎 HTTP 探测为可插拔外部适配，此处消费其产出的答案快照。
   */
  async probe(
    user: JwtPayload,
    dto: { question: string; engine: string; answerSnapshot?: string; competitors?: string[]; brandSlug?: string; weCited?: boolean; citationRank?: number; competitorsCited?: string[] },
  ) {
    if (!dto?.question || !dto?.engine) throw new BadRequestException('question and engine required');
    const analysis = dto.answerSnapshot
      ? this.analyzer.analyzeAnswer(dto.answerSnapshot, dto.competitors ?? [], dto.brandSlug ?? null)
      : null;
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoProbeEntity);
      const probe = await repo.save(repo.create({
        tenantId: user.tenantId,
        question: dto.question,
        engine: dto.engine,
        answerSnapshot: dto.answerSnapshot ?? null,
        weCited: analysis ? analysis.weCited : (dto.weCited ?? false),
        citationRank: analysis ? analysis.citationRank : (dto.citationRank ?? null),
        competitorsCited: analysis ? analysis.competitorsCited : (dto.competitorsCited ?? []),
      }));
      return { success: true, data: { probe, analysis } };
    }, rls(user));
  }

  /**
   * AI 搜索可见度周报：按引擎聚合我方被引用率 + 平均 AIVS（对已存快照重算），
   * 并附站内可引用度（消费 guard:geo 产物）。
   */
  async visibilityReport(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthGeoProbeEntity).find({
        where: { tenantId: user.tenantId }, order: { probedAt: 'DESC' }, take: 500,
      });
      const byEngine: Record<string, { probes: number; cited: number; aivsSum: number; aivsN: number }> = {};
      const sov = { ourMentions: 0, competitorMentions: 0 };
      const competitorTally: Record<string, number> = {};
      const trustDomains: Record<string, { count: number; ours: boolean }> = {};
      const sentiment = { positive: 0, negative: 0, neutral: 0 };
      let hallucinationCount = 0;
      const hallucinationSamples: { engine: string; reason: string }[] = [];

      for (const p of items) {
        const b = (byEngine[p.engine] ||= { probes: 0, cited: 0, aivsSum: 0, aivsN: 0 });
        b.probes += 1;
        if (p.weCited) b.cited += 1;
        if (p.answerSnapshot) {
          const a = this.analyzer.analyzeAnswer(p.answerSnapshot, p.competitorsCited || []);
          b.aivsSum += a.aivs;
          b.aivsN += 1;
          sov.ourMentions += a.ourMentions;
          sov.competitorMentions += a.competitorMentions;
          sentiment[a.sentiment] += 1;
          for (const c of a.competitorsCited) competitorTally[c] = (competitorTally[c] || 0) + 1;
          for (const t of a.trustSources) {
            const d = (trustDomains[t.domain] ||= { count: 0, ours: t.ours });
            d.count += 1;
          }
          for (const h of a.hallucinationRisks) {
            hallucinationCount += 1;
            if (hallucinationSamples.length < 10) hallucinationSamples.push({ engine: p.engine, reason: h.reason });
          }
        }
      }

      const visibility = Object.entries(byEngine).map(([engine, v]) => ({
        engine, probes: v.probes, cited: v.cited,
        citedRate: v.probes ? Math.round((v.cited / v.probes) * 100) : 0,
        avgAivs: v.aivsN ? Math.round(v.aivsSum / v.aivsN) : 0,
      }));

      // Share of Voice：我方声量占（我方+竞品）总声量比。
      const totalMentions = sov.ourMentions + sov.competitorMentions;
      const shareOfVoice = totalMentions ? Math.round((sov.ourMentions / totalMentions) * 100) : 0;
      // 竞品排行榜（按被引用探测数降序）。
      const leaderboard = Object.entries(competitorTally)
        .map(([competitor, cited]) => ({ competitor, cited }))
        .sort((a, b) => b.cited - a.cited)
        .slice(0, 10);
      const trustSources = Object.entries(trustDomains)
        .map(([domain, v]) => ({ domain, count: v.count, ours: v.ours }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      const playbook = this.analyzer.buildPlaybook(visibility, hallucinationCount);

      return {
        success: true,
        data: {
          visibility,
          shareOfVoice,
          leaderboard,
          sentiment,
          trustSources,
          hallucination: { count: hallucinationCount, samples: hallucinationSamples },
          playbook,
          engines: this.analyzer.engines(),
          onSite: this.analyzer.onSiteReadiness(),
        },
      };
    }, rls(user));
  }

  /** 站内可引用度（schema/alt/sitemap 就绪度），来自 guard:geo 报告。 */
  onSiteReadiness(_user: JwtPayload) {
    return { success: true, data: this.analyzer.onSiteReadiness() };
  }

  /** 多引擎覆盖就绪度。 */
  engines(_user: JwtPayload) {
    return { success: true, data: { engines: this.analyzer.engines() } };
  }

  /** 全周期探测问题集生成（购前/购中/购后 + 追问）。 */
  questionSet(_user: JwtPayload, dto: { brandSlug?: string; category?: string }) {
    return { success: true, data: this.analyzer.generateQuestionSet(dto?.brandSlug ?? null, dto?.category) };
  }

  /** 批量探测工单：问题集 × 引擎，生成待探测清单（供运营逐条取答案快照回填）。 */
  probeWorklist(_user: JwtPayload, dto: { brandSlug?: string; category?: string; engines?: string[] }) {
    return { success: true, data: this.analyzer.buildProbeWorklist(dto?.brandSlug ?? null, dto?.category, dto?.engines) };
  }

  /** 结构化数据自动生成：品牌 JSON-LD + llms.txt（喂 AI 抓取，反制幻觉）。 */
  structuredData(_user: JwtPayload, dto: { brandSlug?: string }) {
    return {
      success: true,
      data: {
        jsonLd: this.analyzer.brandJsonLd(dto?.brandSlug ?? null),
        llmsTxt: this.analyzer.llmsTxt(dto?.brandSlug ?? null),
      },
    };
  }
}

// ── E4 · 营销自动化 Campaign Ops ────────────────────────────────────────────
@Injectable()
export class GrowthCampaignService implements OnModuleInit {
  private readonly logger = new Logger('GrowthCampaign');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly attribution: AttributionService,
  ) {}

  /**
   * 订阅 ingress 发出的真实 lead.captured 事件做归因入账（同租户匹配战役 → 记 leads）。
   * 跨租户（公域暂存 → HQ）归因经分析数仓，不在此物理写入（见 BOARD-3 §2）。
   */
  onModuleInit(): void {
    this.eventBus.subscribe('lead.captured', (event: OutboxEventEntity) => this.attributeCapturedLead(event));
  }

  private async attributeCapturedLead(event: OutboxEventEntity): Promise<void> {
    const tenantId = event.tenantId;
    const payload = (event.payload || {}) as { campaign?: string | null; source?: string | null };
    const campaignKey = payload.campaign;
    if (!tenantId || !campaignKey) return; // 无战役归因维度：跳过（不臆造）
    try {
      await withRlsTransaction(this.ds, async (em) => {
        const campaigns = em.getRepository(GrowthCampaignEntity);
        const all = await campaigns.find({ where: { tenantId }, take: 500 });
        const match = all.find(
          (c) => c.name === campaignKey || (c.utm && (c.utm as Record<string, unknown>).campaign === campaignKey),
        );
        if (!match) return; // 同租户无匹配战役：留给数仓跨域归因
        const metrics = em.getRepository(GrowthCampaignMetricEntity);
        // 幂等：事件总线为「至少一次」投递，用 source_event_id 作 inbox 键。
        // 部分唯一索引 (tenant_id, source_event_id) 使同一事件重投时被 DB 去重，
        // 归因不重复计数（真实归因，不放大 leads）。
        await metrics.save(metrics.create({
          tenantId, campaignId: match.id, leads: 1, period: 'realtime', sourceEventId: event.id,
        }));
      }, { tenantId, actorId: 'system:growth-attribution' });
    } catch (err: unknown) {
      // 23505 = 唯一冲突：该 lead.captured 事件已归因过 → 幂等跳过（非错误）。
      const pgCode = (err as { code?: string; driverError?: { code?: string } })?.code
        ?? (err as { driverError?: { code?: string } })?.driverError?.code;
      if (pgCode === '23505') {
        this.logger.debug(`lead.captured ${event.id} already attributed — idempotent skip`);
        return;
      }
      this.logger.warn(`lead.captured attribution skipped: ${String(err)}`);
    }
  }

  async createCampaign(
    user: JwtPayload,
    dto: { name: string; channel: string; budget?: number; utm?: Record<string, unknown> },
  ) {
    if (!dto?.name || !dto?.channel) throw new BadRequestException('name and channel required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCampaignEntity);
      const campaign = await repo.save(repo.create({
        tenantId: user.tenantId,
        name: dto.name,
        channel: dto.channel,
        budget: String(dto.budget ?? 0),
        utm: dto.utm ?? {},
        status: 'draft',
      }));
      return { success: true, data: { campaign } };
    }, rls(user));
  }

  /** 记录战役指标 + 发 growth.lead.attributed 供 analytics 归因入数仓。 */
  async recordMetric(
    user: JwtPayload,
    dto: { campaignId: string; impressions?: number; clicks?: number; leads?: number; signed?: number; cac?: number; roi?: number; period?: string },
  ) {
    if (!dto?.campaignId) throw new BadRequestException('campaignId required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCampaignMetricEntity);
      const metric = await repo.save(repo.create({
        tenantId: user.tenantId,
        campaignId: dto.campaignId,
        impressions: dto.impressions ?? 0,
        clicks: dto.clicks ?? 0,
        leads: dto.leads ?? 0,
        signed: dto.signed ?? 0,
        cac: String(dto.cac ?? 0),
        roi: String(dto.roi ?? 0),
        period: dto.period ?? null,
      }));
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'growth.lead.attributed',
        aggregateType: 'growth_campaign_metric',
        aggregateId: metric.id,
        payload: { campaignId: dto.campaignId, leads: metric.leads, signed: metric.signed, roi: metric.roi, period: metric.period },
      });
      return { success: true, data: { metric } };
    }, rls(user));
  }

  /** 战役列表（含创建时间/状态/预算，供运营总览与选择）。 */
  async listCampaigns(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthCampaignEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 200,
      });
      return { success: true, data: { items } };
    }, rls(user));
  }

  /**
   * ROI 看板：按战役由预算+指标算真实转化漏斗 + CAC/CPL（非曝光虚荣指标）。
   * 增强：组合级混合 CAC + 逐战役异常预警（零成交/CAC 偏高/留资率过低/无指标），
   * 让看板从「记录」升级为「运营预警」。
   */
  async roiBoard(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const campaigns = await em.getRepository(GrowthCampaignEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 100,
      });
      const metrics = await em.getRepository(GrowthCampaignMetricEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 1000,
      });
      const base = campaigns.map((c) => {
        const ms = metrics.filter((m) => m.campaignId === c.id);
        const agg = {
          impressions: ms.reduce((s, m) => s + m.impressions, 0),
          clicks: ms.reduce((s, m) => s + m.clicks, 0),
          leads: ms.reduce((s, m) => s + m.leads, 0),
          signed: ms.reduce((s, m) => s + m.signed, 0),
        };
        const econ = this.attribution.campaignEconomics(Number(c.budget) || 0, agg);
        return { campaignId: c.id, name: c.name, channel: c.channel, status: c.status, metricCount: ms.length, ...econ };
      });
      const portfolio = base.reduce(
        (s, b) => ({ spend: s.spend + b.spend, leads: s.leads + b.leads, signed: s.signed + b.signed }),
        { spend: 0, leads: 0, signed: 0 },
      );
      const blendedCac = portfolio.signed > 0 ? Math.round((portfolio.spend / portfolio.signed) * 100) / 100 : 0;

      // 逐战役异常预警：真实数据推导，不臆造。
      const board = base.map((b) => {
        const alerts: { level: 'warn' | 'crit'; kind: string; message: string }[] = [];
        if (b.metricCount === 0) {
          alerts.push({ level: 'warn', kind: 'no-metrics', message: '尚无指标录入，无法评估 ROI' });
        } else {
          if (b.spend > 0 && b.signed === 0) {
            alerts.push({ level: 'crit', kind: 'no-conversion', message: `已投入 ¥${b.spend} 但零成交，检查落地页/跟进` });
          }
          if (b.signed > 0 && blendedCac > 0 && b.cac > blendedCac * 2) {
            alerts.push({ level: 'warn', kind: 'high-cac', message: `CAC ¥${b.cac} 高于组合均值(¥${blendedCac})2 倍` });
          }
          if (b.clicks >= 500 && b.leadRate < 0.005) {
            alerts.push({ level: 'warn', kind: 'low-lead-rate', message: `点击 ${b.clicks} 但留资率仅 ${(b.leadRate * 100).toFixed(2)}%，优化承接` });
          }
        }
        return { ...b, alerts };
      });
      const alertCount = board.reduce((s, b) => s + b.alerts.length, 0);
      return { success: true, data: { board, portfolio: { ...portfolio, blendedCac }, alertCount } };
    }, rls(user));
  }
}

export const GROWTH_SERVICES = [
  GrowthOpinionService,
  GrowthCopyService,
  GrowthGeoService,
  GrowthCampaignService,
];
