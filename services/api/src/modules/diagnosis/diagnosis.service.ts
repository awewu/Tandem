import { Injectable, ForbiddenException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DiagnosisSessionEntity } from './diagnosis.entity';
import { JwtPayload } from '../auth/auth.service';
import { EventBusService } from '../mdm/event-bus.service';
import { ProductCatalogService } from '../product-catalog/product-catalog.service';
import { ComplianceService } from '../compliance/compliance.service';
import { CrmService } from '../crm/crm.service';
import { hashPII } from '../compliance/compliance.pii';
import { buildRecommendCriteria, resolveDiagnosisBrandTenants } from './diagnosis-recommend-map';
import {
  normalizeCustomer, normalizePainPoints, inferSystems,
  issueShareToken, hashShareToken, newReportId, SYSTEM_LABELS,
} from './diagnosis-engine';
import {
  primaryPainPoints, secondaryPainPointsByDimension, countPainPoints,
  autoDetectPainPoints, inferImplicitPainPoints, painPointsToGeoQuestions,
} from './diagnosis-painpoints';
import { DiagnosisAiService } from './diagnosis-ai.service';
import { composeIndicativeQuote, SYSTEM_QUOTE_KEYWORDS } from './diagnosis-quote';
import { buildPrincipleDiagram } from './diagnosis-visuals';
import { findCases } from './diagnosis-cases';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger('DiagnosisRecommendation');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly catalog: ProductCatalogService,
    private readonly compliance: ComplianceService,
    private readonly crm: CrmService,
    private readonly ai: DiagnosisAiService,
  ) {}

  /**
   * 公开问诊入口的租户上下文（匿名 C 端）。优先 env（品牌运营/获客暂存租户），
   * 生产未配置则拒绝（不静默降级）；非生产回退开发占位，便于本地联调。
   * 与 Legacy server/modules/diagnosis/diagnosis.routes.js#resolvePublicScope 语义对齐。
   */
  private resolvePublicScope(): JwtPayload | null {
    const tenantId = process.env.PUBLIC_DIAGNOSIS_TENANT_ID;
    const base = {
      userId: 'public-consumer', customerId: null, role: 'public_consumer', permissions: [],
    };
    if (tenantId) {
      return {
        ...base, tenantId,
        dealerId: process.env.PUBLIC_DIAGNOSIS_DEALER_ID || null,
        storeId: process.env.PUBLIC_DIAGNOSIS_STORE_ID || null,
      } as JwtPayload;
    }
    // Public traffic must always use an explicitly provisioned PostgreSQL tenant.
    // The former Mongo-style development identifiers are not valid UUIDs and can
    // never satisfy the target database's RLS and foreign-key constraints.
    return null;
  }

  /**
   * 公开问诊完成（匿名 C 端，发布门级 P0）：
   * ① PIPL 同意闸——服务端强制校验，不信任前端 gating；无同意/无政策版本一律 403，不建线索。
   * ② 采集即留痕——先写 pipl_consents（compliance），再完成问诊，并把 consent_id 挂到会话。
   * 收割自 Legacy /public/complete 并强化（Legacy 仅校验、不留痕；此处入库可追溯）。
   */
  async completePublicDiagnosis(body: any, meta: { ip?: string; userAgent?: string } = {}) {
    const scope = this.resolvePublicScope();
    if (!scope) throw new ServiceUnavailableException('公开问诊入口未配置租户上下文');

    const consentGranted = body?.consent === true || body?.consent?.agreed === true;
    const consentMeta = body?.consentMeta || body?.consent?.meta || null;
    const policyVersion = consentMeta?.policyVersion;
    if (!consentGranted || !policyVersion) {
      throw new ForbiddenException({
        success: false,
        error: '需先阅读并同意《个人信息处理授权》',
        code: 'PIPL_CONSENT_REQUIRED',
      });
    }

    const phone = body?.contact?.phone || body?.phone || '';
    const subjectId = phone ? hashPII(String(phone)) : `anon:${Date.now()}`;
    const consent = await this.compliance.recordConsent({
      tenantId: scope.tenantId, subjectId, subjectType: 'consumer',
      purpose: 'diagnosis_intake', policyVersion: String(policyVersion), granted: true,
      channel: 'web', ip: meta.ip, userAgent: meta.userAgent, ttlDays: 365,
    });

    return this.completeDiagnosis(
      scope,
      { ...body, sourceSurface: body?.sourceSurface || 'consumer-diagnosis' },
      consent.id,
    );
  }

  /**
   * 公开痛点提纲（匿名，纯数据，无 DB）：渐进式问诊用。
   * 高频痛点(primary)进 Step2 首屏，其余按维度折叠到「继续补充细节」。
   */
  getPainPointCatalog() {
    return {
      success: true,
      data: {
        total: countPainPoints(),
        primary: primaryPainPoints(),
        secondary: secondaryPainPointsByDimension(),
      },
    };
  }

  /**
   * 公开痛点探测（匿名，纯数据，无 DB）：像医生按体检数据主动提示。
   * autoDetected：户型条件命中的痛点；implicit：profile 推断出的、业主可能没提的隐性痛点。
   */
  detectPainPoints(body: any = {}) {
    const profile = body?.home || body?.profile || body || {};
    const selected: string[] = Array.isArray(body?.selected) ? body.selected : [];
    return {
      success: true,
      data: {
        autoDetected: autoDetectPainPoints(profile),
        implicit: inferImplicitPainPoints(profile, selected),
      },
    };
  }

  private async recommendFromOpenBrandCatalog(body: any, result: any = {}) {
    const criteria = buildRecommendCriteria(body, result);
    const brandInput = body?.brands || body?.brand;
    const scopes = resolveDiagnosisBrandTenants(brandInput);
    const perBrandLimit = Math.max(1, Math.ceil(Number(criteria.limit || 6) / Math.max(scopes.length, 1)));
    const results = await Promise.all(scopes.map(async (scope) => {
      try {
        const rec = await this.catalog.recommend({
          ...criteria,
          tenantId: scope.tenantId,
          brand: scope.brand,
          limit: perBrandLimit,
        });
        return (rec?.data?.items ?? []).map((item: any) => ({
          ...item,
          brand: item?.brand || scope.brand,
          tenantId: item?.tenantId || scope.tenantId,
          recommendationScope: 'open_product_catalog',
        }));
      } catch {
        return [];
      }
    }));
    const items = results
      .flat()
      .sort((a: any, b: any) => Number(b.matchScore || 0) - Number(a.matchScore || 0))
      .slice(0, Number(criteria.limit || 6));
    this.logger.log(JSON.stringify({
      event: 'diagnosis.product_recommendation.completed',
      brands: scopes.map((scope) => scope.brand),
      systems: criteria.systems || [],
      painPointCount: (criteria.painPoints || []).length,
      returned: items.length,
      productSkus: items.map((item: any) => item.sku).filter(Boolean).slice(0, 12),
      fallbackUsed: items.length > 0 && items.every((item: any) => Number(item.matchScore || 0) === 0),
    }));
    return items;
  }

  /**
   * 公开对话式问诊（匿名，无状态、不落 PII）：进化版对话脑入口。
   * 有 LLM Key → 真模型结构化抽取；无 Key/失败 → 纯规则兜底。产出映射痛点、隐性痛点、
   * 下一问、需求共识画像，并附 GEO 选题（打通增长中枢）。返回不含编造数字。
   */
  async consult(body: any = {}) {
    const advice = await this.ai.advise({
      text: body?.text,
      profile: body?.home || body?.profile || {},
      selected: Array.isArray(body?.selected) ? body.selected : [],
    });
    const recommendedProducts = await this.recommendFromOpenBrandCatalog(body, {
      diagnosis: { painPoints: advice.mappedPainIds || body?.painPoints || [], systems: advice.systems || [] },
    });
    return { success: true, data: { ...advice, recommendedProducts } };
  }

  /**
   * 初步选型报价（诚实版，匿名）：问诊痛点→系统→产品目录真实牌价→三档区间。
   * 转化漏斗「促定金」一环。只用真实 listPrice；无目录价的系统标「需现场核算」；
   * 全部标注「以现场勘测为准」。fail-soft：目录不可用时返回不可用态，不阻断、不臆造。
   */
  async indicativeQuote(body: any = {}) {
    const systemCodes: string[] = (() => {
      const sel = Array.isArray(body?.systems) ? body.systems.filter((s: any) => SYSTEM_LABELS[s]) : [];
      if (sel.length) return [...new Set<string>(sel)];
      // 未显式给系统：由痛点/画像推断（复用引擎口径）。
      return inferSystems(body);
    })();
    const systems = systemCodes.map((code) => ({
      code, label: SYSTEM_LABELS[code], keywords: SYSTEM_QUOTE_KEYWORDS[code] || [SYSTEM_LABELS[code]],
    }));
    try {
      const brand = body?.brand ? String(body.brand) : undefined;
      const tenantId = process.env.EVERHOT_TENANT_ID || undefined;
      const res = await this.catalog.priceBandsForSystems({ tenantId, brand }, systems);
      const quote = composeIndicativeQuote(res.data.bands as any);
      return { success: true, data: { systems: systems.map((s) => ({ code: s.code, label: s.label })), quote } };
    } catch {
      return {
        success: true,
        data: {
          systems: systems.map((s) => ({ code: s.code, label: s.label })),
          quote: {
            available: false, currency: 'CNY', tiers: [], pricedSystems: [],
            unpricedSystems: systems.map((s) => ({ code: s.code, label: s.label })),
            coverage: { priced: 0, total: systems.length },
            disclaimer: '目录暂不可用，初步报价将在现场勘测后提供。',
          },
        },
      };
    }
  }

  /** 由请求体解析系统 code（显式 systems 优先，否则由痛点/画像推断）。两处报价/图共用。 */
  private resolveSystemCodes(body: any = {}): string[] {
    const sel = Array.isArray(body?.systems) ? body.systems.filter((s: any) => SYSTEM_LABELS[s]) : [];
    if (sel.length) return [...new Set<string>(sel)];
    return inferSystems(body);
  }

  /**
   * 公开原理示意图（匿名，纯数据）：由选中/推断系统装配「系统如何协同」的示意图（含内联 SVG）。
   * 建信任、帮看懂；标注「原理示意图·非工程图纸」，无任何性能/效果数字。
   */
  principleDiagram(body: any = {}) {
    const diagram = buildPrincipleDiagram(this.resolveSystemCodes(body));
    return { success: true, data: diagram };
  }

  /**
   * 公开案例/效果（匿名，只读真实策展内容）：按系统/城市/户型相关度返回真实案例。
   * 无策展内容 → 空数组（不编造 before/after 与证言）。
   */
  cases(body: any = {}) {
    const items = findCases({
      systems: this.resolveSystemCodes(body),
      city: body?.city || body?.home?.city,
      houseType: body?.houseType || body?.home?.type || body?.propertyType,
      limit: Number(body?.limit) || 6,
    });
    return { success: true, data: { items, total: items.length } };
  }

  /** 公开定位推荐（匿名，脱敏）：映射问诊画像 → catalog.recommend；fail-soft。收割自 Legacy /public/recommend。 */
  async recommendPublic(body: any) {
    try {
      const criteria = buildRecommendCriteria(body, {});
      const items = await this.recommendFromOpenBrandCatalog(body, {});
      return { success: true, data: { items, criteria } };
    } catch {
      return { success: true, data: { items: [] } };
    }
  }

  /** 公开报告读取（凭 shareToken，匿名）。收割自 Legacy /public/reports/:id。 */
  async findPublicReport(reportId: string, shareToken: string) {
    return this.getShareView(reportId, shareToken);
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId ?? undefined, role: user.role };
  }

  async completeDiagnosis(user: JwtPayload, body: any, consentId: string | null = null) {
    // 原生问诊：真实客户校验 + 痛点→系统分类（零编造数字）。价格/档位交 quote 域。
    const customer = normalizeCustomer(body);
    const painPoints = normalizePainPoints(body);
    const systems = inferSystems(body);
    const systemLabels = systems.map((s) => SYSTEM_LABELS[s]);
    const reportId = newReportId();
    const shareToken = issueShareToken(reportId);
    const shareTokenHash = hashShareToken(shareToken);
    const isPublic = user.role === 'public_consumer';

    const persisted = await withRlsTransaction(this.ds, async (em) => {
      // 原生建线索（同事务：客户+商机+生命周期起点+lead.created 事件）
      const lead = await this.crm.createLeadInTx(em, {
        tenantId: user.tenantId, phone: customer.phone, name: customer.name,
        source: 'rysnova-diagnosis', city: customer.city ?? null, address: customer.address ?? null,
        dealerId: user.dealerId ?? null, storeId: user.storeId ?? null,
        ownerUserId: isPublic ? null : (user.userId ?? null),
        profile: { ...(body.home || body.profile || {}), painPoints, systems, address: customer.address },
        tags: ['aiReport'],
      });
      const customerId = lead.customer.id;
      const opportunityId = lead.opportunity?.id ?? null;

      const sessions = em.getRepository(DiagnosisSessionEntity);
      const session = await sessions.save(sessions.create({
        tenantId: user.tenantId, dealerId: user.dealerId ?? null,
        customerId, opportunityId, projectId: null, reportId,
        pain_points: painPoints, systems,
        recommendedTier: null, // 不臆造档位：由 quote 域按真实价生成
        solutions: { systems, systemLabels }, // 诚实画像：仅系统建议，无 ROI/预算
        aiReasoning: (body as any).aiReasoning ?? null,
        shareTokenHash, consentId,
        sourceSurface: (body as any).sourceSurface ?? 'consumer-diagnosis',
      }));

      // 同事务发射：诊断完成 → 线索回流信号（供 CRM/lifecycle/dispatch 消费）。
      // 附带迭代 hook（discoveredPains：模型发现的词表外新痛点，供人工审核并入词库）
      // 与 GEO 打通（geoSeeds：痛点→AI 搜索选题，供增长中枢 E3 回流内容）。
      const discoveredPains: string[] = Array.isArray((body as any).discoveredPains)
        ? (body as any).discoveredPains.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 8) : [];
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId, eventType: 'diagnosis.completed',
        aggregateType: 'diagnosis_session', aggregateId: session.id,
        payload: {
          sessionId: session.id, customerId, opportunityId, reportId,
          painPoints, systems, sourceSurface: session.sourceSurface,
          discoveredPains,
          geoSeeds: painPointsToGeoQuestions(painPoints),
        },
      });
      return { session, customerId, opportunityId, duplicate: lead.duplicate };
    }, this.rls(user));

    // 真实产品推荐（来自产品目录，非臆造）；fail-soft 不阻断主流程。
    let recommendedProducts: unknown[] = [];
    try {
      recommendedProducts = await this.recommendFromOpenBrandCatalog(body, { diagnosis: { painPoints, systems } });
    } catch {
      recommendedProducts = [];
    }

    const shareUrl = `/customer-share.html?reportId=${encodeURIComponent(reportId)}&shareToken=${encodeURIComponent(shareToken)}`;
    return {
      success: true,
      data: {
        reportId, shareUrl, shareToken,
        customerId: persisted.customerId, opportunityId: persisted.opportunityId,
        duplicate: persisted.duplicate,
        diagnosis: { painPoints, systems, systemLabels, completedAt: new Date().toISOString() },
        recommendedProducts,
        pricing: null, // 价格由 quote 域生成，问诊不臆造
      },
    };
  }

  async listSessions(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(DiagnosisSessionEntity).find({
        where: { tenantId: user.tenantId, ...ownershipScope(user) },
        order: { createdAt: 'DESC' }, take: 100,
      });
      return { success: true, data: { items } };
    }, this.rls(user));
  }

  async getReport(user: JwtPayload, reportId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const session = await em.getRepository(DiagnosisSessionEntity).findOne({ where: { tenantId: user.tenantId, reportId, ...ownershipScope(user) } });
      return { success: true, data: session };
    }, this.rls(user));
  }

  async getShareView(reportId: string, shareToken: string) {
    const scope = this.resolvePublicScope();
    if (!scope) throw new ServiceUnavailableException('公开问诊入口未配置租户上下文');
    if (!reportId || !shareToken) return { success: true, data: null };
    const shareTokenHash = hashShareToken(shareToken);
    return withRlsTransaction(this.ds, async (em) => {
      const session = await em.getRepository(DiagnosisSessionEntity).findOne({
        where: { tenantId: scope.tenantId, reportId, shareTokenHash, status: 'active' },
      });
      return { success: true, data: session ? this.toPublicReport(session, shareToken) : null };
    }, this.rls(scope));
  }

  /** 会话行 → 诚实公开报告投影（仅需求画像+系统建议，无编造 ROI/预算/档位）。 */
  private toPublicReport(s: DiagnosisSessionEntity, shareToken: string) {
    const systems = s.systems ?? [];
    return {
      reportId: s.reportId,
      status: s.status,
      diagnosis: {
        painPoints: s.pain_points ?? [],
        systems,
        systemLabels: systems.map((x) => SYSTEM_LABELS[x] || x),
      },
      solutions: s.solutions ?? {},
      recommendedTier: s.recommendedTier,
      sourceSurface: s.sourceSurface,
      generatedAt: s.createdAt,
      shareUrl: `/customer-share.html?reportId=${encodeURIComponent(s.reportId ?? '')}&shareToken=${encodeURIComponent(shareToken)}`,
    };
  }

  async revokeReport(user: JwtPayload, reportId: string) {
    await withRlsTransaction(this.ds, (em) =>
      em.getRepository(DiagnosisSessionEntity).update({ tenantId: user.tenantId, reportId, ...ownershipScope(user) }, { status: 'revoked' }),
    this.rls(user));
    return { success: true };
  }
}
