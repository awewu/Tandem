import { Injectable, BadRequestException, Logger, NotFoundException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ProductEntity, PriceListItemEntity, ProductContentEntity, ProductContentEventEntity, ProductRelationEntity } from './product-catalog.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import type { JwtPayload } from '../auth/auth.service';
import { AuditLogEntity } from '../governance/governance.entity';
import { EventBusService } from '../mdm/event-bus.service';
import { TARGET_API_BOOT_SMOKE } from '../boot-smoke';
import { FileArtifactService } from '../file-artifact/file-artifact.service';
import {
  PRODUCT_TAXONOMY, EMPTY_POSITIONING, sanitizePositioning, sanitizeAssetRefs, computeProductKey,
  DEFAULT_LOCALE, LOCALES, EMPTY_SEO, EMPTY_MARKETING, sanitizeLocale, sanitizeSeo, sanitizeMarketing,
  resolveTransition, isValidRelationType, inverseRelationType,
  type ProductSeo, type ProductMarketing,
} from './product-taxonomy';
import {
  validateContentInput, validateTransitionInput, validateRelationInput, validateProductUpsertInput,
} from './product-catalog.validation';
import { scoreProductRecommendation } from './product-catalog-recommend';

type ProductMutationActor = Pick<JwtPayload, 'userId' | 'role'>;

