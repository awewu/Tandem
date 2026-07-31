import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, In, IsNull } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { UserEntity } from '../auth/auth.entity';
import { EventBusService } from '../mdm/event-bus.service';
import { OutboxEventEntity } from '../mdm/outbox-event.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { FileArtifactService } from '../file-artifact/file-artifact.service';
import { AiGatewayService } from './ai-gateway.service';
import { AttributionService } from './attribution.service';
import { BrandBrainService } from './brand-brain.service';
import {
  BrandSiteBasicSettingsEntity,
  BrandSiteEntity,
  SiteProductAssignmentEntity,
} from '../brand-registry/brand-site.entity';
import { GeoAnalyzerService } from './geo-analyzer.service';
import { OpinionClassifierService } from './opinion-classifier.service';
import { OpinionSourceService } from './opinion-source.service';
import {
  GrowthCampaignEntity,
  GrowthCampaignMetricEntity,
  GrowthCopyAssetEntity,
  GrowthGeoAnswerSnapshotEntity,
  GrowthGeoProbeBatchEntity,
  GrowthGeoProbeEntity,
  GrowthGeoProbeJobEntity,
  GrowthGeoQuestionEntity,
  GrowthMarketingMaterialEntity,
  GrowthOpinionAlertEntity,
  GrowthOpinionMentionEntity,
} from './growth.entities';

const rls = (user: JwtPayload): TenantScope => ({
  tenantId: user.tenantId,
  actorId: user.userId ?? undefined,
  role: user.role,
});

const COMMON_MATERIAL_CATEGORIES = ['品牌物料', '产品物料', '活动物料', '销售话术', '案例素材', '培训合规'];
const MATERIAL_STATUSES = new Set(['active', 'archived']);
const GEO_ENGINE = 'hermes-center-ai';
const GEO_STAGES = new Set(['pre', 'mid', 'post', 'followup']);
const GEO_BRANDS = new Set(['rheem', 'ruud', 'everhot']);
const DEFAULT_GEO_BRAND = 'rheem';
const GEO_BRAND_DISPLAY_NAMES: Record<string, string> = {
  rheem: '鐟炵編 Rheem',
  ruud: '鐟炲痉 Ruud',
  everhot: '鎭掔儹 Everhot',
};
const TERMINAL_GEO_JOB_STATUSES = new Set(['succeeded', 'failed', 'blocked']);
const COPY_CHANNEL_LABELS: Record<string, string[]> = {
  xiaohongshu: ['小红书', 'xiaohongshu'],
  douyin: ['抖音', 'douyin'],
  wechat: ['公众号', '微信公众号', 'wechat'],
  zhihu: ['知乎', 'zhihu'],
  seo: ['SEO', 'seo'],
  ad: ['广告投放', '广告', 'ad'],
};

type GeoProbeCapture = {
  answerText?: string;
  citations?: Array<Record<string, unknown>>;
  rawHtml?: string | null;
  rawResponse?: Record<string, unknown>;
  screenshotBase64?: string | null;
  blocked?: boolean;
  errorMessage?: string;
};

type GeoProbeStreamEmit = (event: Record<string, unknown>) => void;

type GeoCopyQualityDimension = {
  key: string;
  label: string;
  score: number;
  status: 'good' | 'warning' | 'bad';
  summary: string;
};

type GeoCopyQualityReport = {
  score: number;
  verdict: 'usable' | 'needs-edit' | 'blocked';
  verdictLabel: string;
  summary: string;
  dimensions: GeoCopyQualityDimension[];
  risks: string[];
  suggestions: string[];
  complianceFlags: string[];
};

type GeoOptimizationContentDto = {
  kind: 'faq' | 'comparison' | 'topic';
  question: string;
  probeJobId?: string;
  category?: string;
  answerPreview?: string;
  brandSlug?: string;
  competitors?: string[];
  contentGaps?: Array<Record<string, unknown>>;
  sources?: Array<Record<string, unknown>>;
};

function cleanText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

function cleanNullable(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function cleanTags(value: unknown): string[] {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(source.map((item) => cleanText(item)).filter(Boolean))).slice(0, 24);
}

function cleanGeoBrand(value: unknown): string {
  const brand = cleanText(value, DEFAULT_GEO_BRAND).toLowerCase();
  return GEO_BRANDS.has(brand) ? brand : DEFAULT_GEO_BRAND;
}

function geoBrandDisplayName(brandSlug: string): string {
  return GEO_BRAND_DISPLAY_NAMES[cleanGeoBrand(brandSlug)] || GEO_BRAND_DISPLAY_NAMES[DEFAULT_GEO_BRAND];
}

function normalizeCopyChannelHeading(value: string) {
  return cleanText(value).replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
}

function trimCopyChannelSection(value: string) {
  return cleanText(value).replace(/\n\s*---\s*$/g, '').trim();
}

function extractCopyChannelDraft(draft: string, channel: string) {
  const text = cleanText(draft);
  const labels = (COPY_CHANNEL_LABELS[cleanText(channel)] || [channel]).map(normalizeCopyChannelHeading);
  const matches = Array.from(text.matchAll(/^#{1,6}\s*渠道\s*[：:]\s*([^\n\r#]+)\s*$/gim));
  if (!matches.length) return text;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const heading = normalizeCopyChannelHeading(match[1] || '');
    if (!labels.some((label) => label && heading.includes(label))) continue;
    const start = match.index || 0;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    return trimCopyChannelSection(text.slice(start, end));
  }
  return text;
}

function normalizeGeoQuestionBrandText(question: string, brandSlug: string): string {
  const brand = geoBrandDisplayName(brandSlug);
  return cleanText(question)
    .replace(/鐟炲悎鐟炲痉鏆栭€氱鎶€闆嗗洟/g, brand)
    .replace(/鐟炲悎鐟炲痉/g, brand)
    .replace(/rhautt_comfort/gi, brand)
    .replace(/rhautt-comfort/gi, brand)
    .replace(/Rhautt Comfort Group/g, brand)
    .replace(/Rhautt Comfort/g, brand)
    .replace(/Rhautt/g, brand);
}

function normalizeGeoGeneratedBrandText(text: string, brandSlug: string): string {
  return normalizeGeoQuestionBrandText(text, brandSlug)
    .replace(/瑞诺瓦品牌/g, `${geoBrandDisplayName(brandSlug)}品牌`)
    .replace(/Rysnova品牌/g, `${geoBrandDisplayName(brandSlug)}品牌`);
}

function parseOptionalDate(value: unknown): Date | null {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`invalid date: ${text}`);
  return date;
}

function buildGeoOptimizationPrompt(input: {
  kind: 'faq' | 'comparison' | 'topic';
  question: string;
  brandName: string;
  answerPreview?: string;
  competitors: string[];
  gaps: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  answerLimit: number;
  gapsLimit: number;
  sourcesLimit: number;
}) {
  return [
    `请为 GEO 优化生成${input.kind === 'faq' ? 'FAQ 问答' : input.kind === 'comparison' ? '品牌/方案对比文章草稿' : '官网专题页优化建议'}。`,
    '',
    `目标品牌：${input.brandName}。rhautt_comfort / rhautt-comfort / Rhautt Comfort / 瑞合瑞德是系统或集团上下文，不是本次 GEO 品牌，不要作为品牌名称输出。`,
    `目标问题：${input.question}`,
    input.answerPreview ? `当前 AI 回答摘要：${cleanText(input.answerPreview).slice(0, input.answerLimit)}` : '',
    input.competitors.length ? `已识别竞品：${input.competitors.join('、')}` : '',
    input.gaps.length ? `内容缺口：${JSON.stringify(input.gaps).slice(0, input.gapsLimit)}` : '',
    input.sources.length ? `参考资料：${JSON.stringify(input.sources).slice(0, input.sourcesLimit)}` : '',
    '',
    '输出要求：',
    '- 使用中文。',
    '- 面向市场运营人员，可直接进入草稿审核。',
    '- 不要虚构参数、价格、认证或承诺。',
    '- 没有参考资料支撑的节能比例、质保年限、认证、功能参数、适用面积必须写“待补充”。',
    '- 如果参考资料不足，明确列出需要补充的资料。',
    '- 控制篇幅，先产出可审初稿，不要展开成长文。',
    input.kind === 'faq'
      ? '- 输出 3-5 组 FAQ，每组包含问题、80 字以内回答、建议落地页面。'
      : input.kind === 'comparison'
        ? '- 输出标题、导语、3 个对比维度、正文提纲、我方差异化表达和合规注意点，控制在 650 字以内。'
        : '- 只输出专题页落地大纲，控制在 350 字以内：页面标题、首屏卖点、3 个内容模块、3 组 FAQ、Schema 建议和素材需求；不要写具体数值承诺。',
  ].filter(Boolean).join('\n');
}

// 鈹€鈹€ E1 · 鑸嗘儏鐩戞祴 Sentiment Radar 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
@Injectable()
export class GrowthOpinionService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly classifier: OpinionClassifierService,
    private readonly sources: OpinionSourceService,
  ) {}

  /** 閲囬泦涓€鏉″叕寮€婧愯垎鎯?鈫?AI/鍚彂寮忓垎绾?鈫?P0/P1 瑙﹀彂鍗辨満棰勮锛堝惈璇濇湳鑽夌锛屽緟鏍稿噯锛夈€?*/
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
          playbookDraft: `【危机应对话术草稿 · 待核准】就「${dto.content.slice(0, 40)}...」的负面反馈，先致歉共情、给出核实与解决时间线，避免绝对化承诺。`,
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
   * 鍗辨満澶勭疆闂幆锛氭帹杩涢璀︾姸鎬?open 鈫?ack锛堣棰?澶勭悊涓級鈫?resolved锛堝凡瑙ｅ喅锛夈€?
   * 鍙厑璁稿悎娉曡縼绉伙紙涓嶅彲浠?resolved 鍥為€€锛夛紝宸茶В鍐虫椂鍙?growth.opinion.crisis_resolved 渚涘鐩樺綊妗ｃ€?
   */
  async updateAlertStatus(user: JwtPayload, id: string, dto: { status: string }) {
    const target = String(dto?.status || '').toLowerCase();
    const ALLOWED = ['ack', 'resolved', 'open'];
    if (!ALLOWED.includes(target)) throw new BadRequestException(`status must be one of ${ALLOWED.join('/')}`);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthOpinionAlertEntity);
      const alert = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!alert) throw new BadRequestException('alert not found');
      // 鍚堟硶杩佺Щ鐭╅樀锛歳esolved 涓虹粓鎬侊紝涓嶅彲鍥為€€锛沷pen鈫抋ck鈫抮esolved 鍓嶈繘锛屽厑璁?ack鈫攐pen銆?
      const transitions: Record<string, string[]> = {
        open: ['ack', 'resolved'],
        ack: ['resolved', 'open'],
        resolved: [],
      };
      const from = (alert.status || 'open').toLowerCase();
      if (from !== target && !(transitions[from] || []).includes(target)) {
        throw new BadRequestException(`illegal transition ${from} -> ${target}`);
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

  /** 鑸嗘儏婧愯繛鎺ュ櫒灏辩华搴︼紙鍝簺鍏紑婧愬凡鎺ラ€氾級銆?*/
  connectors() {
    return { success: true, data: { connectors: this.sources.statuses() } };
  }

  /** 浠庢寚瀹氭簮鎷夊彇鍘熷鑸嗘儏骞堕€愭潯鍒嗙骇鍏ュ簱锛堝閮ㄦ簮鏈厤鍑瘉浼氭樉寮忔姤閿欙級銆?*/
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

// 鈹€鈹€ E2 · 鏂囨 Copilot 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
@Injectable()
export class GrowthCopyService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly ai: AiGatewayService,
    private readonly brandBrain: BrandBrainService,
  ) {}

  private isReviewerUuid(value: string | null | undefined) {
    return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
  }

  private async reviewerName(em: EntityManager, user: JwtPayload) {
    if (!user.userId) return 'Unknown reviewer';
    const actor = await em.getRepository(UserEntity).findOne({
      where: { tenantId: user.tenantId, id: user.userId } as any,
    });
    return cleanText(actor?.name) || 'Unknown reviewer';
  }

  private async displayReviewerNames(em: EntityManager, user: JwtPayload, items: GrowthCopyAssetEntity[]) {
    const reviewerIds = Array.from(new Set(items.map((item) => item.reviewer).filter((value): value is string => this.isReviewerUuid(value))));
    if (!reviewerIds.length) return items;
    const users = await em.getRepository(UserEntity).find({
      where: { tenantId: user.tenantId, id: In(reviewerIds) } as any,
    });
    const nameById = new Map(users.map((row) => [row.id, cleanText(row.name)]));
    return items.map((item) => ({
      ...item,
      reviewer: this.isReviewerUuid(item.reviewer)
        ? nameById.get(item.reviewer || '') || 'Unknown reviewer'
        : item.reviewer,
    }));
  }
  /** 鐢熸垚鏂囨鑽夌锛堟案杩?draft锛岄檮鍚堣鎵撴爣涓庢垚鏈級銆傜粡鍝佺墝澶ц剳鎺ュ湴锛氬搧鐗屼簨瀹?璇皵+绂佽銆?*/
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
      provider: 'hermes-center-ai',
      requireRealProvider: true,
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
    const draft = extractCopyChannelDraft(result.draft, dto.channel);
    const complianceFlags = this.ai.scanCompliance(
      draft,
      brandCtx ? brandCtx.bannedClaims : this.brandBrain.globalBannedClaims(),
    );
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.save(repo.create({
        tenantId: user.tenantId,
        channel: dto.channel,
        brandSlug: dto.brandSlug ?? null,
        prompt: dto.prompt,
        draft,
        status: 'draft',
        source: result.provider || 'hermes-center-ai',
        model: result.model,
        tokensCost: String(result.tokensCost),
        complianceFlags,
      }));
      return { success: true, data: { asset } };
    }, rls(user));
  }

  /** 浜哄伐鏍稿噯闂搁棬锛氬懡涓悎瑙勮瘝绂佹鏍稿噯锛涙牳鍑嗗悗鍙?growth.copy.approved 渚涘綊妗?鍙戝竷绠＄嚎娑堣垂銆?*/
  async approveCopy(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!asset) throw new BadRequestException('copy asset not found');
      if (asset.status !== 'draft') throw new BadRequestException('only draft copy can be approved');
      if ((asset.complianceFlags || []).length > 0) {
        throw new BadRequestException(`合规词命中，禁止核准：${asset.complianceFlags.join('、')}`);
      }
      asset.status = 'approved';
      asset.reviewer = await this.reviewerName(em, user);
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

  /** 浜哄伐鎷掔粷锛氫粎鑽夌鍙嫆缁濓紝鎷掔粷鍚庝笉杩涘叆鍙戝竷/褰掓。绠＄嚎銆?*/
  async rejectCopy(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!asset) throw new BadRequestException('copy asset not found');
      if (asset.status !== 'draft') throw new BadRequestException('only draft copy can be rejected');
      asset.status = 'rejected';
      asset.reviewer = await this.reviewerName(em, user);
      await repo.save(asset);
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'growth.copy.rejected',
        aggregateType: 'growth_copy_asset',
        aggregateId: asset.id,
        payload: { assetId: asset.id, channel: asset.channel, brandSlug: asset.brandSlug, reviewer: asset.reviewer },
      });
      return { success: true, data: { asset } };
    }, rls(user));
  }

  /** 浜哄伐缂栬緫鑽夌锛氫繚瀛樺悗閲嶆柊鎵撳悎瑙勬爣璁帮紝骞跺洖鍒?draft 瀹℃牳娴併€?*/
  async updateCopy(user: JwtPayload, id: string, dto: { draft?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!asset) throw new BadRequestException('copy asset not found');
      if (asset.status === 'rejected') throw new BadRequestException('rejected copy is discarded and cannot be edited');
      if (typeof dto?.draft !== 'string') throw new BadRequestException('draft required');
      asset.draft = dto.draft;
      asset.status = 'draft';
      asset.reviewer = null;
      const brandCtx = this.brandBrain.context(asset.brandSlug ?? null);
      asset.complianceFlags = this.ai.scanCompliance(
        asset.draft,
        brandCtx ? brandCtx.bannedClaims : this.brandBrain.globalBannedClaims(),
      );
      await repo.save(asset);
      return { success: true, data: { asset } };
    }, rls(user));
  }

  async removeCopy(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!asset) throw new BadRequestException('copy asset not found');
      if (asset.status !== 'rejected') throw new BadRequestException('only rejected copy can be deleted');
      await repo.delete({ tenantId: user.tenantId, id } as any);
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'growth.copy.deleted',
        aggregateType: 'growth_copy_asset',
        aggregateId: id,
        payload: { assetId: id, channel: asset.channel, brandSlug: asset.brandSlug, status: asset.status },
      });
      return { success: true, data: { id, removed: true } };
    }, rls(user));
  }

  async listCopy(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthCopyAssetEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 100,
      });
      return { success: true, data: { items: await this.displayReviewerNames(em, user, items) } };
    }, rls(user));
  }
}

