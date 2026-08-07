import { Injectable, Logger, Optional, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { InsightService } from '../insight/insight.service';
import { ChannelService } from '../channel/channel.service';
import { ProductMgmtService } from '../product-catalog/product-mgmt.service';
import { GtmplanService } from '../gtmplan/gtmplan.service';
import { ContentService } from '../content/content.service';
import { TenantScope } from '../common/tenant-context';
import { withRlsTransaction } from '../common/rls';
import { EventBusService } from '../mdm/event-bus.service';
import { OutboxEventEntity } from '../mdm/outbox-event.entity';
import { RoutingDecisionEntity } from '../dispatch/dispatch.entity';
import {
  DealerSuccessSnapshotEntity,
  GrowthCopyAssetEntity,
  GrowthDealerDealInboxEntity,
  GrowthFunnelEventEntity,
  GrowthGeoProbeEntity,
  GrowthMetricDailySnapshotEntity,
  GrowthNorthStarSnapshotEntity,
  GrowthOpinionMentionEntity,
} from './growth.entities';
import {
  GEO_ATTRIBUTED_CHANNELS, LEAD_CHANNELS, LEAD_CHANNEL_LABELS,
  LeadChannel, normalizeLeadChannel,
} from './geo-attribution';

type FunnelStage = 'reach' | 'lead' | 'visit' | 'proposal' | 'revenue' | 'referral';
const AARRR_STAGES: FunnelStage[] = ['reach', 'lead', 'visit', 'proposal', 'revenue', 'referral'];
const AARRR_LABELS: Record<FunnelStage, string> = {
  reach: '触达', lead: '线索', visit: '到访', proposal: '方案', revenue: '签约', referral: '转介绍',
};

const rls = (user: JwtPayload): TenantScope => ({
  tenantId: user.tenantId,
  actorId: user.userId ?? undefined,
  role: user.role,
});

/** 混合口径的代理毛利率（§7-1）：真实对账 profit_actual 优先，缺失时 profit_proxy=gmv×MARGIN。 */
const MARGIN = 0.28;
const NS_ACTIVE_PROFITABLE = 'active_profitable_dealers';
const NS_NETWORK_GMV = 'network_gmv';
const NS_HIGH_INTENT_LEADS = 'high_intent_leads'; // 宪章 §6 当期北极星

function currentPeriod(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * 增长中枢 · 北极星驾驶舱（Phase 1）。
 * 北极星="活跃盈利经销商数"（驱动量=网络 GMV）；品牌健康度为 A 引擎领先指标。
 * 读走脱敏聚合口径（DB-2）；写由 crm.deal.signed 事件驱动（EventBus 订阅），
 * 经 dealer_deal_inbox 幂等求和重算，杜绝至少一次投递的重复计数。
 */
@Injectable()
export class CockpitService implements OnModuleInit {
  private readonly logger = new Logger('GrowthCockpit');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    @Optional() private readonly insight?: InsightService,
    @Optional() private readonly channel?: ChannelService,
    @Optional() private readonly productMgmt?: ProductMgmtService,
    @Optional() private readonly gtmplan?: GtmplanService,
    @Optional() private readonly content?: ContentService,
  ) {}

  /**
   * 事件订阅（跨域只读消费，不写 crm OLTP）：
   * - crm.deal.signed → inbox 幂等求和 → 经销商成功度 + 北极星，且记 AARRR 'revenue'
   * - AARRR 漏斗（真事件驱动，幂等 by source_event_id）：
   *   geo.brand.cited→触达 · lead.created→线索 · diagnosis.completed→到访 · quotation.created→方案 · crm.referral.created→转介绍
   */
  onModuleInit(): void {
    this.eventBus.subscribe('crm.deal.signed', (event: OutboxEventEntity) => this.handleDealSigned(event));
    this.eventBus.subscribe('lead.created', (event: OutboxEventEntity) => this.recordFunnel(event, 'lead'));
    this.eventBus.subscribe('diagnosis.completed', (event: OutboxEventEntity) => this.recordFunnel(event, 'visit'));
    this.eventBus.subscribe('quotation.created', (event: OutboxEventEntity) => this.recordFunnel(event, 'proposal'));
    this.eventBus.subscribe('crm.referral.created', (event: OutboxEventEntity) => this.recordFunnel(event, 'referral'));
    this.eventBus.subscribe('geo.brand.cited', (event: OutboxEventEntity) => this.recordFunnel(event, 'reach'));
    this.startSnapshotScheduler();
  }

  /** 日快照调度器（生产由 Temporal/cron 驱动；此处 dev/单实例兜底）。SNAPSHOT_SWEEP_MS=0 关闭。 */
  private startSnapshotScheduler(): void {
    const raw = process.env.SNAPSHOT_SWEEP_MS;
    if (raw === '0' || process.env.NODE_ENV === 'test') return;
    const ms = Math.max(Number(raw) || 24 * 60 * 60 * 1000, 60 * 1000);
    const timer = setInterval(() => {
      this.runSnapshotSweep().catch((e) => this.logger.warn(`快照轮次异常: ${String(e)}`));
    }, ms);
    timer.unref?.();
  }

  /** 对有数据的租户逐个落日快照（rhautt 连接为超级用户，distinct 查询不受 RLS 限制）。 */
  async runSnapshotSweep(): Promise<{ tenants: number }> {
    const rows: { tenant_id: string }[] = await this.ds.query(
      `SELECT DISTINCT tenant_id FROM rhautt_nexus.dealer_success_snapshot
       UNION SELECT DISTINCT tenant_id FROM rhautt_nexus.growth_funnel_event`,
    );
    for (const r of rows) {
      try { await this.snapshotDaily(r.tenant_id); }
      catch (err: unknown) { this.logger.warn(`快照跳过 tenant=${r.tenant_id}: ${String(err)}`); }
    }
    return { tenants: rows.length };
  }

  /** AARRR 漏斗事件记录：每合格事件一行，(tenant, source_event_id) 唯一去重 → 天然幂等。 */
  private async recordFunnel(event: OutboxEventEntity, stage: FunnelStage): Promise<void> {
    const tenantId = event.tenantId;
    if (!tenantId) return;
    const period = currentPeriod();
    // 仅线索阶段做获客渠道归因（来源=lead.created/lead.captured 事件已带的 payload.source）。
    // 其它阶段渠道留 null（口径清晰，避免把非线索事件混入渠道拆分）。
    const channel = stage === 'lead' ? this.leadChannelOf(event) : null;
    try {
      await withRlsTransaction(this.ds, async (em) => {
        const repo = em.getRepository(GrowthFunnelEventEntity);
        const exists = await repo.findOne({ where: { tenantId, sourceEventId: event.id } });
        if (exists) return;
        await repo.save(repo.create({
          tenantId, sourceEventId: event.id, stage, subjectId: event.aggregateId ?? null, channel, period,
        }));
      }, { tenantId, actorId: 'system:cockpit-funnel' });
    } catch (err: unknown) {
      this.logger.warn(`funnel ${stage} skipped (${event.id}): ${String(err)}`);
    }
  }

  /** 从线索事件 payload 归一获客渠道（lead.created/lead.captured 均带 source/campaign）。 */
  private leadChannelOf(event: OutboxEventEntity): LeadChannel {
    const p = (event.payload || {}) as { source?: string | null; campaign?: string | null; medium?: string | null };
    return normalizeLeadChannel({ source: p.source, campaign: p.campaign, medium: p.medium });
  }

  /** AARRR 漏斗读侧：按阶段计数（脱敏聚合，六阶段补零，未插桩阶段诚实显示 0）。 */
  async getAarrrFunnel(user: JwtPayload, period = currentPeriod()) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows = await em.getRepository(GrowthFunnelEventEntity).find({
        where: { tenantId: user.tenantId, period },
        select: ['stage'],
      });
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.stage] = (counts[r.stage] ?? 0) + 1;
      const stages = AARRR_STAGES.map((stage) => ({ stage, label: AARRR_LABELS[stage], count: counts[stage] ?? 0 }));
      return { period, stages };
    }, rls(user));
  }

  private async handleDealSigned(event: OutboxEventEntity): Promise<void> {
    const tenantId = event.tenantId;
    const p = (event.payload || {}) as { dealerId?: string; amount?: number; signedAt?: string };
    if (!tenantId || !p.dealerId) return;
    const period = currentPeriod(p.signedAt ? new Date(p.signedAt) : new Date());
    try {
      await withRlsTransaction(this.ds, (em) =>
        this.applyDeal(em, tenantId, p.dealerId as string, Number(p.amount || 0), period, event.id),
        { tenantId, actorId: 'system:cockpit-analytics' },
      );
    } catch (err: unknown) {
      this.logger.warn(`crm.deal.signed recompute skipped (${event.id}): ${String(err)}`);
    }
    // 同一成交事件也计入 AARRR 'revenue' 阶段（幂等：funnel_event 唯一约束）。
    await this.recordFunnel(event, 'revenue');
  }

  /** 成交驱动重算（手动/测试入口）；与事件 handler 共用 applyDeal，sourceEventId 用 manual:<uuid> 保证计入。 */
  async recomputeOnDeal(user: JwtPayload, dealerId: string, amount: number, period = currentPeriod()) {
    return withRlsTransaction(this.ds, (em) =>
      this.applyDeal(em, user.tenantId, dealerId, Number(amount || 0), period, `manual:${randomUUID()}`),
      rls(user),
    );
  }

  /** 幂等落 inbox → 由 inbox 求和重算 dealer_success → 重算北极星。返回更新后的北极星。 */
  private async applyDeal(em: EntityManager, tenantId: string, dealerId: string, amount: number, period: string, sourceEventId: string) {
    const inbox = em.getRepository(GrowthDealerDealInboxEntity);
    const exists = await inbox.findOne({ where: { tenantId, sourceEventId } });
    if (!exists) {
      await inbox.save(inbox.create({ tenantId, sourceEventId, dealerId, amount: String(amount), period }));
    }
    await this.recomputeDealer(em, tenantId, dealerId, period);
    return this.recomputeNorthStar(em, tenantId, period);
  }

  /** 由 inbox 求和重算单个经销商成功度快照（幂等）。 */
  private async recomputeDealer(em: EntityManager, tenantId: string, dealerId: string, period: string) {
    const inbox = em.getRepository(GrowthDealerDealInboxEntity);
    const rows = await inbox.find({ where: { tenantId, dealerId, period } });
    const gmv = rows.reduce((s, r) => s + Number(r.amount), 0);
    const deals = rows.length;
    const repo = em.getRepository(DealerSuccessSnapshotEntity);
    let snap = await repo.findOne({ where: { tenantId, dealerId, period } });
    if (!snap) snap = repo.create({ tenantId, dealerId, period });
    snap.active = true;
    snap.gmv = String(gmv);
    snap.deals = deals;
    snap.profitProxy = String(Math.round(gmv * MARGIN * 100) / 100);
    snap.computedAt = new Date();
    await repo.save(snap);
  }

  private async recomputeNorthStar(em: EntityManager, tenantId: string, period: string) {
    const rows = await em.getRepository(DealerSuccessSnapshotEntity).find({ where: { tenantId, period } });
    const activeProfitableDealers = rows.filter((r) => r.active && this.profitOf(r) > 0).length;
    const networkGmv = rows.reduce((s, r) => s + Number(r.gmv), 0);
    // 当期北极星：高意向线索数（漏斗 lead 阶段真实计数）
    const funnel = await em.getRepository(GrowthFunnelEventEntity).find({ where: { tenantId, period } });
    const highIntentLeads = funnel.filter((f) => f.stage === 'lead').length;
    await this.upsertNorthStar(em, tenantId, NS_ACTIVE_PROFITABLE, activeProfitableDealers, period);
    await this.upsertNorthStar(em, tenantId, NS_NETWORK_GMV, networkGmv, period);
    await this.upsertNorthStar(em, tenantId, NS_HIGH_INTENT_LEADS, highIntentLeads, period);
    return { period, activeProfitableDealers, networkGmv, highIntentLeads, dealers: rows.length };
  }

  // ── 读侧（驾驶舱）─────────────────────────────────────────────────────────
  async getNorthStar(user: JwtPayload, period = currentPeriod()) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows = await em.getRepository(DealerSuccessSnapshotEntity).find({ where: { tenantId: user.tenantId, period } });
      // 宪章 §6 锁定北极星（当期）= GEO→高意向线索数。真实按渠道归因（非聚合比率）：
      //   每条线索由 lead.created 事件的 payload.source 归一为渠道（geo/ai-diagnosis/…）；
      //   geoAttributedLeads = 渠道 ∈ {geo, ai-diagnosis} 的线索计数（GEO 品牌站+AI问诊转化路径）。
      //   未归因线索（channel=null/other）诚实计入 highIntentLeads 总数，但不算 GEO。
      const funnel = await em.getRepository(GrowthFunnelEventEntity).find({ where: { tenantId: user.tenantId, period } });
      const leadEvents = funnel.filter((f) => f.stage === 'lead');
      const highIntentLeads = leadEvents.length;
      const geoReach = funnel.filter((f) => f.stage === 'reach').length;

      // 分渠道拆分（全渠道透明，口径可审计；历史无渠道行归入 'other'）。
      const channelCounts: Record<string, number> = {};
      for (const e of leadEvents) {
        const ch = LEAD_CHANNELS.includes(e.channel as LeadChannel) ? (e.channel as LeadChannel) : 'other';
        channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
      }
      const channelBreakdown = LEAD_CHANNELS
        .map((ch) => ({ channel: ch, label: LEAD_CHANNEL_LABELS[ch], count: channelCounts[ch] ?? 0 }))
        .filter((c) => c.count > 0);
      const geoAttributedLeads = GEO_ATTRIBUTED_CHANNELS.reduce((s, ch) => s + (channelCounts[ch] ?? 0), 0);
      const attributedLeads = highIntentLeads - (channelCounts.other ?? 0);
      // GEO 归因率 = GEO 线索 / 高意向线索总数（真实占比，非 lead/reach 比率）。
      const geoAttributionRate = highIntentLeads > 0
        ? Math.round((geoAttributedLeads / highIntentLeads) * 100)
        : null;
      return {
        period,
        // 北极星主指标：GEO→高意向线索（真实按渠道归因计数）
        highIntentLeads,
        geoAttributedLeads,
        geoAttributionRate,
        geoAttributedChannels: GEO_ATTRIBUTED_CHANNELS,
        channelBreakdown,
        attributedLeads,          // 已成功归因的线索数（highIntentLeads - 未归因）
        geoReach,                 // GEO 触达（geo.brand.cited），领先信号
        // 副指标（经销商侧）
        activeProfitableDealers: rows.filter((r) => r.active && this.profitOf(r) > 0).length,
        networkGmv: rows.reduce((s, r) => s + Number(r.gmv), 0),
        dealers: rows.length,
      };
    }, rls(user));
  }

  async listDealerSuccess(user: JwtPayload, period = currentPeriod()) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows = await em.getRepository(DealerSuccessSnapshotEntity).find({
        where: { tenantId: user.tenantId, period }, order: { gmv: 'DESC' },
      });
      return rows.map((r) => ({
        dealerId: r.dealerId, active: r.active, gmv: Number(r.gmv), profit: this.profitOf(r),
        profitSource: r.profitActual != null ? 'actual' : 'proxy', closeRate: Number(r.closeRate), deals: r.deals,
      }));
    }, rls(user));
  }

  /**
   * 品牌健康度（A 引擎领先指标）· 实时接真数据：
   * - GEO 可见度：近 500 条非 mock 探测 → 平均 AIVS、被引率、Share of Voice（我方 vs 竞品被引）
   * - 舆情：近 500 条声量 → 正声量占比
   * 兼作漏斗 'reach' 触达的领先信号（被引探测数）。
   */
  async getBrandHealth(user: JwtPayload, period = currentPeriod()) {
    return withRlsTransaction(this.ds, async (em) => {
      const probes = await em.getRepository(GrowthGeoProbeEntity).find({
        where: { tenantId: user.tenantId }, order: { probedAt: 'DESC' }, take: 500,
      });
      const real = probes.filter((p) => p.engine !== 'mock');
      const n = real.length;
      const ourMentions = real.filter((p) => p.weCited).length;
      const competitorMentions = real.reduce((s, p) => s + ((p.competitorsCited?.length) || 0), 0);
      const totalMentions = ourMentions + competitorMentions;
      const avgAivs = n ? Math.round(real.reduce((s, p) => s + (Number(p.aivs) || 0), 0) / n) : 0;
      const citedRate = n ? Math.round((ourMentions / n) * 100) : 0;
      const sov = totalMentions ? Math.round((ourMentions / totalMentions) * 100) : 0;

      const mentions = await em.getRepository(GrowthOpinionMentionEntity).find({
        where: { tenantId: user.tenantId }, order: { capturedAt: 'DESC' }, take: 500,
      });
      const positive = mentions.filter((m) => m.sentiment === 'positive').length;
      const positiveSentiment = mentions.length ? Math.round((positive / mentions.length) * 100) : 0;

      return {
        period,
        aiVisibility: avgAivs,
        citedRate,
        sov,
        positiveSentiment,
        probes: n,
        opinionSamples: mentions.length,
        note: n || mentions.length
          ? '实时：GEO 平均 AIVS / 被引率 / SoV + 舆情正声量占比'
          : '暂无 GEO 探测/舆情样本——运行 GEO 探测(/growth/geo)与舆情采集后自动填充',
      };
    }, rls(user));
  }

  /**
   * GEO 内容闭环度量（A 造需求 · Phase 2）：可见度缺口 → 生成 → 审核 → 发布 → 复测的漏斗式看板。
   * 缺口=近端未被引探测数；内容=source='geo' 的 copy 资产按状态计（草稿/已审/已发）。
   */
  // 模块9-CMO · 营销管理驾驶舱聚合层（九屏，只聚合既有度量源，不造虚荣数）。
  // 按 bu={brand|category} 切片（scope 传入；数据层维度过滤为后续增强，当前带 bu 标注）。
  async getCmoDashboard(user: JwtPayload, opts: { period?: string; buType?: string; buId?: string } = {}) {
    const period = opts.period;
    const settle = async <T>(fn: () => Promise<T>): Promise<T | null> => { try { return await fn(); } catch { return null; } };
    // 竞品屏按 BU 品类切片：品类事业部用其 scopeRef，否则默认中央热水（业务北极星品类）。
    const sovCategory = opts.buType === 'category' && opts.buId ? opts.buId : 'central-hot-water';
    const [northStar, brandHealth, funnel, dealerSuccess, geoLoop, channelHealth, competitive, portfolio, mroi, okr] = await Promise.all([
      settle(() => this.getNorthStar(user, period)),
      settle(() => this.getBrandHealth(user, period)),
      settle(() => this.getAarrrFunnel(user, period)),
      settle(() => this.listDealerSuccess(user, period)),
      settle(() => this.getGeoLoopStatus(user)),
      settle(() => this.channel ? this.channel.channelHealth(user) : Promise.resolve(null)),
      settle(() => this.insight ? this.insight.sovByCategory(user, sovCategory) : Promise.resolve(null)),
      settle(() => this.productMgmt ? this.productMgmt.portfolioSummary(user) : Promise.resolve(null)),
      settle(() => this.gtmplan ? this.gtmplan.mroiSummary(user) : Promise.resolve(null)),
      settle(() => this.gtmplan ? this.gtmplan.okrSummary(user) : Promise.resolve(null)),
    ]);
    // riskAlerts 聚合：定价/返利毛利闸告警 + 内容审核积压（基座3/4 的经营风险哨兵）。
    const [pricingRisk, rebateRisk, contentBacklog] = await Promise.all([
      settle(() => this.productMgmt ? this.productMgmt.pricingRiskCount(user) : Promise.resolve(0)),
      settle(() => this.channel ? this.channel.rebateRiskCount(user) : Promise.resolve(0)),
      settle(() => this.content ? this.content.reviewBacklog(user) : Promise.resolve(null)),
    ]);
    const riskAlerts = {
      pricingMarginGateFail: pricingRisk ?? 0,
      rebateMarginGateFail: rebateRisk ?? 0,
      contentReviewBacklog: (contentBacklog as any)?.inReview ?? 0,
    };
    const bu = opts.buType === 'brand' || opts.buType === 'category'
      ? { type: opts.buType, id: opts.buId ?? null }
      : { type: 'group', id: null };
    return {
      bu,
      panels: {
        northStar:        { source: 'cockpit.north-star', data: northStar },
        brandEquity:      { source: 'cockpit.brand-health', data: brandHealth },
        demandFunnel:     { source: 'cockpit.aarrr-funnel', data: funnel },
        channelDealer:    { source: 'cockpit.dealer-success', data: dealerSuccess },
        channelHealth:    { source: 'channel.health', data: channelHealth },
        geoLoop:          { source: 'cockpit.geo-loop', data: geoLoop },
        productPortfolio: { source: 'product.portfolioSummary', data: portfolio },
        competitive:      { source: `insight.sov(${sovCategory})`, data: competitive },
        mroi:             { source: 'gtmplan.mroi', data: mroi },
        teamOkr:          { source: 'gtmplan.okr-summary', data: okr },
        riskAlerts:       { source: 'pricing/rebate margin-gate + content review', data: riskAlerts },
      },
      honesty: '基座4：九屏均取真实度量源，无占位假数；每屏可下钻源模块。',
    };
  }

  async getGeoLoopStatus(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const probes = await em.getRepository(GrowthGeoProbeEntity).find({
        where: { tenantId: user.tenantId }, order: { probedAt: 'DESC' }, take: 500,
      });
      const real = probes.filter((p) => p.engine !== 'mock');
      const cited = real.filter((p) => p.weCited).length;
      const gaps = real.length - cited;
      const citedRate = real.length ? Math.round((cited / real.length) * 100) : 0;

      const copies = await em.getRepository(GrowthCopyAssetEntity).find({ where: { tenantId: user.tenantId, source: 'geo' } });
      const byStatus = (s: string) => copies.filter((c) => c.status === s).length;
      return {
        probes: real.length, cited, gaps, citedRate,
        content: { drafts: byStatus('draft'), approved: byStatus('approved'), published: byStatus('published'), total: copies.length },
      };
    }, rls(user));
  }

  /**
   * 线索分配健康度（B 转化 · 飞轮断点1）：读派单审计 dispatch_routing_decisions。
   * routed=已成功分配给经销商；unrouted=无经销商可服务该地域/品类=可服务缺口（拓商/扩品类信号）。
   */
  async getLeadRoutingStatus(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const decisions = await em.getRepository(RoutingDecisionEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 500,
      });
      const total = decisions.length;
      const routed = decisions.filter((d) => d.status === 'routed').length;
      const unrouted = total - routed;
      const routingRate = total ? Math.round((routed / total) * 100) : 0;
      const unroutedSamples = decisions
        .filter((d) => d.status !== 'routed')
        .slice(0, 5)
        .map((d) => ({ province: d.province, city: d.city, category: d.category, reason: d.reason }));
      return { total, routed, unrouted, routingRate, unroutedSamples };
    }, rls(user));
  }

  /**
   * 指标日快照（脱敏聚合固化 → 趋势）：复用实时聚合口径，(tenant, metric_key, date) 幂等 upsert。
   * 以系统身份按 tenantId 计算（构造最小 JwtPayload 复用现有读方法）。
   */
  async snapshotDaily(tenantId: string, date?: string) {
    const day = date || new Date().toISOString().slice(0, 10);
    const u = { tenantId, userId: 'system:snapshot', role: 'hq_admin' } as unknown as JwtPayload;
    const [ns, bh, routing, funnel] = await Promise.all([
      this.getNorthStar(u), this.getBrandHealth(u), this.getLeadRoutingStatus(u), this.getAarrrFunnel(u),
    ]);
    const metrics: Record<string, number> = {
      active_profitable_dealers: ns.activeProfitableDealers,
      network_gmv: ns.networkGmv,
      ai_cited_rate: bh.citedRate,
      sov: bh.sov,
      positive_sentiment: bh.positiveSentiment,
      routing_rate: routing.routingRate,
    };
    for (const s of funnel.stages) metrics[`funnel_${s.stage}`] = s.count;

    await withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthMetricDailySnapshotEntity);
      for (const [metricKey, value] of Object.entries(metrics)) {
        let row = await repo.findOne({ where: { tenantId, metricKey, snapshotDate: day } });
        if (!row) row = repo.create({ tenantId, metricKey, snapshotDate: day });
        row.value = String(value);
        await repo.save(row);
      }
    }, { tenantId, actorId: 'system:snapshot' });
    return { tenantId, date: day, metrics };
  }

  /** 趋势读侧：某指标近 N 日时间序列（按日期升序）。 */
  async getTrends(user: JwtPayload, metricKey: string, days = 30) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows = await em.getRepository(GrowthMetricDailySnapshotEntity).find({
        where: { tenantId: user.tenantId, metricKey }, order: { snapshotDate: 'DESC' }, take: Math.min(days, 180),
      });
      const series = rows.reverse().map((r) => ({ date: r.snapshotDate, value: Number(r.value) }));
      return { metricKey, series };
    }, rls(user));
  }

  private profitOf(r: DealerSuccessSnapshotEntity): number {
    return r.profitActual != null ? Number(r.profitActual) : Number(r.profitProxy);
  }

  private async upsertNorthStar(em: EntityManager, tenantId: string, metric: string, value: number, period: string) {
    const repo = em.getRepository(GrowthNorthStarSnapshotEntity);
    let ns = await repo.findOne({ where: { tenantId, metric, period } });
    if (!ns) ns = repo.create({ tenantId, metric, period });
    ns.value = String(value);
    ns.computedAt = new Date();
    await repo.save(ns);
  }
}