@Injectable()
export class ProductCatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ProductPublishScheduler');
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectDataSource()                    private readonly ds:       DataSource,
    @InjectRepository(ProductEntity)      private readonly products: Repository<ProductEntity>,
    @InjectRepository(PriceListItemEntity) private readonly prices:   Repository<PriceListItemEntity>,
    @InjectRepository(ProductContentEntity) private readonly contents: Repository<ProductContentEntity>,
    private readonly eventBus: EventBusService,
    private readonly fileArtifacts: FileArtifactService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════
  // A1 · 定时发布调度器：进程内周期扫描，把到期 scheduled 内容自动提升为 published。
  //   设计：无新增依赖（不引入 @nestjs/schedule），沿用仓内 OnModuleInit 生命周期约定。
  //   跨租户发现遵循模型 B 门牌约定——按环境变量 `<SLUG>_TENANT_ID`(+EVERHOT_TENANT_ID)
  //   枚举品牌运营租户 UUID，逐租户在各自 RLS 事务内 publishDueContent，绝不跨租户越权。
  //   boot-smoke / 测试环境不启动定时器（避免副作用与句柄泄漏）。
  // ══════════════════════════════════════════════════════════════════════

  /** 发现应扫描的品牌运营租户 UUID 集合（环境门牌约定，去重）。 */
  private discoverBrandTenants(): string[] {
    const out = new Set<string>();
    for (const [key, val] of Object.entries(process.env)) {
      if (/_TENANT_ID$/.test(key) && val && ProductCatalogService.UUID_RE.test(val)) out.add(val);
    }
    return [...out];
  }

  /** 单轮扫描：逐品牌租户结算到期定时发布；单租户失败不影响其余（隔离容错）。 */
  async runDuePublishSweep(): Promise<{ tenants: number; promoted: number }> {
    const tenants = this.discoverBrandTenants();
    let promoted = 0;
    for (const tenantId of tenants) {
      try {
        const r = await this.publishDueContent(tenantId, 'system-scheduler');
        promoted += (r?.data?.promoted as number) || 0;
      } catch (err: unknown) {
        this.logger.warn(`publish sweep skipped tenant=${tenantId}: ${String(err)}`);
      }
    }
    return { tenants: tenants.length, promoted };
  }

  onModuleInit(): void {
    if (TARGET_API_BOOT_SMOKE || process.env.NODE_ENV === 'test') return; // 桩/测试不启定时器
    const ms = Math.max(Number(process.env.PRODUCT_PUBLISH_SWEEP_MS) || 60_000, 5_000);
    this.sweepTimer = setInterval(() => {
      this.runDuePublishSweep().catch((e) => this.logger.warn(`publish sweep error: ${String(e)}`));
    }, ms);
    this.sweepTimer.unref?.(); // 不阻止进程退出
    this.logger.log(`定时发布调度器已启动（每 ${ms}ms 扫描一次）`);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) { clearInterval(this.sweepTimer); this.sweepTimer = null; }
  }

  private static readonly UUID_RE =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  /**
   * 模型B 第1律写闸：解析并强校验产品写入门牌为品牌运营租户 UUID。
   * 拒绝 rhautt_shared 哨兵与任意非-UUID——防「第二门牌」复发（读路径不受影响）。
   */
  private requireWriteTenant(tenantId?: string): string {
    const resolved = tenantId || process.env.EVERHOT_TENANT_ID || '';
    if (!ProductCatalogService.UUID_RE.test(resolved)) {
      throw new BadRequestException(
        '产品写入门牌必须是品牌运营租户 UUID（模型B 第1律）；rhautt_shared 哨兵已退役。请配置 EVERHOT_TENANT_ID 或显式传 tenantId=UUID。',
      );
    }
    return resolved;
  }

  /**
   * RLS-ready 执行：当 tenantId 为 UUID（品牌运营/RLS 租户）时，在租户作用域
   * 事务内运行（SET LOCAL app.tenant_id），使 RLS 覆盖表与触发器（audit_logs/
   * outbox 等副作用）按该租户强隔离；当为共享哨兵（如 'rhautt_shared'）时直读，
   * 保持 HQ 共享目录的既有行为不变（向后兼容 dev / 未启用 RLS 环境）。
   */
  private scoped<T>(tenantId: string | undefined, work: (repo: Repository<ProductEntity>) => Promise<T>): Promise<T> {
    if (tenantId && ProductCatalogService.UUID_RE.test(tenantId)) {
      return withRlsTransaction(
        this.ds,
        (manager) => work(manager.getRepository(ProductEntity)),
        { tenantId } as TenantScope,
      );
    }
    return work(this.products);
  }

  // 消费方定位筛选：查询参数 → 定位 jsonb 维度（白名单，防注入）。
  private static readonly POS_FILTERS: { q: string; dim: string }[] = [
    { q: 'segment', dim: 'targetSegments' },
    { q: 'channel', dim: 'channels' },
    { q: 'persona', dim: 'userPersonas' },
    { q: 'market',  dim: 'markets' },
    { q: 'scenario', dim: 'applicationScenarios' }, // P5 应用场景筛选（家用/商用双轨受控 code）
  ];

  private normalizePublicSlug(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private everhotMeta(product: ProductEntity): Record<string, any> {
    const meta = (product.meta as any)?.everhot;
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  }

  private publicSlug(product: ProductEntity): string {
    return this.normalizePublicSlug(this.everhotMeta(product).slug || product.sku);
  }

  private displayOrder(product: ProductEntity): number {
    const n = Number(this.everhotMeta(product).displayOrder ?? 0);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }

  private sortForWebsite(left: ProductEntity, right: ProductEntity): number {
    const byOrder = this.displayOrder(left) - this.displayOrder(right);
    if (byOrder) return byOrder;
    const byName = left.name.localeCompare(right.name);
    return byName || left.sku.localeCompare(right.sku);
  }

  private imageUrl(product: ProductEntity, artifactId: string): string {
    return `/api/v2/brand/${encodeURIComponent(String(product.brand || 'everhot'))}/products/${encodeURIComponent(this.publicSlug(product))}/images/${encodeURIComponent(artifactId)}`;
  }

  private publicImageRefs(product: ProductEntity) {
    const rawMeta = product.meta as any;
    const refs = sanitizeAssetRefs(product.assetRefs);
    const legacyMain = rawMeta?.imageArtifactId
      ? [{
        role: 'main',
        artifactId: String(rawMeta.imageArtifactId),
        objectKey: typeof rawMeta.imageObjectKey === 'string' ? rawMeta.imageObjectKey : undefined,
        filename: typeof rawMeta.imageFilename === 'string' ? rawMeta.imageFilename : undefined,
        mimeType: typeof rawMeta.imageMimeType === 'string' ? rawMeta.imageMimeType : undefined,
        sortOrder: 0,
      }]
      : [];
    const mainRef = refs.find((r) => r.role === 'main')
      ?? refs.find((r) => r.role === 'card')
      ?? legacyMain[0]
      ?? null;
    const iconRef = refs.find((r) => r.role === 'icon') ?? null;
    const toPublic = (r: any) => ({
      role: r.role,
      url: this.imageUrl(product, r.artifactId),
      filename: r.filename || '',
      mimeType: r.mimeType || '',
      sortOrder: Number(r.sortOrder) || 0,
    });
    const gallery = refs
      .filter((r) => r.role === 'detail')
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      .map(toPublic);
    return { main: mainRef ? toPublic(mainRef) : null, icon: iconRef ? toPublic(iconRef) : null, gallery };
  }

  private publicGallery(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === 'string') return { url: item.trim() };
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
        return {
          url: String(row.url || '').trim(),
          alt: String(row.alt || '').trim(),
        };
      })
      .filter((item) => item.url);
  }

  private publicProductProjection(product: ProductEntity, locale: string, content?: ProductContentEntity | null) {
    const meta = this.everhotMeta(product);
    const positioning = sanitizePositioning(product.positioning ?? EMPTY_POSITIONING);
    const imageRefs = this.publicImageRefs(product);
    const gallery = imageRefs.gallery.length ? imageRefs.gallery : this.publicGallery(meta.gallery);
    const marketing: ProductMarketing = content?.marketing ?? EMPTY_MARKETING;
    const seo: ProductSeo = content?.seo ?? EMPTY_SEO;
    const base: Record<string, unknown> = {
      slug: this.publicSlug(product),
      sku: product.sku,
      displayOrder: this.displayOrder(product),
      model: meta.model || (product.spec as any)?.officialModel || product.sku,
      name: content?.name || meta.name || product.name,
      cat: meta.cat || product.category,
      sys: meta.sys || '',
      series: meta.series || '',
      tagline: meta.tagline || '',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      badges: Array.isArray(meta.badges) ? meta.badges : Array.isArray(meta.tags) ? meta.tags : [],
      en: meta.en || '',
      icon: imageRefs.icon?.url || meta.icon || '🔥',
      image: imageRefs.main?.url || meta.image || '',
      mainImage: imageRefs.main,
      gallery,
      specImage: meta.specImage || '',
      specs: Array.isArray(meta.specs) ? meta.specs : [],
      features: Array.isArray(meta.features) ? meta.features : [],
      highlights: Array.isArray(meta.highlights) ? meta.highlights : [],
      certs: Array.isArray(meta.certs) ? meta.certs : undefined,
      faqs: Array.isArray(meta.faqs) ? meta.faqs : undefined,
      locale,
      positioning,
      marketing,
      seo,
      jsonLd: this.buildJsonLd(product, content ?? null, locale),
    };
    return Object.fromEntries(Object.entries(base).filter(([, value]) => value !== undefined));
  }

  private async assertBrandSlugUnique(
    repo: Repository<ProductEntity>,
    tenantId: string,
    brand: string,
    slugInput: unknown,
    excludeId?: string,
  ): Promise<void> {
    const slug = this.normalizePublicSlug(slugInput);
    if (!slug) throw new BadRequestException('Everhot 产品 slug 必填');
    const qb = repo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.brand = :brand', { brand })
      .andWhere("COALESCE(NULLIF(p.meta->'everhot'->>'slug', ''), p.sku) = :slug", { slug });
    if (excludeId) qb.andWhere('p.id <> :excludeId', { excludeId });
    const conflict = await qb.getOne();
    if (conflict) throw new BadRequestException(`Everhot 产品 slug 已存在：${slug}`);
  }

  async list(query: Record<string, unknown>) {
    const tenantId = (query.tenantId as string) || 'rhautt_shared';
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 50, 1), 100);
    return this.scoped(tenantId, async (repo) => {
      const qb = repo.createQueryBuilder('p').where('p.tenant_id = :tenantId', { tenantId });
      if (query.brand)    qb.andWhere('p.brand = :brand', { brand: String(query.brand).toLowerCase() });
      if (query.category) qb.andWhere('p.category = :category', { category: query.category });
      if (query.status)   qb.andWhere('p.status = :status', { status: query.status });
      else qb.andWhere("p.status <> 'archived'");
      if (query.q) {
        qb.andWhere(
          "(p.name ILIKE :q OR p.sku ILIKE :q OR p.brand ILIKE :q OR COALESCE(p.spec->>'officialModel', '') ILIKE :q OR COALESCE(p.meta->'everhot'->>'slug', '') ILIKE :q OR COALESCE(p.meta->'everhot'->>'series', '') ILIKE :q OR COALESCE(p.meta->'everhot'->>'tagline', '') ILIKE :q)",
          { q: `%${String(query.q).trim()}%` },
        );
      }
      // 定位维度筛选（P4 消费）：jsonb 数组元素存在性。dim 取自白名单，非用户任意串。
      ProductCatalogService.POS_FILTERS.forEach((f, i) => {
        const v = query[f.q];
        if (v) qb.andWhere(`jsonb_exists(p.positioning -> '${f.dim}', :posv${i})`, { [`posv${i}`]: String(v) });
      });
      qb
        .orderBy(
          "CASE WHEN p.meta->'everhot'->>'displayOrder' ~ '^[0-9]+$' THEN (p.meta->'everhot'->>'displayOrder')::int ELSE 0 END",
          'ASC',
        )
        .addOrderBy('p.name', 'ASC')
        .addOrderBy('p.sku', 'ASC')
        .skip((page - 1) * pageSize)
        .take(pageSize);
      const [items, total] = await qb.getManyAndCount();
      const facetRows = await repo.find({ where: { tenantId } as any, take: 2000 });
      const toFacet = (values: Array<string | null | undefined>) => {
        const counts = new Map<string, number>();
        for (const value of values) {
          const key = String(value || '').trim();
          if (!key) continue;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        return [...counts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => a.value.localeCompare(b.value));
      };
      const facets = {
        brands: toFacet(facetRows.map((p) => p.brand)),
        categories: toFacet(facetRows.map((p) => p.category)),
        statuses: toFacet(facetRows.map((p) => p.status)),
      };
      return { success: true, data: { items, total, page, pageSize, pages: Math.ceil(total / pageSize), facets } };
    });
  }

  /**
   * MDM-lite 去重候选（P4）：按稳定 product_key 分组，返回 >1 的疑似重复组。
   * 只读诊断——不自动合并（合并需人工/后续策略），呼应宪章 M15 / MDM。
   */
  async dedupeCandidates(tenantId = 'rhautt_shared') {
    const rows = await this.scoped(tenantId, (repo) =>
      repo.find({ where: { tenantId } as any, take: 2000 }),
    );
    const groups = new Map<string, Array<Record<string, unknown>>>();
    for (const p of rows) {
      const key = p.productKey || computeProductKey(p.name, p.category);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: p.id, sku: p.sku, name: p.name, brand: p.brand, category: p.category });
    }
    const dupes = [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([productKey, members]) => ({ productKey, count: members.length, members }));
    return { success: true, data: { groups: dupes, total: dupes.length } };
  }

  async get(id: string, tenantId: string) {
    const product = await this.scoped(tenantId, (repo) => repo.findOne({ where: { id, tenantId } }));
    if (!product) throw new NotFoundException('产品不存在');
    return { success: true, data: product };
  }

  /**
   * 定位画像推荐（P4 消费原语）：给定画像约束（segments/channels/personas/markets）
   * 与可选痛点文本，按匹配度打分排序返回上架产品（公开安全投影，不含成本）。
   * 边界：D2 只按「定位约束」推荐；诊断内部字段 → 定位 code 的映射由消费方（问诊/报价）
   * 决定并传入，D2 不感知消费方语义。OR/加权语义（区别于 list 的严格 AND 筛选）。
   */
  async recommend(criteria: Record<string, unknown>) {
    const norm = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean)
        : typeof v === 'string' && v.trim() ? [v.trim()] : [];
    const wanted: Record<string, string[]> = {
      targetSegments:       norm(criteria.segments),
      channels:             norm(criteria.channels),
      userPersonas:         norm(criteria.personas),
      markets:              norm(criteria.markets),
      applicationScenarios: norm(criteria.scenarios), // P5 应用场景（家用/商用）参与推荐打分
    };
    const painPoints = norm(criteria.painPoints).map((s) => s.toLowerCase());
    const systems = norm(criteria.systems).map((s) => s.toLowerCase());
    const hasCriteria = systems.length > 0 || painPoints.length > 0 || Object.values(wanted).some((a) => a.length > 0);
    const tenantId = (criteria.tenantId as string) || 'rhautt_shared';
    const brand = criteria.brand as string | undefined;
    const limit = Math.min(Number(criteria.limit) || 10, 50);

    const rows = await this.scoped(tenantId, (repo) => repo.find({
      where: (brand ? { tenantId, brand, status: 'active' } : { tenantId, status: 'active' }) as any,
      take: 500,
    }));

    const scored = rows.map((p) => {
      const rec = scoreProductRecommendation(p, { ...criteria, painPoints, systems });
      return { p, pos: rec.positioning, score: rec.score, signals: rec.signals };
    });

    const matched = hasCriteria
      ? scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
      : [];
    const ranked = matched.length
      ? matched
      : scored.sort((a, b) => a.p.name.localeCompare(b.p.name));

    const items = ranked.slice(0, limit).map(({ p, score, signals }) => {
      const base = this.publicProductProjection(p, DEFAULT_LOCALE, null);
      return {
        ...base,
        matchScore: score,
        matchSignals: signals,
      };
    });
    return { success: true, data: { items, total: items.length } };
  }

  /**
   * 初步选型报价用价格带（诚实版）：按系统关键词匹配上架产品，返回各系统真实 listPrice（牌价）分布。
   * 牌价为公开安全字段（与 JSON-LD offers 同口径），不含 cost_price/dealer_price 等内部价。
   * 匹配信号：产品 category / name / 定位文本（valueProposition/painPoints/scenarios）命中系统关键词。
   * 消费方（问诊/报价）传入 systems 及其关键词；D2 不感知消费方语义。无匹配 → priced:false（不臆造）。
   */
  async priceBandsForSystems(
    criteria: { tenantId?: string; brand?: string },
    systems: { code: string; label: string; keywords: string[] }[],
  ) {
    const tenantId = criteria.tenantId || process.env.EVERHOT_TENANT_ID || 'rhautt_shared';
    const brand = criteria.brand;
    const rows = await this.scoped(tenantId, (repo) => repo.find({
      where: (brand ? { tenantId, brand, status: 'active' } : { tenantId, status: 'active' }) as any,
      take: 1000,
    }));
    const priced = rows.filter((p) => Number(p.listPrice) > 0);
    const currency = priced[0]?.currency || 'CNY';
    const bands = systems.map((sys) => {
      const kws = (sys.keywords.length ? sys.keywords : [sys.label]).map((k) => k.toLowerCase());
      const matches = priced.filter((p) => {
        const pos = p.positioning || ({} as any);
        const hay = [p.category, p.name, pos.valueProposition, ...(pos.painPoints || []), ...(pos.scenarios || [])]
          .filter(Boolean).join(' ').toLowerCase();
        return kws.some((k) => hay.includes(k));
      });
      if (!matches.length) return { code: sys.code, label: sys.label, priced: false, count: 0 };
      const prices = matches.map((m) => Number(m.listPrice)).sort((a, b) => a - b);
      return { code: sys.code, label: sys.label, priced: true, count: prices.length, prices, currency };
    });
    return { success: true, data: { currency, bands } };
  }

  /**
   * 公开只读：按品牌返回上架产品，脱敏（不含 cost_price 等内部字段）。
   * 供匿名站点构建期发布管线拉取（EVERHOT-NEXUS-INTEGRATION-DESIGN §5.2）。
   * 共享哨兵租户直读；品牌运营 UUID 租户经 scoped()（RLS 作用域）读取。
   * 回读优先 meta.everhot（导入时保存的原始品牌产品对象，保证无损往返）。
   */
  async listBrandPublic(brand: string, tenantId = process.env.EVERHOT_TENANT_ID || 'rhautt_shared') {
    const rows = await this.scoped(tenantId, (repo) => repo.find({
      where: { tenantId, brand, status: 'active' } as any,
      take: 500,
    }));
    const items = rows.sort((a, b) => this.sortForWebsite(a, b)).map((p) => this.publicProductProjection(p, DEFAULT_LOCALE, null));
    return { success: true, data: { items, total: items.length } };
  }

  async upsert(dto: Partial<ProductEntity>, actor?: ProductMutationActor) {
    validateProductUpsertInput(dto);
    // B1 类型边界校验：错误类型硬失败（sku/name 字符串、listPrice 数字、positioning 对象…）。
    validateProductUpsertInput(dto);
    // 模型B 第1律写闸：产品门牌必须是品牌运营租户 UUID；rhautt_shared 哨兵已退役，禁止写入。
    const tenantId = this.requireWriteTenant(dto.tenantId);
    // 定位字段归一（受控词表软约束）：仅当显式传入时改写，避免 partial 更新误清已有定位。
    const patch: Partial<ProductEntity> = { ...dto, tenantId };
    if ('positioning' in dto) patch.positioning = sanitizePositioning(dto.positioning);
    if ('assetRefs' in dto) patch.assetRefs = sanitizeAssetRefs(dto.assetRefs);
    return withRlsTransaction(this.ds, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const existing = dto.sku
        ? await repo.findOne({ where: { tenantId, sku: dto.sku } })
        : null;
      if (!existing && (!dto.sku?.trim() || !dto.name?.trim())) {
        throw new BadRequestException('新增产品必须提供 sku 和 name');
      }
      const tenantBrand = await this.resolveTenantBrand(manager, tenantId);
      if (dto.brand && dto.brand.toLowerCase() !== tenantBrand) {
        throw new BadRequestException(`品牌必须与当前租户一致（${tenantBrand}）`);
      }
      patch.brand = tenantBrand;
      const base = { ...(existing ?? {}), ...patch };
      await this.assertBrandSlugUnique(repo, tenantId, tenantBrand, (base.meta as any)?.everhot?.slug || base.sku, existing?.id);
      // MDM-lite product_key（P4）：缺失时自动回填（新行/历史行均覆盖），显式传入优先。
      if (!base.productKey && base.name) base.productKey = computeProductKey(base.name, base.category);
      const saved = await repo.save(repo.create(base));
      await this.recordProductMutation(manager, actor, existing ? 'product.update' : 'product.create', existing, saved);
      return { success: true, data: saved };
    }, { tenantId, actorId: actor?.userId, role: actor?.role });
  }

  async update(
    id: string,
    tenantId: string,
    dto: Record<string, unknown>,
    actor: ProductMutationActor,
  ) {
    validateProductUpsertInput(dto);
    const mutable = [
      'name', 'category', 'spec', 'positioning', 'assetRefs', 'productKey',
      'listPrice', 'costPrice', 'currency', 'status', 'meta',
    ] as const;
    const patch = Object.fromEntries(mutable
      .filter((key) => Object.prototype.hasOwnProperty.call(dto, key) && dto[key] !== undefined)
      .map((key) => [key, dto[key]])) as Partial<ProductEntity>;
    if (!Object.keys(patch).length) throw new BadRequestException('没有可更新字段');
    if ('positioning' in patch) patch.positioning = sanitizePositioning(patch.positioning);
    if ('assetRefs' in patch) patch.assetRefs = sanitizeAssetRefs(patch.assetRefs);

    return withRlsTransaction(this.ds, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const before = await repo.findOne({ where: { id, tenantId } });
      if (!before) throw new NotFoundException('产品不存在');
      await this.assertBrandSlugUnique(
        repo,
        tenantId,
        String(before.brand || ''),
        (patch.meta as any)?.everhot?.slug || this.publicSlug(before),
        before.id,
      );
      const saved = await repo.save(repo.create({ ...before, ...patch, id, tenantId, sku: before.sku, brand: before.brand }));
      await this.recordProductMutation(manager, actor, 'product.update', before, saved);
      return { success: true, data: saved };
    }, { tenantId, actorId: actor.userId, role: actor.role });
  }

  async archive(id: string, tenantId: string, actor: ProductMutationActor) {
    return withRlsTransaction(this.ds, async (manager) => {
      const repo = manager.getRepository(ProductEntity);
      const before = await repo.findOne({ where: { id, tenantId } });
      if (!before) throw new NotFoundException('产品不存在');
      const saved = before.status === 'archived'
        ? before
        : await repo.save(repo.create({ ...before, status: 'archived' }));
      if (before.status !== 'archived') {
        await this.recordProductMutation(manager, actor, 'product.archive', before, saved);
      }
      return { success: true, data: saved };
    }, { tenantId, actorId: actor.userId, role: actor.role });
  }

  private async resolveTenantBrand(manager: EntityManager, tenantId: string): Promise<string> {
    const rows = await manager.query(
      `SELECT lower(COALESCE(NULLIF(settings->>'brand', ''), code)) AS brand
         FROM rhautt_nexus.tenants
        WHERE id::text = $1 AND status = 'active'
        LIMIT 1`,
      [tenantId],
    );
    const brand = String(rows[0]?.brand || '').trim();
    if (!brand) throw new BadRequestException('当前租户不是有效的品牌运营租户');
    return brand;
  }

  private productAuditState(product: ProductEntity | null) {
    if (!product) return null;
    return {
      id: product.id,
      tenantId: product.tenantId,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      category: product.category,
      listPrice: Number(product.listPrice || 0),
      status: product.status,
    };
  }

  private async recordProductMutation(
    manager: EntityManager,
    actor: ProductMutationActor | undefined,
    action: 'product.create' | 'product.update' | 'product.archive',
    before: ProductEntity | null,
    after: ProductEntity,
  ) {
    const beforeState = this.productAuditState(before);
    const afterState = this.productAuditState(after);
    const auditRepo = manager.getRepository(AuditLogEntity);
    await auditRepo.save(auditRepo.create({
      tenantId: after.tenantId,
      actorUserId: actor?.userId || null,
      action,
      resourceType: 'product',
      resourceId: after.id,
      beforeState,
      afterState,
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
    await this.eventBus.publishInTx(manager, {
      tenantId: after.tenantId,
      eventType: `${action}d`.replace('createdd', 'created').replace('updatedd', 'updated').replace('archivedd', 'archived'),
      aggregateType: 'product',
      aggregateId: after.id,
      payload: afterState || { id: after.id },
    });
    this.logger.log(JSON.stringify({ event: action, tenantId: after.tenantId, productId: after.id, sku: after.sku, actorId: actor?.userId || null }));
  }

  /** D2 定位受控词表（供后台下拉 / 消费方一致筛选）。 */
  taxonomy() {
    return { success: true, data: PRODUCT_TAXONOMY };
  }

  async getDealerPrice(tenantId: string, dealerId: string, productId: string) {
    // price_list_items 受租户级 FORCE RLS 管辖：在租户作用域事务内读取，
    // 由 DB 层 current_tenant_id() 强隔离（此处以显式 tenantId 作 scopeOverride）。
    const priceRow = await withRlsTransaction(
      this.ds,
      (manager) =>
        manager.getRepository(PriceListItemEntity).findOne({
          where: { tenantId, dealerId, productId },
          order: { createdAt: 'DESC' },
        }),
      { tenantId } as TenantScope,
    );
    // products 为 HQ 共享目录（非 uuid 租户哨兵），不纳入 RLS，直读。
    const base = await this.products.findOne({ where: { id: productId } });
    return {
      success: true,
      data: {
        listPrice: base?.listPrice ?? 0,
        dealerPrice: priceRow?.dealerPrice ?? base?.listPrice ?? 0,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // L7 营销供给层（i18n + SEO/GEO + 富营销内容）· D2-BLUEPRINT §10
  // ══════════════════════════════════════════════════════════════════════

  /**
   * L7 写入：upsert 某产品某 locale 的营销内容（本地化名/SEO/富内容/发布态）。
   * 模型B 第1律写闸：门牌须品牌运营租户 UUID；全程 RLS 作用域事务（product_content FORCE RLS）。
   * 软约束归一：seo/marketing/locale 经 sanitize，未知值静默剔除，不硬失败。
   */
  async upsertContent(productId: string, dto: Record<string, unknown>) {
    validateContentInput(dto); // B1 类型边界：seo/marketing 必对象、locale/status/gtin/mpn 必字符串
    const tenantId = this.requireWriteTenant(dto.tenantId as string | undefined);
    const locale = sanitizeLocale(dto.locale);
    const status = dto.status === 'published' ? 'published' : 'draft';
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const repo = manager.getRepository(ProductContentEntity);
        const existing = await repo.findOne({ where: { tenantId, productId, locale } });
        const patch: Partial<ProductContentEntity> = { ...(existing ?? {}), tenantId, productId, locale, status };
        if ('name' in dto) patch.name = typeof dto.name === 'string' ? dto.name.trim() : null;
        if ('displayCurrency' in dto) patch.displayCurrency = String(dto.displayCurrency || 'CNY');
        if ('seo' in dto) patch.seo = sanitizeSeo(dto.seo);
        if ('gtin' in dto) patch.gtin = typeof dto.gtin === 'string' ? dto.gtin.trim() : null;
        if ('mpn' in dto) patch.mpn = typeof dto.mpn === 'string' ? dto.mpn.trim() : null;
        if ('marketing' in dto) patch.marketing = sanitizeMarketing(dto.marketing);
        patch.publishedAt = status === 'published' ? (existing?.publishedAt ?? new Date()) : null;
        const saved = await repo.save(repo.create(patch));
        return { success: true, data: saved };
      },
      { tenantId } as TenantScope,
    );
  }

  /** L7 后台读：列某产品所有 locale 的营销内容（含 draft），受租户作用域。 */
  async listContent(productId: string, tenantId: string) {
    const rows = await withRlsTransaction(
      this.ds,
      (manager) =>
        manager.getRepository(ProductContentEntity).find({
          where: { tenantId, productId },
          order: { locale: 'ASC' },
        }),
      { tenantId } as TenantScope,
    );
    return { success: true, data: { items: rows, total: rows.length } };
  }

  /**
   * A4 i18n 覆盖率报表：针对某租户（可选按品牌）上架产品 × 受支持 locale，
   * 给出每产品各 locale 的内容状态（missing/draft/review/scheduled/published），
   * 并汇总每 locale 的 published 覆盖率——供运营定位「哪些 SKU 缺哪些语言」的翻译缺口。
   * 只读、脱敏（仅 sku/name/status），全程 RLS 作用域。
   */
  async contentCoverage(tenantId: string, brand?: string) {
    this.requireWriteTenant(tenantId); // 覆盖率是运营视图，限品牌运营租户 UUID
    const supported = LOCALES.map((l) => l.code);
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const products = await manager.getRepository(ProductEntity).find({
          where: (brand ? { tenantId, brand, status: 'active' } : { tenantId, status: 'active' }) as any,
          order: { name: 'ASC' },
          take: 1000,
        });
        const ids = products.map((p) => p.id);
        const contents = ids.length
          ? await manager.getRepository(ProductContentEntity).find({ where: { tenantId, productId: In(ids) } })
          : [];
        // productId → locale → status
        const byProduct = new Map<string, Map<string, string>>();
        for (const c of contents) {
          if (!byProduct.has(c.productId)) byProduct.set(c.productId, new Map());
          byProduct.get(c.productId)!.set(c.locale, c.status);
        }
        const localePublished: Record<string, number> = Object.fromEntries(supported.map((l) => [l, 0]));
        const items = products.map((p) => {
          const map = byProduct.get(p.id) ?? new Map<string, string>();
          const locales: Record<string, string> = {};
          const missing: string[] = [];
          for (const loc of supported) {
            const st = map.get(loc) ?? 'missing';
            locales[loc] = st;
            if (st === 'published') localePublished[loc] += 1;
            else missing.push(loc);
          }
          return { productId: p.id, sku: p.sku, name: p.name, locales, missing };
        });
        const total = products.length;
        const summary = supported.map((loc) => ({
          locale: loc,
          published: localePublished[loc],
          total,
          coverage: total ? Math.round((localePublished[loc] / total) * 1000) / 10 : 0,
        }));
        return { success: true, data: { supportedLocales: supported, total, summary, items } };
      },
      { tenantId } as TenantScope,
    );
  }

  /**
   * locale 回退：请求 locale 的 published 内容 → 默认 locale published → null。
   * 在给定租户作用域事务内查询（product_content FORCE RLS）。
   */
  private async fetchContentForLocale(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    productId: string,
    locale: string,
  ): Promise<ProductContentEntity | null> {
    const repo = manager.getRepository(ProductContentEntity);
    // 发布门：status=published 且 publishedAt<=now（未来定时/scheduled 不外泄）。
    const live = (c: ProductContentEntity | null): ProductContentEntity | null =>
      c && c.status === 'published' && (!c.publishedAt || c.publishedAt.getTime() <= Date.now()) ? c : null;
    const wanted = live(await repo.findOne({ where: { tenantId, productId, locale, status: 'published' } }));
    if (wanted) return wanted;
    if (locale !== DEFAULT_LOCALE) {
      const fallback = live(await repo.findOne({ where: { tenantId, productId, locale: DEFAULT_LOCALE, status: 'published' } }));
      if (fallback) return fallback;
    }
    return null;
  }

  /** 发布门判定：status=published 且 publishedAt<=now（未来定时/scheduled 不外泄）。 */
  private isLiveContent(c: ProductContentEntity | null | undefined): boolean {
    return !!c && c.status === 'published' && (!c.publishedAt || c.publishedAt.getTime() <= Date.now());
  }

  /**
   * B2 批量预加载：一次取多产品在（请求 locale + 默认 locale）的 live 内容，
   * 返回 `${productId}::${locale}` → content 的 Map，供 pickLocale 内存择优，消除 N+1。
   */
  private async batchLiveContent(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    productIds: string[],
    locale: string,
  ): Promise<Map<string, ProductContentEntity>> {
    const map = new Map<string, ProductContentEntity>();
    if (!productIds.length) return map;
    const locales = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];
    const rows = await manager.getRepository(ProductContentEntity).find({
      where: { tenantId, productId: In(productIds), locale: In(locales), status: 'published' },
    });
    for (const c of rows) {
      if (this.isLiveContent(c)) map.set(`${c.productId}::${c.locale}`, c);
    }
    return map;
  }

  /** 从批量 Map 里按回退链择优：请求 locale → 默认 locale → null。 */
  private pickLocale(
    map: Map<string, ProductContentEntity>,
    productId: string,
    locale: string,
  ): ProductContentEntity | null {
    return map.get(`${productId}::${locale}`) ?? map.get(`${productId}::${DEFAULT_LOCALE}`) ?? null;
  }

  /**
   * schema.org JSON-LD 计算投影（不落库，避免漂移）——供品牌站直接注入结构化数据。
   * 只用公开安全字段（无 cost/PII）；价格用 listPrice（牌价）。
   */
  private buildJsonLd(
    product: ProductEntity,
    content: ProductContentEntity | null,
    locale: string,
  ): Record<string, unknown> {
    const seo: ProductSeo = content?.seo ?? EMPTY_SEO;
    const name = content?.name || product.name;
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      sku: product.sku,
      inLanguage: locale,
    };
    if (product.brand) jsonLd.brand = { '@type': 'Brand', name: product.brand };
    if (product.category) jsonLd.category = product.category;
    if (seo.metaDescription) jsonLd.description = seo.metaDescription;
    if (seo.ogImage) jsonLd.image = seo.ogImage;
    if (content?.gtin) jsonLd.gtin = content.gtin;
    if (content?.mpn) jsonLd.mpn = content.mpn;
    if (Number(product.listPrice) > 0) {
      jsonLd.offers = {
        '@type': 'Offer',
        priceCurrency: content?.displayCurrency || product.currency || 'CNY',
        price: Number(product.listPrice),
        availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/Discontinued',
      };
    }
    return jsonLd;
  }

  /** 把本地化内容合并进公开投影（脱敏），并内联 JSON-LD。 */
  private projectLocalized(product: ProductEntity, content: ProductContentEntity | null, locale: string) {
    return this.publicProductProjection(product, locale, content);
  }

  /**
   * L5 公开本地化目录（脱敏、含 JSON-LD）：按品牌+locale 返回上架产品。
   * 回退链：请求 locale published → 默认 locale published → 仅基础事实（marketing/seo 空）。
   */
  async listBrandPublicLocalized(brand: string, localeInput: unknown, tenantIdInput?: string) {
    const locale = sanitizeLocale(localeInput);
    const tenantId = tenantIdInput || process.env.EVERHOT_TENANT_ID || 'rhautt_shared';
    // UUID 租户：products + product_content 同一 RLS 事务读取（避免嵌套事务）。
    if (ProductCatalogService.UUID_RE.test(tenantId)) {
      return withRlsTransaction(
        this.ds,
        async (manager) => {
          const rows = await manager.getRepository(ProductEntity).find({
            where: { tenantId, brand, status: 'active' } as any,
            take: 500,
          });
          // B2 消除 N+1：一次批量取所有产品的（请求 locale + 默认 locale）已发布内容，
          // 在内存里按回退链择优，替代逐产品 2 次查询。
          const liveByProductLocale = await this.batchLiveContent(manager, tenantId, rows.map((p) => p.id), locale);
          const items = rows
            .sort((a, b) => this.sortForWebsite(a, b))
            .map((p) => this.projectLocalized(p, this.pickLocale(liveByProductLocale, p.id, locale), locale));
          return { success: true, data: { items, total: items.length, locale } };
        },
        { tenantId } as TenantScope,
      );
    }
    // 共享哨兵：直读产品，无 L7 内容（回退基础事实）。
    const rows = await this.products.find({
      where: { tenantId, brand, status: 'active' } as any,
      take: 500,
    });
    const items = rows.sort((a, b) => this.sortForWebsite(a, b)).map((p) => this.projectLocalized(p, null, locale));
    return { success: true, data: { items, total: items.length, locale } };
  }

  async listPublicLocalizedByIds(productIds: string[], localeInput: unknown, tenantId: string) {
    const locale = sanitizeLocale(localeInput);
    const ids = [...new Set(productIds.filter(Boolean))];
    if (!ids.length) return [];
    if (!ProductCatalogService.UUID_RE.test(tenantId)) {
      throw new BadRequestException('产品租户必须是 UUID');
    }
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const rows = await manager.getRepository(ProductEntity).find({
          where: { id: In(ids), tenantId, status: 'active' } as any,
          take: 500,
        });
        const liveByProductLocale = await this.batchLiveContent(manager, tenantId, rows.map((p) => p.id), locale);
        return rows.map((product) => ({
          productId: product.id,
          brand: product.brand,
          category: product.category,
          ...this.projectLocalized(product, this.pickLocale(liveByProductLocale, product.id, locale), locale),
        }));
      },
      { tenantId } as TenantScope,
    );
  }

  /** L5 公开单品（脱敏、含 JSON-LD）：按品牌+sku+locale 返回，含回退。 */
  async getBrandProductLocalized(brand: string, sku: string, localeInput: unknown, tenantIdInput?: string) {
    const locale = sanitizeLocale(localeInput);
    const tenantId = tenantIdInput || process.env.EVERHOT_TENANT_ID || 'rhautt_shared';
    const slug = this.normalizePublicSlug(sku);
    if (ProductCatalogService.UUID_RE.test(tenantId)) {
      return withRlsTransaction(
        this.ds,
        async (manager) => {
          const product = await manager.getRepository(ProductEntity)
            .createQueryBuilder('p')
            .where('p.tenant_id = :tenantId', { tenantId })
            .andWhere('p.brand = :brand', { brand })
            .andWhere('p.status = :status', { status: 'active' })
            .andWhere("(p.sku = :sku OR COALESCE(NULLIF(p.meta->'everhot'->>'slug', ''), p.sku) = :slug)", { sku, slug })
            .getOne();
          if (!product) return { success: true, data: null };
          const content = await this.fetchContentForLocale(manager, tenantId, product.id, locale);
          const projected = this.projectLocalized(product, content, locale);
          const related = await this.fetchRelatedForPublic(manager, tenantId, product.id, locale);
          return { success: true, data: { ...projected, related } };
        },
        { tenantId } as TenantScope,
      );
    }
    const product = await this.products
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.brand = :brand', { brand })
      .andWhere('p.status = :status', { status: 'active' })
      .andWhere("(p.sku = :sku OR COALESCE(NULLIF(p.meta->'everhot'->>'slug', ''), p.sku) = :slug)", { sku, slug })
      .getOne();
    if (!product) return { success: true, data: null };
    return { success: true, data: this.projectLocalized(product, null, locale) };
  }

  async getPublicProductImage(brand: string, sku: string, artifactId: string, tenantIdInput?: string) {
    const tenantId = tenantIdInput || process.env.EVERHOT_TENANT_ID || 'rhautt_shared';
    const slug = this.normalizePublicSlug(sku);
    const findProduct = (repo: Repository<ProductEntity>) => repo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.brand = :brand', { brand })
      .andWhere('p.status = :status', { status: 'active' })
      .andWhere("(p.sku = :sku OR COALESCE(NULLIF(p.meta->'everhot'->>'slug', ''), p.sku) = :slug)", { sku, slug })
      .getOne();
    const product = ProductCatalogService.UUID_RE.test(tenantId)
      ? await withRlsTransaction(this.ds, (manager) => findProduct(manager.getRepository(ProductEntity)), { tenantId } as TenantScope)
      : await findProduct(this.products);
    if (!product) return null;
    const refs = sanitizeAssetRefs(product.assetRefs);
    const legacyId = (product.meta as any)?.imageArtifactId;
    const linked = refs.some((r) => ['main', 'detail', 'card', 'icon'].includes(r.role) && r.artifactId === artifactId)
      || legacyId === artifactId;
    if (!linked) return null;
    return this.fileArtifacts.getPublicActiveArtifact(tenantId, artifactId);
  }

  // ── L7 发布工作流（P1）· draft→review→scheduled→published + 审计流转 ────────
  /**
   * 工作流流转：submit/approve/schedule/reject/unpublish。状态机受控（resolveTransition）；
   * 每次流转写 product_content_events 审计行；全程 RLS 作用域事务。
   * approve→published 记 publishedAt=now；schedule→scheduled 记未来 scheduledAt；
   * unpublish→draft 清 publishedAt/scheduledAt。
   */
  async transitionContent(
    productId: string,
    localeInput: unknown,
    action: string,
    opts: { tenantId?: string; scheduledAt?: unknown; note?: string; actor?: string } = {},
  ) {
    validateTransitionInput({ ...opts, action }); // B1 类型边界：action 必填字符串、scheduledAt 必字符串
    const tenantId = this.requireWriteTenant(opts.tenantId);
    const locale = sanitizeLocale(localeInput);
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const repo = manager.getRepository(ProductContentEntity);
        const content = await repo.findOne({ where: { tenantId, productId, locale } });
        if (!content) throw new BadRequestException(`内容不存在：product=${productId} locale=${locale}（需先 upsert content）`);
        const target = resolveTransition(action, content.status);
        if (!target) {
          throw new BadRequestException(`非法流转：动作「${action}」不可从状态「${content.status}」执行`);
        }
        const from = content.status;
        const now = new Date();
        content.status = target;
        if (action === 'submit') content.submittedAt = now;
        if (action === 'approve') { content.reviewedBy = opts.actor ?? null; content.reviewedAt = now; content.publishedAt = now; content.scheduledAt = null; }
        if (action === 'reject') { content.reviewedBy = opts.actor ?? null; content.reviewedAt = now; }
        if (action === 'schedule') {
          const when = opts.scheduledAt ? new Date(String(opts.scheduledAt)) : null;
          if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
            throw new BadRequestException('schedule 需要未来时刻 scheduledAt（ISO 字符串）');
          }
          content.scheduledAt = when;
        }
        if (action === 'unpublish') { content.publishedAt = null; content.scheduledAt = null; }
        const saved = await repo.save(content);
        await manager.getRepository(ProductContentEventEntity).save(
          manager.getRepository(ProductContentEventEntity).create({
            tenantId, contentId: saved.id, fromStatus: from, toStatus: target,
            action, actor: opts.actor ?? null, note: opts.note ?? null,
          }),
        );
        return { success: true, data: saved };
      },
      { tenantId } as TenantScope,
    );
  }

  /**
   * 定时发布结算：把到期（scheduledAt<=now）的 scheduled 内容提升为 published。
   * 供平台 cron/端点按租户调用；写审计行。返回提升条数。
   */
  async publishDueContent(tenantIdInput: string, actor = 'system-scheduler') {
    const tenantId = this.requireWriteTenant(tenantIdInput);
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const repo = manager.getRepository(ProductContentEntity);
        const due = await repo
          .createQueryBuilder('c')
          .where('c.tenant_id = :tenantId', { tenantId })
          .andWhere("c.status = 'scheduled'")
          .andWhere('c.scheduled_at IS NOT NULL AND c.scheduled_at <= now()')
          .getMany();
        const events = manager.getRepository(ProductContentEventEntity);
        for (const c of due) {
          const from = c.status;
          c.status = 'published';
          c.publishedAt = c.scheduledAt ?? new Date();
          await repo.save(c);
          await events.save(events.create({
            tenantId, contentId: c.id, fromStatus: from, toStatus: 'published',
            action: 'publish-due', actor, note: null,
          }));
        }
        return { success: true, data: { promoted: due.length } };
      },
      { tenantId } as TenantScope,
    );
  }

  // ── 产品关系（P1）· 配件/兼容/替代/交叉·向上销售/对比 ──────────────────────
  /** 单条关系 upsert（同一 RLS 事务内复用，供正/反向边共用）。 */
  private async upsertRelationRow(
    manager: import('typeorm').EntityManager,
    tenantId: string, productId: string, relatedProductId: string, relationType: string, sortOrder: number,
  ): Promise<ProductRelationEntity> {
    const repo = manager.getRepository(ProductRelationEntity);
    const existing = await repo.findOne({ where: { tenantId, productId, relatedProductId, relationType } });
    return repo.save(repo.create({ ...(existing ?? {}), tenantId, productId, relatedProductId, relationType, sortOrder }));
  }

  /**
   * 写入产品关系（受写闸 + RLS）；relation_type 白名单校验；两端不得相同。
   * A3 双向图：若该类型有干净反向语义（inverseRelationType），同事务自动 upsert 反向边
   * 「related →inverse→ product」，保证后台两端可见、公开对比/关联不缺半边；
   * 无反向语义的类型（accessory/up_sell）保持单向。
   */
  async upsertRelation(productId: string, dto: Record<string, unknown>) {
    validateRelationInput(dto); // B1 类型边界：relatedProductId/relationType 必填字符串、sortOrder 必数字
    const tenantId = this.requireWriteTenant(dto.tenantId as string | undefined);
    const relatedProductId = String(dto.relatedProductId || '');
    const relationType = String(dto.relationType || '');
    if (!relatedProductId) throw new BadRequestException('relatedProductId 必填');
    if (relatedProductId === productId) throw new BadRequestException('产品不能与自身建立关系');
    if (!isValidRelationType(relationType)) throw new BadRequestException(`非法 relationType：${relationType}`);
    const sortOrder = Number(dto.sortOrder) || 0;
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const saved = await this.upsertRelationRow(manager, tenantId, productId, relatedProductId, relationType, sortOrder);
        const inverse = inverseRelationType(relationType);
        let reverse: ProductRelationEntity | null = null;
        if (inverse) {
          reverse = await this.upsertRelationRow(manager, tenantId, relatedProductId, productId, inverse, sortOrder);
        }
        return { success: true, data: saved, reverse: reverse ? { id: reverse.id, relationType: reverse.relationType } : null };
      },
      { tenantId } as TenantScope,
    );
  }

  /** 列某产品的全部关系（受租户作用域）。 */
  async listRelations(productId: string, tenantId: string) {
    const rows = await withRlsTransaction(
      this.ds,
      (manager) => manager.getRepository(ProductRelationEntity).find({
        where: { tenantId, productId },
        order: { relationType: 'ASC', sortOrder: 'ASC' },
      }),
      { tenantId } as TenantScope,
    );
    return { success: true, data: { items: rows, total: rows.length } };
  }

  /**
   * 删除一条产品关系（受写闸 + RLS）。A3 双向图：若该类型有反向语义，
   * 同事务连带删除自动生成的反向边，避免删单边后残留半条孤立关系。
   */
  async deleteRelation(relationId: string, tenantIdInput?: string) {
    const tenantId = this.requireWriteTenant(tenantIdInput);
    return withRlsTransaction(
      this.ds,
      async (manager) => {
        const repo = manager.getRepository(ProductRelationEntity);
        const row = await repo.findOne({ where: { id: relationId, tenantId } });
        if (!row) return { success: true, data: { deleted: 0 } };
        await repo.remove(row);
        let deleted = 1;
        const inverse = inverseRelationType(row.relationType);
        if (inverse) {
          const rev = await repo.findOne({
            where: { tenantId, productId: row.relatedProductId, relatedProductId: row.productId, relationType: inverse },
          });
          if (rev) { await repo.remove(rev); deleted += 1; }
        }
        return { success: true, data: { deleted } };
      },
      { tenantId } as TenantScope,
    );
  }

  /**
   * 公开投影：某产品的关系另一端脱敏轻量卡（sku/name/brand/category + marketing.headline），
   * 按 relationType 分组。只回上架产品，无成本/无 PII。在给定 RLS 事务内查询。
   */
  private async fetchRelatedForPublic(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    productId: string,
    locale: string,
  ): Promise<Record<string, unknown[]>> {
    const rels = await manager.getRepository(ProductRelationEntity).find({
      where: { tenantId, productId },
      order: { relationType: 'ASC', sortOrder: 'ASC' },
    });
    const grouped: Record<string, unknown[]> = {};
    for (const r of rels) {
      const target = await manager.getRepository(ProductEntity).findOne({
        where: { id: r.relatedProductId, tenantId, status: 'active' } as any,
      });
      if (!target) continue;
      const content = await this.fetchContentForLocale(manager, tenantId, target.id, locale);
      const projected = this.publicProductProjection(target, locale, content) as Record<string, any>;
      const card = {
        slug: projected.slug,
        sku: target.sku,
        name: projected.name,
        brand: target.brand,
        category: target.category,
        cat: projected.cat,
        sys: projected.sys,
        series: projected.series,
        mainImage: projected.mainImage,
        image: projected.image,
        tags: projected.tags,
        summary: projected.tagline || projected.marketing?.headline || '',
        detailUrl: `/products/detail/?model=${encodeURIComponent(String(projected.slug))}`,
        headline: content?.marketing?.headline || '',
      };
      (grouped[r.relationType] ||= []).push(card);
    }
    return grouped;
  }
}