// 鈹€鈹€ E3 · GEO 鍒嗘瀽 GEO Analyzer 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
@Injectable()
export class GrowthGeoService {
  private readonly logger = new Logger('GrowthGeoService');
  private readonly activeBatchRuns = new Set<string>();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly analyzer: GeoAnalyzerService,
    private readonly files: FileArtifactService,
    private readonly ai: AiGatewayService,
    private readonly brandBrain: BrandBrainService,
  ) {}

  /**
   * 瀵逛竴涓棶棰樺湪鏌愬紩鎿庤窇鎺㈡祴銆傝嫢缁欏畾绛旀蹇収锛屽垯鐢?GeoAnalyzer 鑷姩鍒ゅ畾鎴戞柟寮曠敤/浣嶆/绔炲搧/AIVS
   * 锛堜笉杞讳俊璋冪敤鏂硅嚜鎶ワ級锛涙湭缁欏揩鐓ф椂鍥炶惤鍒拌皟鐢ㄦ柟鎻愪緵鍊硷紙绂荤嚎/鍗犱綅锛夈€?
   * 鐪熷疄寮曟搸 HTTP 鎺㈡祴涓哄彲鎻掓嫈澶栭儴閫傞厤锛屾澶勬秷璐瑰叾浜у嚭鐨勭瓟妗堝揩鐓с€?
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
   * AI 鎼滅储鍙搴﹀懆鎶ワ細鎸夊紩鎿庤仛鍚堟垜鏂硅寮曠敤鐜?+ 骞冲潎 AIVS锛堝宸插瓨蹇収閲嶇畻锛夛紝
   * 骞堕檮绔欏唴鍙紩鐢ㄥ害锛堟秷璐?guard:geo 浜х墿锛夈€?
   */
  async visibilityReport(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const allItems = await em.getRepository(GrowthGeoProbeEntity).find({
        where: { tenantId: user.tenantId }, order: { probedAt: 'DESC' }, take: 500,
      });
      const items = allItems.filter((item) => item.engine !== 'mock');
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

      // Share of Voice锛氭垜鏂瑰０閲忓崰锛堟垜鏂?绔炲搧锛夋€诲０閲忔瘮銆?
      const totalMentions = sov.ourMentions + sov.competitorMentions;
      const shareOfVoice = totalMentions ? Math.round((sov.ourMentions / totalMentions) * 100) : 0;
      // 绔炲搧鎺掕姒滐紙鎸夎寮曠敤鎺㈡祴鏁伴檷搴忥級銆?
      const leaderboard = Object.entries(competitorTally)
        .map(([competitor, cited]) => ({ competitor, cited }))
        .sort((a, b) => b.cited - a.cited)
        .slice(0, 10);
      const trustSources = Object.entries(trustDomains)
        .map(([domain, v]) => ({ domain, count: v.count, ours: v.ours }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      const onSite = await this.queryOnSiteReadiness(em, user);
      const playbook = this.analyzer
        .buildPlaybook(visibility, hallucinationCount)
        .filter((task) => task.kind !== 'onsite-schema');
      if (onSite.total > 0 && onSite.ready < onSite.total) {
        playbook.push({
          priority: 'P1',
          kind: 'onsite-schema',
          action: `站内 ${onSite.total - onSite.ready}/${onSite.total} 个对外站点未达到 GEO 基础就绪，需补齐官网 URL、SEO sitemap、组织信息、品牌主张和已发布产品。`,
        });
      }

      return {
        success: true,
        data: {
          visibility,
          recentProbes: items.slice(0, 20).map((p) => ({
            id: p.id,
            question: p.question,
            engine: p.engine,
            weCited: p.weCited,
            citationRank: p.citationRank,
            competitorsCited: p.competitorsCited || [],
            probedAt: p.probedAt,
            hasSnapshot: Boolean(p.answerSnapshot),
          })),
          shareOfVoice,
          leaderboard,
          sentiment,
          trustSources,
          hallucination: { count: hallucinationCount, samples: hallucinationSamples },
          playbook,
          engines: this.analyzer.engines(),
          onSite,
          recentJobs: await this.recentProbeJobs(em, user),
        },
      };
    }, rls(user));
  }

  /** 绔欏唴鍙紩鐢ㄥ害锛氬疄鏃舵煡璇㈠搧鐗岀珯銆佺珯鐐瑰熀纭€璁剧疆鍜屼骇鍝佹寕杞芥暟鎹€?*/
  async onSiteReadiness(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      success: true,
      data: await this.queryOnSiteReadiness(em, user),
    }), rls(user));
  }

  /** 澶氬紩鎿庤鐩栧氨缁害銆?*/
  engines(_user: JwtPayload) {
    const engines = this.analyzer.engines().map((engine) => {
      if (engine.engine !== 'hermes-center-ai') return engine;
      const baseUrl = cleanText(process.env.HERMES_CENTER_AI_BASE_URL, 'https://ai.rhautt.com');
      const provider = cleanText(process.env.HERMES_CENTER_AI_PROVIDER, 'qwen-max') || 'qwen-max';
      const authToken = cleanText(process.env.HERMES_CENTER_AI_AUTH_TOKEN);
      return {
        ...engine,
        status: baseUrl ? 'ready' : engine.status,
        baseUrl,
        provider,
        healthUrl: `${baseUrl.replace(/\/+$/, '')}/api/llm-health`,
        streamUrl: `${baseUrl.replace(/\/+$/, '')}/api/llm-stream`,
        authConfigured: Boolean(authToken),
        note: authToken
          ? 'Hermes center AI configured; request will use configured Bearer token.'
          : 'Hermes center AI endpoint configured; stream call still needs a Hermes/Tandem OIDC access token.',
      };
    });
    return { success: true, data: { engines } };
  }

  /** 鍏ㄥ懆鏈熸帰娴嬮棶棰橀泦鐢熸垚锛堣喘鍓?璐腑/璐悗 + 杩介棶锛夈€?*/
  async questionSet(user: JwtPayload, dto: { brandSlug?: string; category?: string; stage?: string; enabled?: boolean | string }) {
    const brandSlug = cleanGeoBrand(dto?.brandSlug);
    const category = cleanText(dto?.category, 'home-comfort') || 'home-comfort';
    const stage = cleanText(dto?.stage);
    return withRlsTransaction(this.ds, async (em) => {
      const where: any = { tenantId: user.tenantId, brandSlug, category };
      if (GEO_STAGES.has(stage)) where.stage = stage;
      if (dto?.enabled !== undefined) where.enabled = dto.enabled === true || dto.enabled === 'true';
      const items = await em.getRepository(GrowthGeoQuestionEntity).find({
        where,
        order: { priority: 'ASC', createdAt: 'ASC' },
        take: 200,
      });
      const repo = em.getRepository(GrowthGeoQuestionEntity);
      for (const item of items) {
        const normalizedQuestion = normalizeGeoQuestionBrandText(item.question, brandSlug);
        if (normalizedQuestion && normalizedQuestion !== item.question) {
          item.question = normalizedQuestion;
          await repo.save(item);
        }
      }
      const generated = this.analyzer.generateQuestionSet(brandSlug, category);
      return { success: true, data: { brandSlug, category, items, questions: items, generated: generated.questions } };
    }, rls(user));
  }

  /** 鎵归噺鎺㈡祴宸ュ崟锛氶棶棰橀泦 × 寮曟搸锛岀敓鎴愬緟鎺㈡祴娓呭崟锛堜緵杩愯惀閫愭潯鍙栫瓟妗堝揩鐓у洖濉級銆?*/
  async createGeoQuestion(user: JwtPayload, dto: any) {
    const brandSlug = cleanGeoBrand(dto?.brandSlug);
    const category = cleanText(dto?.category, 'home-comfort') || 'home-comfort';
    const stage = cleanText(dto?.stage, 'pre');
    const question = cleanText(dto?.question);
    if (!GEO_STAGES.has(stage)) throw new BadRequestException('invalid GEO question stage');
    if (!question) throw new BadRequestException('question required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoQuestionEntity);
      const item = await repo.save(repo.create({
        tenantId: user.tenantId,
        brandSlug,
        category,
        stage: stage as any,
        question,
        priority: Number(dto?.priority || 100),
        enabled: dto?.enabled !== false,
      }));
      return { success: true, data: { item } };
    }, rls(user));
  }

  async saveGeneratedGeoQuestions(user: JwtPayload, dto: { brandSlug?: string; category?: string; questions?: Array<{ stage?: string; question?: string; priority?: number }> }) {
    const brandSlug = cleanGeoBrand(dto?.brandSlug);
    const category = cleanText(dto?.category, 'home-comfort') || 'home-comfort';
    const source = Array.isArray(dto?.questions) && dto.questions.length
      ? dto.questions
      : this.analyzer.generateQuestionSet(brandSlug, category).questions;
    const rows = source
      .map((item, index) => ({
        stage: cleanText(item.stage, 'pre'),
        question: cleanText(item.question),
        priority: Number((item as any).priority || (index + 1) * 10),
      }))
      .filter((item) => GEO_STAGES.has(item.stage) && item.question);
    if (!rows.length) throw new BadRequestException('no valid questions to save');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoQuestionEntity);
      const existing = await repo.find({ where: { tenantId: user.tenantId, brandSlug, category } as any, take: 500 });
      const existingKey = new Set(existing.map((item) => `${item.stage}::${item.question}`));
      const saved = [];
      for (const item of rows) {
        if (existingKey.has(`${item.stage}::${item.question}`)) continue;
        saved.push(await repo.save(repo.create({
          tenantId: user.tenantId,
          brandSlug,
          category,
          stage: item.stage as any,
          question: item.question,
          priority: item.priority,
          enabled: true,
        })));
      }
      return { success: true, data: { items: saved, saved: saved.length } };
    }, rls(user));
  }

  async updateGeoQuestion(user: JwtPayload, id: string, dto: any) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoQuestionEntity);
      const item = await repo.findOne({ where: { tenantId: user.tenantId, id } as any });
      if (!item) throw new BadRequestException('GEO question not found');
      if (dto.brandSlug !== undefined) item.brandSlug = cleanGeoBrand(dto.brandSlug);
      if (dto.category !== undefined) item.category = cleanText(dto.category, item.category) || item.category;
      if (dto.stage !== undefined) {
        const stage = cleanText(dto.stage);
        if (!GEO_STAGES.has(stage)) throw new BadRequestException('invalid GEO question stage');
        item.stage = stage as any;
      }
      if (dto.question !== undefined) {
        const question = cleanText(dto.question);
        if (!question) throw new BadRequestException('question cannot be empty');
        item.question = question;
      }
      if (dto.priority !== undefined) item.priority = Number(dto.priority || 100);
      if (dto.enabled !== undefined) item.enabled = Boolean(dto.enabled);
      await repo.save(item);
      return { success: true, data: { item } };
    }, rls(user));
  }

  async disableGeoQuestion(user: JwtPayload, id: string) {
    return this.updateGeoQuestion(user, id, { enabled: false });
  }

  async removeGeoQuestion(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoQuestionEntity);
      const item = await repo.findOne({ where: { tenantId: user.tenantId, id } as any });
      if (!item) throw new BadRequestException('GEO question not found');
      await repo.delete({ tenantId: user.tenantId, id } as any);
      return { success: true, data: { id, removed: true } };
    }, rls(user));
  }

  async probeWorklist(user: JwtPayload, dto: { brandSlug?: string; category?: string; stage?: string }) {
    const questions = await this.questionSet(user, { ...dto, enabled: true });
    const items = (questions.data.items || []).map((item: GrowthGeoQuestionEntity) => ({
      id: item.id,
      questionId: item.id,
      question: item.question,
      stage: item.stage,
      priority: item.priority,
      engine: GEO_ENGINE,
      engineReady: true,
    }));
    return { success: true, data: { brandSlug: questions.data.brandSlug, category: questions.data.category, total: items.length, items } };
  }

  /** 缁撴瀯鍖栨暟鎹嚜鍔ㄧ敓鎴愶細鍝佺墝 JSON-LD + llms.txt锛堝杺 AI 鎶撳彇锛屽弽鍒跺够瑙夛級銆?*/
  structuredData(_user: JwtPayload, dto: { brandSlug?: string }) {
    return {
      success: true,
      data: {
        jsonLd: this.analyzer.brandJsonLd(dto?.brandSlug ?? null),
        llmsTxt: this.analyzer.llmsTxt(dto?.brandSlug ?? null),
      },
    };
  }

  async generateOptimizationContent(
    user: JwtPayload,
    dto: GeoOptimizationContentDto,
  ) {
    const kind = cleanText(dto.kind, 'faq') as 'faq' | 'comparison' | 'topic';
    const question = cleanText(dto.question);
    if (!question) throw new BadRequestException('question required');
    if (!['faq', 'comparison', 'topic'].includes(kind)) throw new BadRequestException('invalid optimization content kind');
    const sources = Array.isArray(dto.sources) ? dto.sources.slice(0, kind === 'topic' ? 4 : 6) : [];
    const gaps = Array.isArray(dto.contentGaps) ? dto.contentGaps.slice(0, kind === 'topic' ? 4 : 6) : [];
    const competitors = cleanTags(dto.competitors);
    const answerLimit = kind === 'topic' ? 360 : 700;
    const gapsLimit = kind === 'topic' ? 480 : 700;
    const sourcesLimit = kind === 'topic' ? 520 : 900;
    const brandSlug = cleanGeoBrand(dto.brandSlug);
    const brandName = geoBrandDisplayName(brandSlug);
    const prompt = buildGeoOptimizationPrompt({
      kind,
      question,
      brandName,
      answerPreview: dto.answerPreview,
      competitors,
      gaps,
      sources,
      answerLimit,
      gapsLimit,
      sourcesLimit,
    });
    const captured = await this.runHermesCenterAiProbe(
      prompt,
      undefined,
      { firstByteTimeoutMs: 20000, timeoutMs: kind === 'comparison' ? 90000 : 75000 },
    );
    const draft = normalizeGeoGeneratedBrandText(cleanText(captured.answerText), brandSlug);
    if (!draft) throw new BadRequestException('optimization content empty');
    const brandCtx = this.brandBrain.context(brandSlug ?? null);
    const complianceFlags = this.ai.scanCompliance(
      draft,
      brandCtx ? brandCtx.bannedClaims : this.brandBrain.globalBannedClaims(),
    );
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthCopyAssetEntity);
      const asset = await repo.save(repo.create({
        tenantId: user.tenantId,
        channel: `geo-${kind}`,
        source: 'geo',
        probeJobId: cleanNullable(dto.probeJobId),
        brandSlug,
        category: cleanNullable(dto.category),
        question,
        prompt,
        draft,
        status: 'draft',
        model: cleanText((captured.rawResponse as any)?.provider, 'hermes-center-ai'),
        tokensCost: '0',
        complianceFlags,
      }));
      return { success: true, data: { asset, draft, citations: captured.citations || [] } };
    }, rls(user));
  }

  async streamOptimizationContent(
    user: JwtPayload,
    dto: GeoOptimizationContentDto,
    emit: GeoProbeStreamEmit,
  ) {
    try {
      const kind = cleanText(dto.kind, 'faq') as 'faq' | 'comparison' | 'topic';
      const question = cleanText(dto.question);
      if (!question) throw new BadRequestException('question required');
      if (!['faq', 'comparison', 'topic'].includes(kind)) throw new BadRequestException('invalid optimization content kind');
      const sources = Array.isArray(dto.sources) ? dto.sources.slice(0, kind === 'topic' ? 4 : 6) : [];
      const gaps = Array.isArray(dto.contentGaps) ? dto.contentGaps.slice(0, kind === 'topic' ? 4 : 6) : [];
      const competitors = cleanTags(dto.competitors);
      const answerLimit = kind === 'topic' ? 360 : 700;
      const gapsLimit = kind === 'topic' ? 480 : 700;
      const sourcesLimit = kind === 'topic' ? 520 : 900;
      const brandSlug = cleanGeoBrand(dto.brandSlug);
      const brandName = geoBrandDisplayName(brandSlug);
      const prompt = buildGeoOptimizationPrompt({
        kind,
        question,
        brandName,
        answerPreview: dto.answerPreview,
        competitors,
        gaps,
        sources,
        answerLimit,
        gapsLimit,
        sourcesLimit,
      });

      emit({ type: 'started', kind });
      let streamedDraft = '';
      const captured = await this.runHermesCenterAiProbe(
        prompt,
        (chunk) => {
          const safeChunk = normalizeGeoGeneratedBrandText(chunk, brandSlug);
          streamedDraft += safeChunk;
          emit({ type: 'delta', content: safeChunk });
        },
        { firstByteTimeoutMs: 20000, timeoutMs: kind === 'comparison' ? 90000 : 75000 },
      );
      const draft = normalizeGeoGeneratedBrandText(cleanText(captured.answerText || streamedDraft), brandSlug);
      if (!draft) throw new BadRequestException('optimization content empty');
      const brandCtx = this.brandBrain.context(brandSlug ?? null);
      const complianceFlags = this.ai.scanCompliance(
        draft,
        brandCtx ? brandCtx.bannedClaims : this.brandBrain.globalBannedClaims(),
      );
      const saved = await withRlsTransaction(this.ds, async (em) => {
        const repo = em.getRepository(GrowthCopyAssetEntity);
        const asset = await repo.save(repo.create({
          tenantId: user.tenantId,
          channel: `geo-${kind}`,
          source: 'geo',
          probeJobId: cleanNullable(dto.probeJobId),
          brandSlug,
          category: cleanNullable(dto.category),
          question,
          prompt,
          draft,
          status: 'draft',
          model: cleanText((captured.rawResponse as any)?.provider, 'hermes-center-ai'),
          tokensCost: '0',
          complianceFlags,
        }));
        return { asset, draft, citations: captured.citations || [] };
      }, rls(user));
      emit({ type: 'done', kind, ...saved });
    } catch (error) {
      emit({
        type: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async listProbeJobs(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => ({
      success: true,
      data: { items: await this.recentProbeJobs(em, user, 50) },
    }), rls(user));
  }

  async getProbeJob(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const job = await em.getRepository(GrowthGeoProbeJobEntity).findOne({
        where: { tenantId: user.tenantId, id } as any,
      });
      if (!job) throw new BadRequestException('geo probe job not found');
      const snapshot = job.snapshotId
        ? await em.getRepository(GrowthGeoAnswerSnapshotEntity).findOne({
            where: { tenantId: user.tenantId, id: job.snapshotId } as any,
          })
        : null;
      const probe = job.probeId
        ? await em.getRepository(GrowthGeoProbeEntity).findOne({
            where: { tenantId: user.tenantId, id: job.probeId } as any,
          })
        : null;
      const copyQuality = snapshot?.answerText
        ? this.evaluateGeoCopyQualityV2({
            answerText: snapshot.answerText,
            brandSlug: job.brandSlug,
            competitors: job.competitors || probe?.competitorsCited || [],
            citations: snapshot.citations || [],
            aivs: job.aivs || probe?.aivs || 0,
            weCited: Boolean(probe?.weCited),
            riskReasons: job.riskReasons || [],
          })
        : null;
      return { success: true, data: { job, snapshot, probe, copyQuality } };
    }, rls(user));
  }

  async runProbeBatch(
    user: JwtPayload,
    dto: { brandSlug?: string; category?: string; questionIds?: string[]; stage?: string; competitors?: string[] },
  ) {
    const brandSlug = cleanGeoBrand(dto?.brandSlug);
    const category = cleanText(dto?.category, 'home-comfort') || 'home-comfort';
    const stage = cleanText(dto?.stage);
    const competitors = cleanTags(dto?.competitors);
    const questionIds = cleanTags(dto?.questionIds);
    const created = await withRlsTransaction(this.ds, async (em) => {
      const questionWhere: any = { tenantId: user.tenantId, brandSlug, category, enabled: true };
      if (GEO_STAGES.has(stage)) questionWhere.stage = stage;
      if (questionIds.length) questionWhere.id = In(questionIds);
      const questions = await em.getRepository(GrowthGeoQuestionEntity).find({
        where: questionWhere,
        order: { priority: 'ASC', createdAt: 'ASC' },
        take: 50,
      });
      if (!questions.length) throw new BadRequestException('no enabled GEO questions selected');
      const batch = await em.getRepository(GrowthGeoProbeBatchEntity).save(
        em.getRepository(GrowthGeoProbeBatchEntity).create({
          tenantId: user.tenantId,
          brandSlug,
          category,
          engine: GEO_ENGINE,
          status: 'pending',
          totalProbes: questions.length,
          startedAt: new Date(),
        }),
      );
      const jobRepo = em.getRepository(GrowthGeoProbeJobEntity);
      const jobs = [];
      for (const question of questions) {
        jobs.push(await jobRepo.save(jobRepo.create({
          tenantId: user.tenantId,
          question: question.question,
          engine: GEO_ENGINE,
          brandSlug,
          category,
          stage: question.stage,
          batchId: batch.id,
          questionId: question.id,
          competitors,
          status: 'pending',
        })));
      }
      return { batch, jobs };
    }, rls(user));

    setTimeout(() => {
      this.ensureProbeBatchProcessing(user, created.batch.id);
    }, 0);

    return { success: true, data: { batch: created.batch, jobs: created.jobs, queued: true } };
  }

  async listProbeBatches(user: JwtPayload, query: { brandSlug?: string; category?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: any = { tenantId: user.tenantId };
      const brandSlug = query.brandSlug === undefined ? '' : cleanGeoBrand(query.brandSlug);
      const category = cleanText(query.category);
      if (brandSlug) where.brandSlug = brandSlug;
      if (category) where.category = category;
      const items = await em.getRepository(GrowthGeoProbeBatchEntity).find({
        where,
        order: { createdAt: 'DESC' },
        take: 20,
      });
      return { success: true, data: { items, comparison: this.compareProbeBatches(items.slice(0, 2)) } };
    }, rls(user));
  }

  async getProbeBatch(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const batch = await em.getRepository(GrowthGeoProbeBatchEntity).findOne({
        where: { tenantId: user.tenantId, id } as any,
      });
      if (!batch) throw new BadRequestException('GEO probe batch not found');
      await this.refreshGeoBatchSummary(em, user, id);
      const freshBatch = await em.getRepository(GrowthGeoProbeBatchEntity).findOne({
        where: { tenantId: user.tenantId, id } as any,
      });
      const jobs = await this.jobsForBatch(em, user, id);
      if (freshBatch && ['pending', 'running'].includes(freshBatch.status) && jobs.some((job) => ['pending', 'running'].includes(job.status))) {
        setTimeout(() => this.ensureProbeBatchProcessing(user, id), 0);
      }
      return { success: true, data: { batch: freshBatch || batch, jobs, board: this.buildGeoBoard(jobs) } };
    }, rls(user));
  }

  async runProbeJob(
    user: JwtPayload,
    dto: { question: string; engine?: string; brandSlug?: string; category?: string; stage?: string; batchId?: string; questionId?: string; competitors?: string[] },
  ) {
    const question = cleanText(dto.question);
    const engine = GEO_ENGINE;
    if (!question) throw new BadRequestException('question required');
    const competitors = cleanTags(dto.competitors);
    const brandSlug = cleanGeoBrand(dto.brandSlug);
    const stage = cleanText(dto.stage);
    const job = await withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoProbeJobEntity);
      return repo.save(repo.create({
        tenantId: user.tenantId,
        question,
        engine,
        brandSlug,
        category: cleanNullable(dto.category),
        stage: GEO_STAGES.has(stage) ? stage : null,
        batchId: cleanNullable(dto.batchId),
        questionId: cleanNullable(dto.questionId),
        competitors,
        status: 'running',
        startedAt: new Date(),
      }));
    }, rls(user));

    setTimeout(() => {
      void this.executeProbeJob(user, job.id, {
        question,
        engine,
        brandSlug,
        category: cleanNullable(dto.category),
        stage: GEO_STAGES.has(stage) ? stage : null,
        batchId: cleanNullable(dto.batchId),
        questionId: cleanNullable(dto.questionId),
        competitors,
      });
    }, 0);

    return { success: true, data: { job, queued: true } };
  }

  async streamProbeJob(
    user: JwtPayload,
    dto: { question: string; engine?: string; brandSlug?: string; category?: string; stage?: string; competitors?: string[] },
    emit: GeoProbeStreamEmit,
  ) {
    const question = cleanText(dto.question);
    const engine = GEO_ENGINE;
    if (!question) throw new BadRequestException('question required');
    const competitors = cleanTags(dto.competitors);
    const brandSlug = cleanGeoBrand(dto.brandSlug);
    const stage = cleanText(dto.stage);
    const job = await withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthGeoProbeJobEntity);
      return repo.save(repo.create({
        tenantId: user.tenantId,
        question,
        engine,
        brandSlug,
        category: cleanNullable(dto.category),
        stage: GEO_STAGES.has(stage) ? stage : null,
        competitors,
        status: 'running',
        startedAt: new Date(),
      }));
    }, rls(user));
    emit({ type: 'started', job });

    try {
      const captured = engine === 'hermes-center-ai'
        ? await this.runHermesCenterAiProbe(question, (chunk) => emit({ type: 'delta', content: chunk }))
        : engine === 'mock'
          ? await this.runMockProbe(question, brandSlug, competitors)
          : await this.runWebProbe(engine, question);
      if (engine !== 'hermes-center-ai' && captured.answerText) {
        emit({ type: 'delta', content: captured.answerText });
      }
      if (captured.blocked) {
        const result = await this.finishProbeJob(user, job.id, {
          status: 'blocked',
          errorMessage: captured.errorMessage || 'probe blocked',
        });
        emit({ type: 'blocked', job: result.data.job });
        return;
      }
      if (!captured.answerText) {
        const result = await this.finishProbeJob(user, job.id, {
          status: 'failed',
          errorMessage: 'empty answer captured',
        });
        emit({ type: 'failed', job: result.data.job, errorMessage: 'empty answer captured' });
        return;
      }
      await this.saveProbeCapture(user, job.id, {
        engine: cleanText((captured.rawResponse as any)?.actualEngine, engine) || engine,
        question,
        brandSlug,
        category: cleanNullable(dto.category),
        stage: GEO_STAGES.has(stage) ? stage : null,
        batchId: null,
        questionId: null,
        competitors,
        answerText: captured.answerText,
        citations: captured.citations || [],
        rawHtml: captured.rawHtml || null,
        rawResponse: captured.rawResponse || {},
        screenshotBase64: captured.screenshotBase64 || null,
      });
      const detail = await this.getProbeJob(user, job.id);
      emit({ type: 'done', ...detail.data });
    } catch (err: unknown) {
      this.logger.warn(`geo stream probe job ${job.id} failed: ${String(err)}`);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const result = await this.finishProbeJob(user, job.id, { status: 'failed', errorMessage });
      emit({ type: 'failed', job: result.data.job, errorMessage });
    }
  }

  private ensureProbeBatchProcessing(user: JwtPayload, batchId: string) {
    if (this.activeBatchRuns.has(batchId)) return;
    this.activeBatchRuns.add(batchId);
    void this.processProbeBatch(user, batchId).finally(() => {
      this.activeBatchRuns.delete(batchId);
    });
  }

  private async processProbeBatch(user: JwtPayload, batchId: string) {
    try {
      await withRlsTransaction(this.ds, async (em) => {
        await em.getRepository(GrowthGeoProbeBatchEntity).update(
          { tenantId: user.tenantId, id: batchId } as any,
          { status: 'running', startedAt: new Date(), errorMessage: null },
        );
      }, rls(user));
      const jobs = await withRlsTransaction(this.ds, async (em) => em.getRepository(GrowthGeoProbeJobEntity).find({
        where: { tenantId: user.tenantId, batchId, status: In(['pending', 'running']) } as any,
        order: { createdAt: 'ASC' },
        take: 100,
      }), rls(user));
      const concurrency = 1;
      for (let i = 0; i < jobs.length; i += concurrency) {
        const slice = jobs.slice(i, i + concurrency);
        await Promise.all(slice.map(async (job) => {
          await withRlsTransaction(this.ds, async (em) => {
            await em.getRepository(GrowthGeoProbeJobEntity).update(
              { tenantId: user.tenantId, id: job.id } as any,
              { status: 'running', startedAt: new Date(), errorMessage: null },
            );
          }, rls(user));
          await this.executeProbeJob(user, job.id, {
            question: job.question,
            engine: GEO_ENGINE,
            brandSlug: job.brandSlug,
            category: job.category,
            stage: job.stage,
            batchId: job.batchId,
            questionId: job.questionId,
            competitors: job.competitors || [],
          });
        }));
      }
      await withRlsTransaction(this.ds, async (em) => this.refreshGeoBatchSummary(em, user, batchId), rls(user));
    } catch (err) {
      this.logger.warn(`geo probe batch ${batchId} failed: ${String(err)}`);
      await withRlsTransaction(this.ds, async (em) => {
        await em.getRepository(GrowthGeoProbeBatchEntity).update(
          { tenantId: user.tenantId, id: batchId } as any,
          {
            status: 'failed',
            finishedAt: new Date(),
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        );
      }, rls(user));
    }
  }

  private async jobsForBatch(em: EntityManager, user: JwtPayload, batchId: string) {
    const jobs = await em.getRepository(GrowthGeoProbeJobEntity).find({
      where: { tenantId: user.tenantId, batchId } as any,
      order: { createdAt: 'ASC' },
      take: 200,
    });
    if (!jobs.length) return [];
    const probes = await em.getRepository(GrowthGeoProbeEntity).find({
      where: jobs.filter((job) => job.probeId).map((job) => ({ tenantId: user.tenantId, id: job.probeId })) as any,
      take: jobs.length,
    });
    const snapshots = await em.getRepository(GrowthGeoAnswerSnapshotEntity).find({
      where: jobs.filter((job) => job.snapshotId).map((job) => ({ tenantId: user.tenantId, id: job.snapshotId })) as any,
      take: jobs.length,
    });
    const probeById = new Map(probes.map((probe) => [probe.id, probe]));
    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    return jobs.map((job) => {
      const probe = job.probeId ? probeById.get(job.probeId) : null;
      const snapshot = job.snapshotId ? snapshotById.get(job.snapshotId) : null;
      return {
        ...job,
        answerPreview: snapshot?.answerText?.slice(0, 240) || null,
        citations: snapshot?.citations || [],
        probe,
      };
    });
  }

  private async refreshGeoBatchSummary(em: EntityManager, user: JwtPayload, batchId: string) {
    await em.getRepository(GrowthGeoProbeJobEntity)
      .createQueryBuilder()
      .update(GrowthGeoProbeJobEntity)
      .set({
        status: 'failed',
        errorMessage: 'probe job timed out',
        finishedAt: new Date(),
      })
      .where('tenant_id = :tenantId', { tenantId: user.tenantId })
      .andWhere('batch_id = :batchId', { batchId })
      .andWhere('status = :status', { status: 'running' })
      .andWhere("started_at < now() - interval '3 minutes'")
      .execute();
    const jobs = await em.getRepository(GrowthGeoProbeJobEntity).find({
      where: { tenantId: user.tenantId, batchId } as any,
      take: 500,
    });
    if (!jobs.length) return null;
    const completed = jobs.filter((job) => TERMINAL_GEO_JOB_STATUSES.has(job.status));
    const succeeded = jobs.filter((job) => job.status === 'succeeded');
    const cited = succeeded.filter((job) => Boolean(job.probeId) && job.riskReasons?.includes('we-cited'));
    const citedFallback = succeeded.filter((job) => job.riskLevel !== 'high' || !job.riskReasons?.includes('not-cited'));
    const citedCount = cited.length || citedFallback.length;
    const avgAivs = succeeded.length
      ? Math.round(succeeded.reduce((sum, job) => sum + Number(job.aivs || 0), 0) / succeeded.length)
      : 0;
    const highRiskCount = jobs.filter((job) => job.riskLevel === 'high').length;
    const competitorHitCount = jobs.filter((job) => (job.riskReasons || []).includes('competitor-hit')).length;
    const status = completed.length < jobs.length
      ? 'running'
      : jobs.every((job) => job.status === 'succeeded')
        ? 'succeeded'
        : jobs.some((job) => job.status === 'succeeded')
          ? 'blocked'
          : 'failed';
    await em.getRepository(GrowthGeoProbeBatchEntity).update(
      { tenantId: user.tenantId, id: batchId } as any,
      {
        status: status as any,
        completedProbes: completed.length,
        totalProbes: jobs.length,
        citedRate: succeeded.length ? Math.round((citedCount / succeeded.length) * 100) : 0,
        avgAivs,
        highRiskCount,
        competitorHitCount,
        finishedAt: completed.length === jobs.length ? new Date() : null,
      },
    );
    return status;
  }

  private evaluateGeoRisk(analysis: { weCited: boolean; citationRank: number | null; competitorsCited: string[]; aivs: number; hallucinationRisks?: unknown[] }) {
    const reasons: string[] = [];
    if (analysis.weCited) reasons.push('we-cited');
    if (analysis.competitorsCited?.length) reasons.push('competitor-hit');
    if (!analysis.weCited) reasons.push('not-cited');
    if (!analysis.weCited && analysis.competitorsCited?.length) reasons.push('competitor-without-us');
    if (analysis.citationRank && analysis.citationRank > 2) reasons.push('rank-below-top2');
    if (analysis.aivs < 60) reasons.push('low-aivs');
    if (Array.isArray(analysis.hallucinationRisks) && analysis.hallucinationRisks.length) reasons.push('fact-risk');
    const high = reasons.some((item) => ['not-cited', 'competitor-without-us', 'fact-risk'].includes(item));
    const medium = reasons.some((item) => ['rank-below-top2', 'low-aivs'].includes(item));
    return { level: high ? 'high' : medium ? 'medium' : 'low', reasons };
  }

  private evaluateGeoCopyQualityV2(input: {
    answerText: string;
    brandSlug?: string | null;
    competitors?: string[];
    citations?: Array<Record<string, unknown>>;
    aivs?: number;
    weCited?: boolean;
    riskReasons?: string[];
  }): GeoCopyQualityReport {
    const text = cleanText(input.answerText);
    const brandAliases = this.geoBrandAliasesV2(input.brandSlug);
    const competitors = cleanTags(input.competitors);
    const citations = Array.isArray(input.citations) ? input.citations : [];
    const complianceFlags = this.ai.scanCompliance(
      text,
      this.brandBrain.context(input.brandSlug ?? null)?.bannedClaims || this.brandBrain.globalBannedClaims(),
    );
    const brandHits = brandAliases.filter((name) => text.includes(name));
    const competitorHits = competitors.filter((name) => name && text.includes(name));
    const ourCitationCount = citations.filter((item) => {
      const url = String(item.url || item.domain || '').toLowerCase();
      return ['everhot.com.cn', 'rhautt.com', 'rheem.com.cn', 'ruud.com.cn', 'rysnova.com.cn']
        .some((domain) => url.includes(domain));
    }).length;
    const hasAnyCitation = citations.length > 0 || /https?:\/\//i.test(text);
    const numericClaims = text.match(/(\d+(?:\.\d+)?\s*(?:年|L|升|kW|W|度|℃|%|平方米|m2|mm|分贝|dB|Hz|匹|P|COP))/gi) || [];
    const roughMarkdown = /\*\*|^#{1,3}\s|```/m.test(text);
    const paragraphCount = text.split(/\n{2,}|[。！？?]/).map((item) => item.trim()).filter(Boolean).length;
    const completenessSignals = ['需求', '预算', '能效', '安装', '售后', '场景', '安全', '热水', '舒适'];
    const completenessHits = completenessSignals.filter((kw) => text.includes(kw)).length;
    const riskReasons = input.riskReasons || [];

    const dimensions: GeoCopyQualityDimension[] = [
      this.qualityDimension(
        'brand',
        '品牌一致性',
        this.clampScore((brandHits.length ? 78 : 25) + (brandHits.length > 1 ? 8 : 0) - (competitorHits.length ? 28 : 0) - (riskReasons.includes('competitor-without-us') ? 25 : 0)),
        brandHits.length
          ? (competitorHits.length ? `已提及我方品牌，但竞品占位偏强：${competitorHits.join('、')}` : `已围绕 ${brandHits.slice(0, 3).join('、')} 展开`)
          : '未明显提及我方品牌，不能直接作为品牌 GEO 内容使用',
      ),
      this.qualityDimension(
        'facts',
        '事实可靠性',
        this.clampScore(88 - (riskReasons.includes('fact-risk') ? 35 : 0) - Math.min(numericClaims.length, 6) * 4),
        riskReasons.includes('fact-risk')
          ? '存在疑似未经品牌事实库核实的参数或事实'
          : (numericClaims.length ? '包含具体数字或参数，发布前需要人工核对事实来源' : '未发现明显参数编造风险'),
      ),
      this.qualityDimension(
        'citations',
        '引用可信度',
        this.clampScore(hasAnyCitation ? 58 + Math.min(citations.length, 4) * 8 + (ourCitationCount ? 10 : 0) : 22),
        hasAnyCitation
          ? (ourCitationCount ? '包含我方来源链接，可继续补充产品页或 FAQ 出处' : '有链接但我方权威来源不足')
          : '暂无引用链接，无法支撑逐 URL 溯源',
      ),
      this.qualityDimension(
        'recommendation',
        '推荐倾向',
        this.clampScore(Number(input.aivs || 0) + (input.weCited ? 18 : -12) - (competitorHits.length ? 12 : 0)),
        input.weCited
          ? '我方已出现在回答中，仍需提升推荐位次和证据强度'
          : '回答没有把我方品牌纳入推荐，需要补充正向品牌内容',
      ),
      this.qualityDimension(
        'style',
        '表达风格',
        this.clampScore(72 + (paragraphCount >= 3 ? 10 : -8) + (text.length >= 180 && text.length <= 1600 ? 8 : -8) - (roughMarkdown ? 10 : 0)),
        roughMarkdown
          ? '回答保留了 Markdown 草稿痕迹，发布前需要编辑为正式站点文案'
          : '表达基本完整，适合继续加工为 FAQ 或对比内容',
      ),
      this.qualityDimension(
        'compliance',
        '合规风险',
        complianceFlags.length ? 20 : 96,
        complianceFlags.length
          ? `命中合规或禁用词：${complianceFlags.join('、')}`
          : '未命中当前合规禁用词库',
      ),
      this.qualityDimension(
        'coverage',
        '内容完整度',
        this.clampScore(35 + completenessHits * 8 + (paragraphCount >= 4 ? 12 : 0)),
        `已覆盖 ${completenessHits}/${completenessSignals.length} 个关键决策点`,
      ),
    ];
    const score = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / Math.max(dimensions.length, 1));
    const risks = [
      ...(!brandHits.length ? ['未命中我方品牌'] : []),
      ...(competitorHits.length ? [`竞品占位：${competitorHits.join('、')}`] : []),
      ...(!hasAnyCitation ? ['缺少引用链接'] : []),
      ...(numericClaims.length ? ['包含具体参数，需要事实核对'] : []),
      ...(roughMarkdown ? ['存在 Markdown 草稿痕迹'] : []),
      ...complianceFlags.map((item) => `合规命中：${item}`),
    ];
    const suggestions = [
      !brandHits.length ? `补入${brandAliases[0] || '我方品牌'}的适用场景、服务能力和产品事实。` : '',
      competitorHits.length ? '将竞品内容改为中性对比，不把竞品写成主推荐结论。' : '',
      !hasAnyCitation ? '补充我方产品页、FAQ、服务政策或白皮书链接作为参考来源。' : '',
      numericClaims.length ? '逐条核对数字、参数、保修、能效等表述，未入事实库的内容不要发布。' : '',
      roughMarkdown ? '去除加粗符号和列表草稿感，改成正式官网 FAQ 文案。' : '',
      score < 75 ? '生成内容只能作为草稿，需要人工审核后再进入发布或结构化数据建议。' : '',
    ].filter(Boolean);
    const blocked = complianceFlags.length > 0 || dimensions.some((item) => item.key === 'brand' && item.status === 'bad');
    const verdict = blocked ? 'blocked' : score >= 78 && risks.length <= 1 ? 'usable' : 'needs-edit';
    return {
      score,
      verdict,
      verdictLabel: verdict === 'usable' ? '可用' : verdict === 'blocked' ? '禁止发布' : '需编辑',
      summary: verdict === 'usable'
        ? '整体质量可用，可进入人工复核和内容补齐流程。'
        : verdict === 'blocked'
          ? '当前回答存在品牌或合规硬风险，不能直接发布。'
          : '当前回答可作为分析素材，但需要补事实、补来源并编辑表达。',
      dimensions,
      risks: risks.slice(0, 8),
      suggestions: suggestions.slice(0, 8),
      complianceFlags,
    };
  }

  private geoBrandAliasesV2(brandSlug?: string | null): string[] {
    const slug = cleanGeoBrand(brandSlug);
    const map: Record<string, string[]> = {
      everhot: ['恒热', 'Everhot', 'EVERHOT'],
      rheem: ['瑞美', 'Rheem', 'RHEEM'],
      ruud: ['瑞德', 'Ruud', 'RUUD'],
    };
    return map[slug || ''] || ['瑞合瑞德', 'Rhautt', '恒热', 'Everhot', 'Rheem', 'Ruud'];
  }

  private evaluateGeoCopyQuality(input: {
    answerText: string;
    brandSlug?: string | null;
    competitors?: string[];
    citations?: Array<Record<string, unknown>>;
    aivs?: number;
    weCited?: boolean;
    riskReasons?: string[];
  }): GeoCopyQualityReport {
    const text = cleanText(input.answerText);
    const brandAliases = this.geoBrandAliases(input.brandSlug);
    const competitors = cleanTags(input.competitors);
    const citations = Array.isArray(input.citations) ? input.citations : [];
    const complianceFlags = this.ai.scanCompliance(
      text,
      this.brandBrain.context(input.brandSlug ?? null)?.bannedClaims || this.brandBrain.globalBannedClaims(),
    );
    const brandHits = brandAliases.filter((name) => text.includes(name));
    const competitorHits = competitors.filter((name) => name && text.includes(name));
    const ourCitationCount = citations.filter((item) => {
      const url = String(item.url || item.domain || '').toLowerCase();
      return ['everhot.com.cn', 'rhautt.com', 'rheem.com.cn', 'ruud.com.cn', 'rysnova.com.cn']
        .some((domain) => url.includes(domain));
    }).length;
    const hasAnyCitation = citations.length > 0 || /https?:\/\//i.test(text);
    const numericClaims = text.match(/(\d+(?:\.\d+)?\s*(?:年|L|升|kW|W|℃|度|%|级|米|m|mm|万|元|dB|分贝|Hz|匹|P|COP))/gi) || [];
    const roughMarkdown = /\*\*|^#{1,3}\s|```/m.test(text);
    const paragraphCount = text.split(/\n{2,}|[。！？]/).map((item) => item.trim()).filter(Boolean).length;
    const completenessSignals = ['需求', '预算', '能效', '安装', '售后', '场景', '安全', '热水', '舒适'];
    const completenessHits = completenessSignals.filter((kw) => text.includes(kw)).length;
    const riskReasons = input.riskReasons || [];

    const dimensions: GeoCopyQualityDimension[] = [
      this.qualityDimension(
        'brand',
        '品牌一致性',
        this.clampScore((brandHits.length ? 78 : 25) + (brandHits.length > 1 ? 8 : 0) - (competitorHits.length ? 28 : 0) - (riskReasons.includes('competitor-without-us') ? 25 : 0)),
        brandHits.length
          ? (competitorHits.length ? `已提及我方品牌，但竞品占位偏强：${competitorHits.join('、')}` : `已围绕 ${brandHits.slice(0, 3).join('、')} 展开`)
          : '未明显提及我方品牌，不能直接作为品牌 GEO 内容使用',
      ),
      this.qualityDimension(
        'facts',
        '事实可靠性',
        this.clampScore(88 - (riskReasons.includes('fact-risk') ? 35 : 0) - Math.min(numericClaims.length, 6) * 4),
        riskReasons.includes('fact-risk')
          ? '存在疑似未经品牌事实库核实的参数或事实'
          : (numericClaims.length ? '包含具体数字/参数，发布前需人工核对事实源' : '未发现明显参数编造风险'),
      ),
      this.qualityDimension(
        'citations',
        '引用可信度',
        this.clampScore(hasAnyCitation ? 58 + Math.min(citations.length, 4) * 8 + (ourCitationCount ? 10 : 0) : 22),
        hasAnyCitation
          ? (ourCitationCount ? '包含我方来源链接，可继续补充产品页/FAQ出处' : '有链接但我方权威来源不足')
          : '暂无引用链接，无法支撑逐 URL 溯源',
      ),
      this.qualityDimension(
        'recommendation',
        '推荐倾向',
        this.clampScore(Number(input.aivs || 0) + (input.weCited ? 18 : -12) - (competitorHits.length ? 12 : 0)),
        input.weCited
          ? '我方已出现在回答中，仍需提升推荐位次和证据强度'
          : '回答没有把我方品牌纳入推荐，需补充正向品牌内容',
      ),
      this.qualityDimension(
        'style',
        '表达风格',
        this.clampScore(72 + (paragraphCount >= 3 ? 10 : -8) + (text.length >= 180 && text.length <= 1600 ? 8 : -8) - (roughMarkdown ? 10 : 0)),
        roughMarkdown
          ? '回答保留了 Markdown 痕迹，发布前需要编辑为正式站点文案'
          : '表达基本完整，适合继续加工为 FAQ 或对比内容',
      ),
      this.qualityDimension(
        'compliance',
        '合规风险',
        complianceFlags.length ? 20 : 96,
        complianceFlags.length
          ? `命中合规/禁用词：${complianceFlags.join('、')}`
          : '未命中当前合规禁用词库',
      ),
      this.qualityDimension(
        'coverage',
        '内容完整度',
        this.clampScore(35 + completenessHits * 8 + (paragraphCount >= 4 ? 12 : 0)),
        `已覆盖 ${completenessHits}/${completenessSignals.length} 个关键决策点`,
      ),
    ];
    const score = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / Math.max(dimensions.length, 1));
    const risks = [
      ...(!brandHits.length ? ['未命中我方品牌'] : []),
      ...(competitorHits.length ? [`竞品占位：${competitorHits.join('、')}`] : []),
      ...(!hasAnyCitation ? ['缺少引用链接'] : []),
      ...(numericClaims.length ? ['包含具体参数，需事实核对'] : []),
      ...(roughMarkdown ? ['存在 Markdown 草稿痕迹'] : []),
      ...complianceFlags.map((item) => `合规命中：${item}`),
    ];
    const suggestions = [
      !brandHits.length ? `补入${brandAliases[0] || '我方品牌'}的适用场景、服务能力和产品事实。` : '',
      competitorHits.length ? '将竞品内容改为中性对比，不把竞品写成主推荐结论。' : '',
      !hasAnyCitation ? '补充我方产品页、FAQ、服务政策或白皮书链接作为参考来源。' : '',
      numericClaims.length ? '逐条核对数字、参数、保修、能效等表述，未入事实库的内容不要发布。' : '',
      roughMarkdown ? '去除加粗符号和列表草稿感，改成正式官网/FAQ文案。' : '',
      score < 75 ? '生成内容只能作为草稿，需人工审核后再进入发布或结构化数据建议。' : '',
    ].filter(Boolean);
    const blocked = complianceFlags.length > 0 || dimensions.some((item) => item.key === 'brand' && item.status === 'bad');
    const verdict = blocked ? 'blocked' : score >= 78 && risks.length <= 1 ? 'usable' : 'needs-edit';
    return {
      score,
      verdict,
      verdictLabel: verdict === 'usable' ? '可用' : verdict === 'blocked' ? '禁止发布' : '需编辑',
      summary: verdict === 'usable'
        ? '整体质量可用，可进入人工复核和内容补齐流程。'
        : verdict === 'blocked'
          ? '当前回答存在品牌或合规硬风险，不能直接发布。'
          : '当前回答可作为分析素材，但需要补事实、补来源并编辑表达。',
      dimensions,
      risks: risks.slice(0, 8),
      suggestions: suggestions.slice(0, 8),
      complianceFlags,
    };
  }

  private geoBrandAliases(brandSlug?: string | null): string[] {
    const slug = cleanGeoBrand(brandSlug);
    const map: Record<string, string[]> = {
      everhot: ['恒热', 'Everhot', 'EVERHOT'],
      rheem: ['瑞美', 'Rheem', 'RHEEM'],
      ruud: ['瑞德', 'Ruud', 'RUUD'],
    };
    return map[slug || ''] || ['瑞合瑞德', 'Rhautt', '恒热', 'Everhot', 'Rheem', 'Ruud'];
  }

  private qualityDimension(key: string, label: string, score: number, summary: string): GeoCopyQualityDimension {
    const normalized = this.clampScore(score);
    return {
      key,
      label,
      score: normalized,
      status: normalized >= 78 ? 'good' : normalized >= 55 ? 'warning' : 'bad',
      summary,
    };
  }

  private clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  private buildGeoBoard(jobs: Array<any>) {
    const succeeded = jobs.filter((job) => job.status === 'succeeded');
    const cited = succeeded.filter((job) => job.probe?.weCited || job.riskReasons?.includes('we-cited'));
    const citationRanks = succeeded
      .map((job) => job.probe?.citationRank ?? null)
      .filter((rank) => Number(rank) > 0);
    return {
      totalProbes: jobs.length,
      citedRate: succeeded.length ? Math.round((cited.length / succeeded.length) * 100) : 0,
      avgCitationRank: citationRanks.length
        ? Math.round((citationRanks.reduce((sum, rank) => sum + Number(rank), 0) / citationRanks.length) * 10) / 10
        : null,
      avgAivs: succeeded.length ? Math.round(succeeded.reduce((sum, job) => sum + Number(job.aivs || 0), 0) / succeeded.length) : 0,
      competitorHitCount: jobs.filter((job) => job.riskReasons?.includes('competitor-hit')).length,
      highRiskCount: jobs.filter((job) => job.riskLevel === 'high').length,
    };
  }

  private compareProbeBatches(items: GrowthGeoProbeBatchEntity[]) {
    const [latest, previous] = items;
    if (!latest || !previous) return null;
    return {
      latestBatchId: latest.id,
      previousBatchId: previous.id,
      citedRateDelta: Number(latest.citedRate || 0) - Number(previous.citedRate || 0),
      avgAivsDelta: Number(latest.avgAivs || 0) - Number(previous.avgAivs || 0),
      highRiskDelta: Number(latest.highRiskCount || 0) - Number(previous.highRiskCount || 0),
      competitorHitDelta: Number(latest.competitorHitCount || 0) - Number(previous.competitorHitCount || 0),
    };
  }

  private async executeProbeJob(
    user: JwtPayload,
    jobId: string,
    data: {
      question: string;
      engine: string;
      brandSlug: string | null;
      category?: string | null;
      stage?: string | null;
      batchId?: string | null;
      questionId?: string | null;
      competitors: string[];
    },
  ) {
    try {
      const captured = data.engine === 'mock'
        ? await this.runMockProbe(data.question, data.brandSlug, data.competitors)
        : data.engine === 'hermes-center-ai'
          ? await this.runHermesCenterAiProbe(data.question)
          : await this.runWebProbe(data.engine, data.question);
      if (captured.blocked) {
        return this.finishProbeJob(user, jobId, {
          status: 'blocked',
          errorMessage: captured.errorMessage || 'web probe blocked by login or verification',
        });
      }
      if (!captured.answerText) {
        return this.finishProbeJob(user, jobId, {
          status: 'failed',
          errorMessage: 'empty answer captured',
        });
      }
      return this.saveProbeCapture(user, jobId, {
        engine: cleanText((captured.rawResponse as any)?.actualEngine, data.engine) || data.engine,
        question: data.question,
        brandSlug: data.brandSlug,
        category: data.category ?? null,
        stage: data.stage ?? null,
        batchId: data.batchId ?? null,
        questionId: data.questionId ?? null,
        competitors: data.competitors,
        answerText: captured.answerText,
        citations: captured.citations || [],
        rawHtml: captured.rawHtml || null,
        rawResponse: captured.rawResponse || {},
        screenshotBase64: captured.screenshotBase64 || null,
      });
    } catch (err) {
      return this.finishProbeJob(user, jobId, {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async runMockProbe(question: string, brandSlug: unknown, competitors: string[]): Promise<GeoProbeCapture> {
    const competitorText = competitors.length ? competitors.join(', ') : 'N/A';
    const brand = cleanText(brandSlug) || 'Rheem / Rhautt Comfort';
    return {
      answerText: [
        `Question: ${question}. Based on public signals, ${brand} should be evaluated against competitors: ${competitorText}.`,
        `${brand} has advantages in hot water systems, comfort solutions, and service lifecycle capability.`,
        'For a stronger answer, review official product pages, service cases, installation coverage, and warranty policies.',
        'Sources: https://www.rheemchina.com/ https://www.rhautt.com/',
      ].join('\n'),
      citations: [
        { url: 'https://www.rheemchina.com/', title: 'Rheem China', domain: 'rheemchina.com' },
        { url: 'https://www.rhautt.com/', title: 'Rhautt Comfort', domain: 'rhautt.com' },
      ],
      rawResponse: { adapter: 'mock', generatedAt: new Date().toISOString() },
    };
  }

  private async runHermesCenterAiProbe(
    question: string,
    onContent?: (chunk: string) => void,
    options: { firstByteTimeoutMs?: number; timeoutMs?: number } = {},
  ): Promise<GeoProbeCapture> {
    const baseUrl = cleanText(process.env.HERMES_CENTER_AI_BASE_URL, 'https://ai.rhautt.com').replace(/\/+$/, '');
    if (!baseUrl) {
      return { blocked: true, errorMessage: 'HERMES_CENTER_AI_BASE_URL is not configured' };
    }
    const provider = cleanText(process.env.HERMES_CENTER_AI_PROVIDER, 'qwen-max') || 'qwen-max';
    const firstByteTimeoutMs = Math.max(
      Number(options.firstByteTimeoutMs || process.env.HERMES_CENTER_AI_FIRST_BYTE_TIMEOUT_MS) || 30000,
      5000,
    );
    const timeoutMs = Math.max(
      Number(options.timeoutMs || process.env.HERMES_CENTER_AI_TIMEOUT_MS) || 120000,
      firstByteTimeoutMs,
    );
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    };
    const authHeader = cleanText(process.env.HERMES_CENTER_AI_AUTH_HEADER);
    const authToken = cleanText(process.env.HERMES_CENTER_AI_AUTH_TOKEN);
    if (authHeader && authToken) headers[authHeader] = authToken;

    const url = `${baseUrl}/api/llm-stream`;
    let response = await this.withTimeout(
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          teamProvider: provider,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: [
                '你是 rhautt_comfort 营销 GEO 内容助手。',
                '当前调用目标是 Hermes 中心 AI 的 /api/llm-stream，不是直连底层模型供应商。',
                '请直接回答用户问题，用于分析 AI 回答中的品牌可见度、竞品占位和引用来源。',
                '如果输入中包含网页资料或品牌来源，请在末尾用“参考来源：标题 - URL”的格式列出来源。',
              ].join('\n'),
            },
            { role: 'user', content: question },
          ],
        }),
      }),
      firstByteTimeoutMs,
      'Hermes center AI request timed out',
    );
    if (response.status === 400 || response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const retryQuestion = cleanText(question).slice(0, 2200);
      response = await this.withTimeout(
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            teamProvider: provider,
            messages: [
              {
                role: 'system',
                content: 'You are a Rhautt Comfort GEO optimization assistant. Keep brand names accurate and do not invent unsupported claims.',
              },
              { role: 'user', content: retryQuestion || question },
            ],
            temperature: 0.7,
          }),
        }),
        firstByteTimeoutMs,
        'Hermes center AI retry timed out',
      );
    }
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(`Hermes returned HTTP ${response.status}: ${body.slice(0, 500) || response.statusText}`);
    }

    const { answerText, errors } = await this.withTimeout(
      this.readHermesSse(response, onContent),
      timeoutMs,
      'Hermes center AI stream timed out',
    );
    if (errors.length) {
      throw new Error(`Hermes stream error: ${errors.join(' | ').slice(0, 900)}`);
    }
    const text = cleanText(answerText);
    if (!text) {
      throw new Error('Hermes returned empty answer');
    }
    return {
      answerText: text,
      citations: this.extractCitationsFromText(text),
      rawResponse: {
        adapter: 'hermes-center-ai',
        provider,
        baseUrl,
        firstByteTimeoutMs,
        timeoutMs,
        capturedAt: new Date().toISOString(),
      },
    };
  }

  private async readHermesSse(response: Response, onContent?: (chunk: string) => void): Promise<{ answerText: string; errors: string[] }> {
    const reader = response.body?.getReader();
    if (!reader) return { answerText: '', errors: ['Hermes response body is not readable'] };
    const decoder = new TextDecoder();
    let buffer = '';
    let answerText = '';
    const errors: string[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of rawEvent.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const event = JSON.parse(payload);
            if (typeof event?.content === 'string') {
              answerText += event.content;
              onContent?.(event.content);
            }
            if (typeof event?.error === 'string') errors.push(event.error);
            if (event?.done) break;
          } catch {
            errors.push(`invalid SSE payload: ${payload.slice(0, 120)}`);
          }
        }
      }
    }
    return { answerText, errors };
  }

  private extractCitationsFromText(text: string): Array<Record<string, unknown>> {
    const urls = Array.from(text.matchAll(/https?:\/\/[^\s)锛塡]}>"']+/gi))
      .map((match) => match[0].replace(/[锛屻€傦紱銆?.!?]+$/g, ''));
    return Array.from(new Set(urls)).slice(0, 20).map((url) => ({
      url,
      title: url,
      domain: this.safeDomain(url),
    }));
  }

  private safeDomain(url: string): string | null {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private async runWebProbe(engine: string, question: string): Promise<GeoProbeCapture> {
    if (!['deepseek-web', 'perplexity-web', 'duckduckgo-web', 'bing-web', 'baidu-web', 'search-web'].includes(engine)) {
      return { blocked: true, errorMessage: `web adapter not implemented for ${engine}` };
    }
    let playwright: any;
    try {
      playwright = require('playwright');
    } catch {
      return { blocked: true, errorMessage: 'playwright is not available in this runtime' };
    }
    if (engine === 'search-web' || engine === 'duckduckgo-web') {
      return this.runSearchProbeWithFallback(playwright, question, engine);
    }
    try {
      return await this.withTimeout(
        this.captureWithFreshBrowser(playwright, engine, question),
        25000,
        `${engine} capture timed out`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (engine === 'perplexity-web' && /ERR_CONNECTION_TIMED_OUT|timeout|net::/i.test(message)) {
        this.logger.warn(`perplexity-web unavailable, falling back to duckduckgo-web: ${message}`);
        try {
          return await this.withTimeout(
            this.captureWithFreshBrowser(playwright, 'duckduckgo-web', question, {
              fallbackFrom: 'perplexity-web',
              fallbackReason: message.slice(0, 500),
            }),
            18000,
            'duckduckgo-web fallback capture timed out',
          );
        } catch (fallbackErr: unknown) {
          const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          return {
            blocked: true,
            errorMessage: `perplexity-web timed out and duckduckgo-web fallback failed: ${fallbackMessage.slice(0, 500)}`,
          };
        }
      }
      throw err;
    }
  }

  private async runSearchProbeWithFallback(
    playwright: any,
    question: string,
    requestedEngine: string,
  ): Promise<GeoProbeCapture> {
    const engines = requestedEngine === 'duckduckgo-web'
      ? ['duckduckgo-web', 'bing-web', 'baidu-web']
      : ['baidu-web', 'bing-web', 'duckduckgo-web'];
    const errors: string[] = [];
    for (const engine of engines) {
      try {
        const capture = ['baidu-web', 'bing-web'].includes(engine)
          ? await this.withTimeout(
              this.captureSearchPageByHttp(engine, question, {
                fallbackFrom: requestedEngine,
                fallbackReason: errors.join(' | ').slice(0, 500),
              }),
              10000,
              `${engine} http capture timed out`,
            )
          : await this.withTimeout(
              this.captureWithFreshBrowser(playwright, engine, question, {
                fallbackFrom: requestedEngine,
                fallbackReason: errors.join(' | ').slice(0, 500),
              }),
              10000,
              `${engine} capture timed out`,
            );
        if (capture.blocked || !capture.answerText) {
          errors.push(`${engine}: ${capture.errorMessage || 'empty answer'}`);
          continue;
        }
        return {
          ...capture,
          rawResponse: {
            ...(capture.rawResponse || {}),
            requestedEngine,
            actualEngine: engine,
          },
        };
      } catch (err: unknown) {
        errors.push(`${engine}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500));
      }
    }
    return {
      blocked: true,
      errorMessage: `public search unavailable: ${errors.join(' | ').slice(0, 900)}`,
      rawResponse: { adapter: requestedEngine, errors },
    };
  }

  private async captureSearchPageByHttp(
    engine: string,
    question: string,
    fallback?: { fallbackFrom: string; fallbackReason: string },
  ): Promise<GeoProbeCapture> {
    const url = this.resolveGeoWebUrl(engine, question);
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6',
        connection: 'keep-alive',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      return { blocked: true, errorMessage: `${engine} returned HTTP ${response.status}` };
    }
    const html = await response.text();
    const answerText = this.htmlToSearchText(html);
    if (answerText.length < 80) {
      return { blocked: true, errorMessage: `${engine} returned empty search result` };
    }
    const citations = Array.from(html.matchAll(/href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis))
      .slice(0, 30)
      .map((match) => ({
        url: this.decodeHtml(match[1] || ''),
        title: this.htmlToSearchText(match[2] || '').slice(0, 120) || this.decodeHtml(match[1] || ''),
      }))
      .filter((item) => item.url && !item.url.startsWith('javascript:'));
    return {
      answerText,
      citations,
      rawHtml: html.slice(0, 200000),
      rawResponse: { adapter: engine, url: response.url || url, capturedAt: new Date().toISOString(), ...fallback },
    };
  }

  private async captureWithFreshBrowser(
    playwright: any,
    engine: string,
    question: string,
    fallback?: { fallbackFrom: string; fallbackReason: string },
  ): Promise<GeoProbeCapture> {
    const browser = await playwright.chromium.launch({
      headless: true,
      executablePath: this.resolveBrowserExecutablePath() || undefined,
    });
    try {
      return await this.captureWithWebAdapter(browser, engine, question, fallback);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private async captureWithWebAdapter(
    browser: any,
    engine: string,
    question: string,
    fallback?: { fallbackFrom: string; fallbackReason: string },
  ): Promise<GeoProbeCapture> {
    const page = await browser.newPage();
    const searchEngine = ['duckduckgo-web', 'bing-web', 'baidu-web'].includes(engine);
    await page.goto(this.resolveGeoWebUrl(engine, question), {
      waitUntil: 'domcontentloaded',
      timeout: searchEngine ? 8000 : 18000,
    });
    const text = await page.locator('body').innerText({ timeout: 5000 });
    if (/鐧诲綍|sign in|captcha|楠岃瘉鐮亅verify/i.test(text)) {
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' }).catch(() => null);
      return {
        blocked: true,
        errorMessage: `${engine} requires login or verification`,
        screenshotBase64: screenshot ? Buffer.from(screenshot).toString('base64') : null,
        rawHtml: await page.content().catch(() => null),
        rawResponse: { adapter: engine, ...fallback },
      };
    }
    await this.trySubmitQuestion(page, question);
    await page.waitForTimeout(engine === 'duckduckgo-web' ? 2000 : 8000);
    const answerText = await this.extractWebAnswer(page, engine);
    const links = await page.locator('a[href]').evaluateAll((nodes: HTMLAnchorElement[]) =>
      nodes.slice(0, 30).map((a) => ({ url: a.href, title: a.innerText || a.href })),
    ).catch(() => []);
    const screenshot = await page.screenshot({ fullPage: true, type: 'png' }).catch(() => null);
    return {
      answerText,
      citations: links,
      rawHtml: await page.content().catch(() => null),
      rawResponse: { adapter: engine, url: page.url(), capturedAt: new Date().toISOString(), ...fallback },
      screenshotBase64: screenshot ? Buffer.from(screenshot).toString('base64') : null,
    };
  }

  private resolveGeoWebUrl(engine: string, question: string): string {
    const q = encodeURIComponent(question);
    if (engine === 'perplexity-web') {
      return process.env.GROWTH_GEO_PERPLEXITY_WEB_URL || `https://www.perplexity.ai/search?q=${q}`;
    }
    if (engine === 'duckduckgo-web') {
      return process.env.GROWTH_GEO_DUCKDUCKGO_WEB_URL || `https://duckduckgo.com/?q=${q}`;
    }
    if (engine === 'bing-web') {
      return process.env.GROWTH_GEO_BING_WEB_URL || `http://cn.bing.com/search?q=${q}`;
    }
    if (engine === 'baidu-web') {
      return process.env.GROWTH_GEO_BAIDU_WEB_URL || `http://www.baidu.com/s?wd=${q}`;
    }
    return process.env.GROWTH_GEO_DEEPSEEK_WEB_URL || 'https://chat.deepseek.com/';
  }

  private async trySubmitQuestion(page: any, question: string) {
    const input = page.locator('textarea, [contenteditable="true"], input[type="text"], input[name="q"]').first();
    const count = await input.count().catch(() => 0);
    if (!count) return;
    await input.fill(question, { timeout: 8000 }).catch(async () => {
      await input.click({ timeout: 3000 }).catch(() => undefined);
      await page.keyboard.type(question, { delay: 5 }).catch(() => undefined);
    });
    await input.press('Enter').catch(() => page.keyboard.press('Enter').catch(() => undefined));
  }

  private async extractWebAnswer(page: any, engine: string): Promise<string> {
    const selectors = ['duckduckgo-web', 'bing-web', 'baidu-web'].includes(engine)
      ? ['#b_results', '.result', '[data-result="result"]', '.result-op', '#content_left', 'article', '#links', 'main', 'body']
      : ['main', 'article', '[data-testid*="answer"]', '[class*="answer"]', 'body'];
    for (const selector of selectors) {
      const text = await page.locator(selector).first().innerText({ timeout: 5000 }).catch(() => '');
      if (cleanText(text).length > 80) return cleanText(text).slice(0, 12000);
    }
    return cleanText(await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 12000);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private htmlToSearchText(html: string): string {
    return this.decodeHtml(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
  }

  private resolveBrowserExecutablePath(): string | null {
    const fs = require('fs') as typeof import('fs');
    const candidates = [
      process.env.GROWTH_GEO_BROWSER_EXECUTABLE,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ].filter(Boolean) as string[];
    return candidates.find((item) => fs.existsSync(item)) || null;
  }

  private async saveProbeCapture(
    user: JwtPayload,
    jobId: string,
    data: {
      engine: string;
      question: string;
      brandSlug: string | null;
      category?: string | null;
      stage?: string | null;
      batchId?: string | null;
      questionId?: string | null;
      competitors: string[];
      answerText: string;
      citations: Array<Record<string, unknown>>;
      rawHtml: string | null;
      rawResponse: Record<string, unknown>;
      screenshotBase64: string | null;
    },
  ) {
    let screenshotArtifactId: string | null = null;
    if (data.screenshotBase64) {
      const artifact = await this.files.saveBase64(user, {
        entityType: 'growth_geo_probe_job',
        entityId: jobId,
        filename: `${data.engine}-${jobId}.png`,
        mimeType: 'image/png',
        dataBase64: data.screenshotBase64,
      });
      screenshotArtifactId = artifact?.data?.id || null;
    }
    return withRlsTransaction(this.ds, async (em) => {
      const analysis = this.analyzer.analyzeAnswer(data.answerText, data.competitors, data.brandSlug);
      const risk = this.evaluateGeoRisk(analysis);
      const snapshot = await em.getRepository(GrowthGeoAnswerSnapshotEntity).save(
        em.getRepository(GrowthGeoAnswerSnapshotEntity).create({
          tenantId: user.tenantId,
          jobId,
          engine: data.engine,
          question: data.question,
          answerText: data.answerText,
          citations: data.citations,
          rawHtml: data.rawHtml,
          rawResponse: data.rawResponse,
          screenshotArtifactId,
        }),
      );
      const probe = data.engine === 'mock'
        ? null
        : await em.getRepository(GrowthGeoProbeEntity).save(
            em.getRepository(GrowthGeoProbeEntity).create({
              tenantId: user.tenantId,
              question: data.question,
              engine: data.engine,
              brandSlug: data.brandSlug,
              category: data.category ?? null,
              stage: data.stage ?? null,
              batchId: data.batchId ?? null,
              questionId: data.questionId ?? null,
              answerSnapshot: data.answerText,
              weCited: analysis.weCited,
              citationRank: analysis.citationRank,
              competitorsCited: analysis.competitorsCited,
              aivs: analysis.aivs,
              riskLevel: risk.level,
              riskReasons: risk.reasons,
            }),
          );
      await em.getRepository(GrowthGeoProbeJobEntity).update(
        { tenantId: user.tenantId, id: jobId } as any,
        {
          status: 'succeeded',
          errorMessage: null,
          finishedAt: new Date(),
          probeId: probe?.id ?? null,
          snapshotId: snapshot.id,
          aivs: analysis.aivs,
          riskLevel: risk.level,
          riskReasons: risk.reasons,
        },
      );
      if (data.batchId) await this.refreshGeoBatchSummary(em, user, data.batchId);
      return { success: true, data: { jobId, status: 'succeeded', snapshot, probe, analysis } };
    }, rls(user));
  }

  private async finishProbeJob(
    user: JwtPayload,
    jobId: string,
    data: { status: 'failed' | 'blocked'; errorMessage: string },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      await em.getRepository(GrowthGeoProbeJobEntity).update(
        { tenantId: user.tenantId, id: jobId } as any,
        { status: data.status, errorMessage: data.errorMessage, finishedAt: new Date() },
      );
      const job = await em.getRepository(GrowthGeoProbeJobEntity).findOne({
        where: { tenantId: user.tenantId, id: jobId } as any,
      });
      if (job?.batchId) await this.refreshGeoBatchSummary(em, user, job.batchId);
      return { success: data.status !== 'failed', data: { job }, error: data.errorMessage };
    }, rls(user));
  }

  private async recentProbeJobs(em: EntityManager, user: JwtPayload, take = 10) {
    await em.getRepository(GrowthGeoProbeJobEntity)
      .createQueryBuilder()
      .update(GrowthGeoProbeJobEntity)
      .set({
        status: 'failed',
        errorMessage: 'probe job timed out',
        finishedAt: new Date(),
      })
      .where('tenant_id = :tenantId', { tenantId: user.tenantId })
      .andWhere('status = :status', { status: 'running' })
      .andWhere("started_at < now() - interval '2 minutes'")
      .execute();
    const jobs = await em.getRepository(GrowthGeoProbeJobEntity).find({
      where: { tenantId: user.tenantId } as any,
      order: { createdAt: 'DESC' },
      take,
    });
    if (!jobs.length) return [];
    const snapshots = await em.getRepository(GrowthGeoAnswerSnapshotEntity).find({
      where: jobs.map((job) => ({ tenantId: user.tenantId, jobId: job.id })) as any,
      take: jobs.length,
    });
    const snapshotByJobId = new Map(snapshots.map((snapshot) => [snapshot.jobId, snapshot]));
    return jobs.map((job) => ({
      id: job.id,
      question: job.question,
      engine: job.engine,
      brandSlug: job.brandSlug,
      category: job.category,
      stage: job.stage,
      batchId: job.batchId,
      questionId: job.questionId,
      competitors: job.competitors || [],
      status: job.status,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      probeId: job.probeId,
      snapshotId: job.snapshotId,
      aivs: job.aivs || 0,
      riskLevel: job.riskLevel || 'low',
      riskReasons: job.riskReasons || [],
      answerPreview: snapshotByJobId.get(job.id)?.answerText?.slice(0, 180) || null,
      screenshotArtifactId: snapshotByJobId.get(job.id)?.screenshotArtifactId || null,
    }));
  }

  private async queryOnSiteReadiness(em: EntityManager, user: JwtPayload) {
    const sites = await em.getRepository(BrandSiteEntity).find({
      where: { tenantId: user.tenantId, status: 'active', deletedAt: IsNull() } as any,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      take: 200,
    });
    const settings = await em.getRepository(BrandSiteBasicSettingsEntity).find({
      where: { tenantId: user.tenantId } as any,
      take: 500,
    });
    const assignments = await em.getRepository(SiteProductAssignmentEntity).find({
      where: { tenantId: user.tenantId, status: 'published', deletedAt: IsNull() } as any,
      take: 1000,
    });
    const settingsBySiteId = new Map(settings.map((row) => [row.siteId, row]));
    const publishedCountBySiteId = assignments.reduce((acc, row) => {
      acc.set(row.siteId, (acc.get(row.siteId) || 0) + 1);
      return acc;
    }, new Map<string, number>());
    const rows = sites.map((site) => {
      const row = settingsBySiteId.get(site.id);
      const publicUrl = site.productionUrl || site.developmentUrl || '';
      const seo = row?.seo || {};
      const organization = row?.organization || {};
      const brandClaims = row?.brandClaims || {};
      const productCount = publishedCountBySiteId.get(site.id) || 0;
      const checks = {
        publicUrl: Boolean(publicUrl),
        sitemap: Boolean(cleanText((seo as any).sitemapUrl)),
        organization: Object.keys(organization).length > 0,
        brandClaims: Object.keys(brandClaims).length > 0,
        publishedProducts: productCount > 0,
      };
      const missing = Object.entries(checks)
        .filter(([, ok]) => !ok)
        .map(([key]) => key);
      const actions = missing.map((key) => ({
        key,
        title: this.onSiteReadinessActionTitle(key),
        kind: key === 'sitemap' ? 'technical' : key === 'publishedProducts' ? 'product-page' : 'content',
      }));
      return {
        siteId: site.id,
        siteCode: site.code,
        siteName: site.nameCn || site.nameEn || site.code,
        url: publicUrl || null,
        publishedProducts: productCount,
        checks,
        missing,
        actions,
        status: missing.length === 0 ? 'ready' : 'needs-work',
        updatedAt: row?.updatedAt || site.updatedAt,
      };
    });
    const ready = rows.filter((row) => row.status === 'ready').length;
    return {
      generatedAt: new Date().toISOString(),
      source: 'postgres',
      sourceTables: ['tenant_brand_sites', 'brand_site_basic_settings', 'site_product_assignments'],
      sites: rows,
      ready,
      total: rows.length,
    };
  }

  private onSiteReadinessActionTitle(key: string) {
    const labels: Record<string, string> = {
      publicUrl: 'Add official website URL',
      sitemap: 'Add sitemap',
      organization: 'Add Organization schema',
      brandClaims: 'Add brand claims',
      publishedProducts: 'Add structured product data',
      productSchema: 'Add Product schema',
      itemListSchema: 'Add ItemList schema',
      faqSchema: 'Add FAQ',
      serviceCases: 'Add service cases',
    };
    return labels[key] || `Add ${key}`;
  }


}

// 鈹€鈹€ E4 · 钀ラ攢鑷姩鍖?Campaign Ops 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
@Injectable()
export class GrowthCampaignService implements OnModuleInit {
  private readonly logger = new Logger('GrowthCampaign');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly attribution: AttributionService,
  ) {}

  /**
   * 璁㈤槄 ingress 鍙戝嚭鐨勭湡瀹?lead.captured 浜嬩欢鍋氬綊鍥犲叆璐︼紙鍚岀鎴峰尮閰嶆垬褰?鈫?璁?leads锛夈€?
   * 璺ㄧ鎴凤紙鍏煙鏆傚瓨 鈫?HQ锛夊綊鍥犵粡鍒嗘瀽鏁颁粨锛屼笉鍦ㄦ鐗╃悊鍐欏叆锛堣 BOARD-3 §2锛夈€?
   */
  onModuleInit(): void {
    this.eventBus.subscribe('lead.captured', (event: OutboxEventEntity) => this.attributeCapturedLead(event));
  }

  private async attributeCapturedLead(event: OutboxEventEntity): Promise<void> {
    const tenantId = event.tenantId;
    const payload = (event.payload || {}) as { campaign?: string | null; source?: string | null };
    const campaignKey = payload.campaign;
    if (!tenantId || !campaignKey) return; // 鏃犳垬褰瑰綊鍥犵淮搴︼細璺宠繃锛堜笉鑷嗛€狅級
    try {
      await withRlsTransaction(this.ds, async (em) => {
        const campaigns = em.getRepository(GrowthCampaignEntity);
        const all = await campaigns.find({ where: { tenantId }, take: 500 });
        const match = all.find(
          (c) => c.name === campaignKey || (c.utm && (c.utm as Record<string, unknown>).campaign === campaignKey),
        );
        if (!match) return; // 鍚岀鎴锋棤鍖归厤鎴樺焦锛氱暀缁欐暟浠撹法鍩熷綊鍥?
        const metrics = em.getRepository(GrowthCampaignMetricEntity);
        // 骞傜瓑锛氫簨浠舵€荤嚎涓恒€岃嚦灏戜竴娆°€嶆姇閫掞紝鐢?source_event_id 浣?inbox 閿€?
        // 閮ㄥ垎鍞竴绱㈠紩 (tenant_id, source_event_id) 浣垮悓涓€浜嬩欢閲嶆姇鏃惰 DB 鍘婚噸锛?
        // 褰掑洜涓嶉噸澶嶈鏁帮紙鐪熷疄褰掑洜锛屼笉鏀惧ぇ leads锛夈€?
        await metrics.save(metrics.create({
          tenantId, campaignId: match.id, leads: 1, period: 'realtime', sourceEventId: event.id,
        }));
      }, { tenantId, actorId: 'system:growth-attribution' });
    } catch (err: unknown) {
      // 23505 = 鍞竴鍐茬獊锛氳 lead.captured 浜嬩欢宸插綊鍥犺繃 鈫?骞傜瓑璺宠繃锛堥潪閿欒锛夈€?
      const pgCode = (err as { code?: string; driverError?: { code?: string } })?.code
        ?? (err as { driverError?: { code?: string } })?.driverError?.code;
      if (pgCode === '23505') {
        this.logger.debug(`lead.captured ${event.id} already attributed 鈥?idempotent skip`);
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

  /** 璁板綍鎴樺焦鎸囨爣 + 鍙?growth.lead.attributed 渚?analytics 褰掑洜鍏ユ暟浠撱€?*/
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

  /** 鎴樺焦鍒楄〃锛堝惈鍒涘缓鏃堕棿/鐘舵€?棰勭畻锛屼緵杩愯惀鎬昏涓庨€夋嫨锛夈€?*/
  async listCampaigns(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(GrowthCampaignEntity).find({
        where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' }, take: 200,
      });
      return { success: true, data: { items } };
    }, rls(user));
  }

  /**
   * ROI 鐪嬫澘锛氭寜鎴樺焦鐢遍绠?鎸囨爣绠楃湡瀹炶浆鍖栨紡鏂?+ CAC/CPL锛堥潪鏇濆厜铏氳崳鎸囨爣锛夈€?
   * 澧炲己锛氱粍鍚堢骇娣峰悎 CAC + 閫愭垬褰瑰紓甯搁璀︼紙闆舵垚浜?CAC 鍋忛珮/鐣欒祫鐜囪繃浣?鏃犳寚鏍囷級锛?
   * 璁╃湅鏉夸粠銆岃褰曘€嶅崌绾т负銆岃繍钀ラ璀︺€嶃€?
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

      const board = base.map((b) => {
        const alerts: { level: 'warn' | 'crit'; kind: string; message: string }[] = [];
        if (b.metricCount === 0) {
          alerts.push({ level: 'warn', kind: 'no-metrics', message: 'No metrics have been recorded; ROI cannot be evaluated.' });
        } else {
          if (b.spend > 0 && b.signed === 0) {
            alerts.push({ level: 'crit', kind: 'no-conversion', message: `Spend ${b.spend} has no conversions; review landing page and follow-up.` });
          }
          if (b.signed > 0 && blendedCac > 0 && b.cac > blendedCac * 2) {
            alerts.push({ level: 'warn', kind: 'high-cac', message: `CAC ${b.cac} is more than 2x portfolio average ${blendedCac}.` });
          }
          if (b.clicks >= 500 && b.leadRate < 0.005) {
            alerts.push({ level: 'warn', kind: 'low-lead-rate', message: `Clicks ${b.clicks} but lead rate is only ${(b.leadRate * 100).toFixed(2)}%; optimize conversion.` });
          }
        }
        return { ...b, alerts };
      });
      const alertCount = board.reduce((s, b) => s + b.alerts.length, 0);
      return { success: true, data: { board, portfolio: { ...portfolio, blendedCac }, alertCount } };
    }, rls(user));
  }

}

@Injectable()
export class GrowthMarketingMaterialService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async createMaterial(user: JwtPayload, dto: Record<string, unknown>) {
    const title = cleanText(dto?.title);
    const materialType = cleanText(dto?.materialType);
    if (!title || !materialType) throw new BadRequestException('title and materialType required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthMarketingMaterialEntity);
      const material = await repo.save(repo.create({
        tenantId: user.tenantId,
        title,
        materialType,
        brandSlug: cleanNullable(dto.brandSlug),
        channel: cleanNullable(dto.channel),
        targetAudience: cleanNullable(dto.targetAudience),
        summary: cleanNullable(dto.summary),
        tags: cleanTags(dto.tags),
        fileArtifactId: cleanNullable(dto.fileArtifactId),
        fileUrl: cleanNullable(dto.fileUrl),
        thumbnailUrl: cleanNullable(dto.thumbnailUrl),
        fileFormat: cleanNullable(dto.fileFormat),
        versionLabel: cleanText(dto.versionLabel, 'v1') || 'v1',
        status: 'active',
        complianceFlags: cleanTags(dto.complianceFlags),
        validFrom: parseOptionalDate(dto.validFrom),
        validUntil: parseOptionalDate(dto.validUntil),
      }));
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'growth.material.created',
        aggregateType: 'growth_marketing_material',
        aggregateId: material.id,
        payload: { materialId: material.id, materialType: material.materialType, brandSlug: material.brandSlug },
      });
      return { success: true, data: { material } };
    }, rls(user));
  }

  async listMaterials(user: JwtPayload, query: Record<string, unknown> = {}) {
    const materialType = cleanText(query.materialType);
    const brandSlug = cleanText(query.brandSlug);
    const keyword = cleanText(query.keyword || query.q);
    const includeArchived =
      String(query.includeArchived || '') === 'true' || String(query.includeArchived || '') === '1';
    const page = Math.max(Math.floor(Number(query.page) || 1), 1);
    const pageSize = Math.min(Math.max(Math.floor(Number(query.pageSize) || 20), 1), 200);
    const SORT_COLUMNS: Record<string, string> = {
      title: 'title',
      materialType: 'materialType',
      brandSlug: 'brandSlug',
      fileFormat: 'fileFormat',
      versionLabel: 'versionLabel',
      updatedAt: 'updatedAt',
      createdAt: 'createdAt',
      downloadCount: 'downloadCount',
    };
    const sortBy = SORT_COLUMNS[cleanText(query.sortBy)] || 'updatedAt';
    const sortOrder = cleanText(query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthMarketingMaterialEntity);
      const baseWhere: Record<string, unknown> = {
        tenantId: user.tenantId,
        ...(includeArchived ? {} : { archivedAt: IsNull() }),
      };
      if (materialType) baseWhere.materialType = materialType;
      if (brandSlug) baseWhere.brandSlug = brandSlug;
      const where = keyword
        ? [
            { ...baseWhere, title: ILike(`%${keyword}%`) },
            { ...baseWhere, summary: ILike(`%${keyword}%`) },
          ]
        : baseWhere;
      const [items, total] = await repo.findAndCount({
        where: where as any,
        order: { [sortBy]: sortOrder } as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const existing = await repo
        .createQueryBuilder('m')
        .select('DISTINCT m.materialType', 'materialType')
        .where('m.tenantId = :tenantId', { tenantId: user.tenantId })
        .andWhere('m.archivedAt IS NULL')
        .orderBy('m.materialType', 'ASC')
        .limit(100)
        .getRawMany();
      const materialTypes = Array.from(new Set([
        ...COMMON_MATERIAL_CATEGORIES,
        ...existing.map((row) => cleanText(row.materialType)).filter(Boolean),
      ]));
      const totalPages = Math.max(Math.ceil(total / pageSize), 1);
      return { success: true, data: { items, total, page, pageSize, totalPages, materialTypes } };
    }, rls(user));
  }

  async getMaterial(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const material = await em.getRepository(GrowthMarketingMaterialEntity).findOne({
        where: { tenantId: user.tenantId, id },
      });
      if (!material) throw new BadRequestException('marketing material not found');
      return { success: true, data: { material } };
    }, rls(user));
  }

  async updateMaterial(user: JwtPayload, id: string, dto: Record<string, unknown>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthMarketingMaterialEntity);
      const material = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!material || material.archivedAt) throw new BadRequestException('marketing material not found');
      if (dto.title !== undefined) {
        const title = cleanText(dto.title);
        if (!title) throw new BadRequestException('title cannot be empty');
        material.title = title;
      }
      if (dto.materialType !== undefined) {
        const materialType = cleanText(dto.materialType);
        if (!materialType) throw new BadRequestException('materialType cannot be empty');
        material.materialType = materialType;
      }
      if (dto.status !== undefined) {
        const status = cleanText(dto.status);
        if (!MATERIAL_STATUSES.has(status)) throw new BadRequestException(`status must be one of ${Array.from(MATERIAL_STATUSES).join('/')}`);
        material.status = status;
      }
      if (dto.brandSlug !== undefined) material.brandSlug = cleanNullable(dto.brandSlug);
      if (dto.channel !== undefined) material.channel = cleanNullable(dto.channel);
      if (dto.targetAudience !== undefined) material.targetAudience = cleanNullable(dto.targetAudience);
      if (dto.summary !== undefined) material.summary = cleanNullable(dto.summary);
      if (dto.tags !== undefined) material.tags = cleanTags(dto.tags);
      if (dto.fileArtifactId !== undefined) material.fileArtifactId = cleanNullable(dto.fileArtifactId);
      if (dto.fileUrl !== undefined) material.fileUrl = cleanNullable(dto.fileUrl);
      if (dto.thumbnailUrl !== undefined) material.thumbnailUrl = cleanNullable(dto.thumbnailUrl);
      if (dto.fileFormat !== undefined) material.fileFormat = cleanNullable(dto.fileFormat);
      if (dto.versionLabel !== undefined) material.versionLabel = cleanText(dto.versionLabel, material.versionLabel) || material.versionLabel;
      if (dto.reviewNote !== undefined) material.reviewNote = cleanNullable(dto.reviewNote);
      if (dto.complianceFlags !== undefined) material.complianceFlags = cleanTags(dto.complianceFlags);
      if (dto.validFrom !== undefined) material.validFrom = parseOptionalDate(dto.validFrom);
      if (dto.validUntil !== undefined) material.validUntil = parseOptionalDate(dto.validUntil);
      await repo.save(material);
      return { success: true, data: { material } };
    }, rls(user));
  }

  async approveMaterial(user: JwtPayload, id: string, dto: Record<string, unknown> = {}) {
    return this.updateMaterial(user, id, { reviewNote: dto.reviewNote });
  }

  async publishMaterial(user: JwtPayload, id: string) {
    return this.updateMaterial(user, id, {});
  }

  async archiveMaterial(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthMarketingMaterialEntity);
      const material = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!material) throw new BadRequestException('marketing material not found');
      material.status = 'archived';
      material.archivedAt = new Date();
      await repo.save(material);
      return { success: true, data: { material } };
    }, rls(user));
  }

  async removeMaterial(user: JwtPayload, id: string) {
    return this.archiveMaterial(user, id);
  }

  async recordDownload(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GrowthMarketingMaterialEntity);
      const material = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!material || material.archivedAt) throw new BadRequestException('marketing material not found');
      material.downloadCount += 1;
      await repo.save(material);
      return { success: true, data: { material, fileUrl: material.fileUrl, fileArtifactId: material.fileArtifactId } };
    }, rls(user));
  }

}

export const GROWTH_SERVICES = [
  GrowthOpinionService,
  GrowthCopyService,
  GrowthGeoService,
  GrowthCampaignService,
  GrowthMarketingMaterialService,
];
