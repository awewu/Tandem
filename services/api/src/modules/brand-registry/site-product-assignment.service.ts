import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { ProductCatalogService } from '../product-catalog/product-catalog.service';
import { BrandSiteEntity, SiteProductAssignmentEntity } from './brand-site.entity';

const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_SITE_CODE = 'rhautt-group';
const PRODUCT_IMAGE_PLACEHOLDER = {
  role: 'placeholder',
  url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"%3E%3Crect width="640" height="360" fill="%23f4f6f8"/%3E%3Cpath d="M238 212h164l-50-62-42 46-28-30-44 46Z" fill="%23ccd3da"/%3E%3Ccircle cx="250" cy="135" r="18" fill="%23ccd3da"/%3E%3C/svg%3E',
};

export interface SiteProductAssignmentInput {
  productId?: string;
  productTenantId?: string;
  publicSlug?: string;
  websiteCategory?: string | null;
  menuGroup?: string | null;
  displayOrder?: number;
  isFeatured?: boolean;
  siteTitle?: string | null;
  siteSummary?: string | null;
  siteMeta?: Record<string, unknown>;
}

export interface SiteProductAssignmentBatchItem extends SiteProductAssignmentInput {
  assignmentId?: string;
  sku?: string;
}

export interface SiteProductAssignmentBatchInput {
  items?: SiteProductAssignmentBatchItem[];
}

export function normalizeSiteCode(value: unknown): string {
  const code = String(value || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) throw new BadRequestException('网站代码格式无效');
  return code;
}

export function normalizePublicSlug(value: unknown): string {
  const slug = String(value || '').trim().toLowerCase();
  if (!CODE_RE.test(slug)) throw new BadRequestException('公开 slug 只能使用小写字母、数字和连字符');
  return slug;
}

export function resolvePublicSiteTenant(siteCode: string): string | undefined {
  const key = normalizeSiteCode(siteCode).toUpperCase().replace(/-/g, '_');
  return process.env[`SITE_${key}_TENANT_ID`] || process.env[`${key}_TENANT_ID`];
}

export function assertSiteProductBrandAllowed(
  siteCodeInput: unknown,
  productBrandInput: unknown,
  supportedBrandInputs: readonly string[] = ['rheem', 'ruud', 'everhot'],
) {
  const siteCode = normalizeSiteCode(siteCodeInput);
  const productBrand = String(productBrandInput || '').trim().toLowerCase();
  const supportedBrands = supportedBrandInputs.map(normalizeSiteCode);
  if (!isSiteProductBrandAllowed(siteCode, productBrand, supportedBrands)) {
    throw new BadRequestException(`Invalid site/product brand combination: ${siteCode} site only accepts ${siteCode} products`);
  }
  if (siteCode === GROUP_SITE_CODE && !supportedBrands.includes(productBrand)) {
    const label = supportedBrands.length ? supportedBrands.join(', ') : 'configured child-brand';
    throw new BadRequestException(`Invalid site/product brand combination: ${GROUP_SITE_CODE} only accepts ${label} products`);
  }
}

function isSiteProductBrandAllowed(
  siteCode: string,
  productBrand: string,
  supportedBrands: readonly string[] = ['rheem', 'ruud', 'everhot'],
) {
  return siteCode === GROUP_SITE_CODE || !supportedBrands.includes(siteCode) || productBrand === siteCode;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveInteger(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Website shelf batch operation failed';
}

const PUBLIC_SITE_PRODUCT_FIELDS = [
  'brand', 'category', 'slug', 'sku', 'displayOrder', 'model', 'name',
  'categoryLevel1Id', 'categoryLevel2Id', 'categoryLevel3Id', 'categoryPath',
  'websiteCategory', 'cat', 'sys', 'series', 'tagline', 'tags', 'badges',
  'en', 'icon', 'image', 'mainImage', 'gallery', 'specImage', 'specs',
  'features', 'highlights', 'certs', 'faqs', 'locale', 'positioning',
  'marketing', 'seo', 'jsonLd', 'officialDetailHtml', 'manualPdfs',
] as const;

function publicProductFields(product: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    PUBLIC_SITE_PRODUCT_FIELDS
      .filter((field) => product[field] !== undefined)
      .map((field) => [field, product[field]]),
  );
}

export function projectSiteProductDisplay(
  siteCode: string,
  assignment: Partial<SiteProductAssignmentEntity>,
  product: Record<string, unknown>,
) {
  const safeProduct = publicProductFields(product);
  const mainImage = record(safeProduct.mainImage);
  const mainImageUrl = text(mainImage.url);
  const brandMetaImage = text(safeProduct.image);
  const resolvedMainImage = mainImageUrl
    ? { ...mainImage, url: mainImageUrl }
    : brandMetaImage
      ? { role: 'main', url: brandMetaImage }
      : PRODUCT_IMAGE_PLACEHOLDER;
  const websiteCategory = text(safeProduct.categoryPath)
    || text(assignment.websiteCategory)
    || text(safeProduct.websiteCategory)
    || text(safeProduct.cat)
    || text(safeProduct.category);
  const displayOrder = positiveInteger(assignment.displayOrder)
    ?? positiveInteger(safeProduct.displayOrder)
    ?? 0;

  return {
    ...safeProduct,
    siteCode,
    slug: text(assignment.publicSlug) || text(safeProduct.slug) || text(safeProduct.sku),
    name: text(assignment.siteTitle) || text(safeProduct.name),
    summary: text(assignment.siteSummary) || text(safeProduct.tagline) || text(safeProduct.category),
    websiteCategory,
    menuGroup: text(assignment.menuGroup) || text(safeProduct.sys),
    displayOrder,
    image: mainImageUrl || brandMetaImage || PRODUCT_IMAGE_PLACEHOLDER.url,
    mainImage: resolvedMainImage,
    isFeatured: Boolean(assignment.isFeatured),
    siteMeta: record(assignment.siteMeta),
  };
}

@Injectable()
export class SiteProductAssignmentService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly products: ProductCatalogService,
  ) {}

  list(user: JwtPayload, siteCode: string, includeArchived = false) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const items = await em.getRepository(SiteProductAssignmentEntity).find({
        where: includeArchived
          ? { tenantId: user.tenantId, siteId: site.id } as any
          : { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      return { items, total: items.length };
    }, this.scope(user));
  }

  async batchPublish(user: JwtPayload, siteCode: string, input: SiteProductAssignmentBatchInput) {
    const items = Array.isArray(input.items) ? input.items : [];
    const success: Array<{ productId: string; assignmentId: string; sku?: string }> = [];
    const failed: Array<{ productId?: string; assignmentId?: string; sku?: string; error: string }> = [];
    for (const item of items) {
      const productId = text(item.productId);
      const sku = text(item.sku);
      try {
        let assignmentId = text(item.assignmentId);
        if (!assignmentId) {
          const created = await this.create(user, siteCode, item);
          assignmentId = created.id;
        }
        await this.setStatus(user, siteCode, assignmentId, 'published');
        success.push({ productId, assignmentId, sku });
      } catch (error) {
        failed.push({
          productId,
          assignmentId: text(item.assignmentId),
          sku,
          error: errorMessage(error),
        });
      }
    }
    return { success, failed, total: items.length, successCount: success.length, failureCount: failed.length };
  }

  async batchHide(user: JwtPayload, siteCode: string, input: SiteProductAssignmentBatchInput) {
    const items = Array.isArray(input.items) ? input.items : [];
    const success: Array<{ productId?: string; assignmentId?: string; sku?: string; skipped?: boolean }> = [];
    const failed: Array<{ productId?: string; assignmentId?: string; sku?: string; error: string }> = [];
    for (const item of items) {
      const productId = text(item.productId);
      const assignmentId = text(item.assignmentId);
      const sku = text(item.sku);
      if (!assignmentId) {
        success.push({ productId, sku, skipped: true });
        continue;
      }
      try {
        await this.setStatus(user, siteCode, assignmentId, 'hidden');
        success.push({ productId, assignmentId, sku });
      } catch (error) {
        failed.push({ productId, assignmentId, sku, error: errorMessage(error) });
      }
    }
    return { success, failed, total: items.length, successCount: success.length, failureCount: failed.length };
  }

  async create(user: JwtPayload, siteCode: string, input: SiteProductAssignmentInput) {
    const productId = String(input.productId || '').trim();
    const productTenantId = String(input.productTenantId || user.tenantId).trim();
    if (!UUID_RE.test(productId) || !UUID_RE.test(productTenantId)) {
      throw new BadRequestException('产品和产品租户必须使用 UUID');
    }
    this.assertProductTenantAccess(user, productTenantId);
    const publicSlug = normalizePublicSlug(input.publicSlug);
    const product = await this.findActiveProduct(productTenantId, productId);
    if (!product) throw new NotFoundException('Product does not exist or is not active');
    const productBrand = text(product.brand);
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      assertSiteProductBrandAllowed(site.code, productBrand, await this.assignmentBrandCodes(em, user.tenantId, site));
      const repo = em.getRepository(SiteProductAssignmentEntity);
      const existing = await repo.createQueryBuilder('assignment')
        .where('assignment.tenantId = :tenantId', { tenantId: user.tenantId })
        .andWhere('assignment.siteId = :siteId', { siteId: site.id })
        .andWhere('assignment.deletedAt IS NULL')
        .andWhere('(assignment.productId = :productId OR lower(assignment.publicSlug) = :publicSlug)', { productId, publicSlug })
        .getOne();
      if (existing) throw new ConflictException('该产品或公开 slug 已经分配到当前网站');
      const saved = await repo.save(repo.create({
        tenantId: user.tenantId,
        siteId: site.id,
        productTenantId,
        productId,
        brand: productBrand,
        publicSlug,
        ...this.assignmentPatch(input),
        status: 'draft',
        publishedAt: null,
        createdBy: user.userId,
        updatedBy: user.userId,
      } as Partial<SiteProductAssignmentEntity>));
      await this.audit(em, user, 'site-product-assignment.create', saved.id, null, { ...saved });
      return saved;
    }, this.scope(user));
  }

  update(user: JwtPayload, siteCode: string, id: string, input: SiteProductAssignmentInput) {
    if (input.productId !== undefined || input.productTenantId !== undefined) {
      throw new BadRequestException('产品关联创建后不可修改；请归档后重新分配');
    }
    const patch = this.assignmentPatch(input);
    if (input.publicSlug !== undefined) patch.publicSlug = normalizePublicSlug(input.publicSlug);
    if (!Object.keys(patch).length) throw new BadRequestException('没有可更新字段');
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.findAssignment(em, user.tenantId, siteCode, id);
      const before = { ...row };
      Object.assign(row, patch, { updatedBy: user.userId });
      const saved = await em.getRepository(SiteProductAssignmentEntity).save(row);
      await this.audit(em, user, 'site-product-assignment.update', id, before, { ...saved });
      return saved;
    }, this.scope(user));
  }

  setStatus(user: JwtPayload, siteCode: string, id: string, status: 'published' | 'hidden') {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.findAssignment(em, user.tenantId, siteCode, id);
      if (status === 'published') {
        const product = await this.findActiveProduct(row.productTenantId, row.productId);
        if (!product) throw new NotFoundException('Product does not exist or is not active');
        const site = await this.findSite(em, user.tenantId, siteCode);
        assertSiteProductBrandAllowed(site.code, product.brand, await this.assignmentBrandCodes(em, user.tenantId, site));
      }
      const before = { ...row };
      row.status = status;
      row.publishedAt = status === 'published' ? (row.publishedAt || new Date()) : null;
      row.updatedBy = user.userId;
      const saved = await em.getRepository(SiteProductAssignmentEntity).save(row);
      await this.audit(em, user, `site-product-assignment.${status}`, id, before, { ...saved });
      return saved;
    }, this.scope(user));
  }

  archive(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.findAssignment(em, user.tenantId, siteCode, id);
      const before = { ...row };
      row.deletedAt = new Date();
      row.deletedBy = user.userId;
      row.updatedBy = user.userId;
      await em.getRepository(SiteProductAssignmentEntity).save(row);
      await this.audit(em, user, 'site-product-assignment.archive', id, before, { ...row });
      return { archived: true, id };
    }, this.scope(user));
  }

  async publicList(siteCodeInput: string, locale?: string, filters: Record<string, unknown> = {}) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const assignments = await withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      return em.getRepository(SiteProductAssignmentEntity).find({
        where: { tenantId, siteId: site.id, status: 'published', deletedAt: null } as any,
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
        take: 500,
      });
    }, { tenantId });
    const items = await this.hydrate(siteCode, assignments, locale);
    const filtered = items.filter((item) => this.matches(item, filters));
    return { success: true, data: { items: filtered, total: filtered.length, locale: String(locale || 'zh-CN') } };
  }

  async publicDetail(siteCodeInput: string, publicSlugInput: string, locale?: string) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const publicSlug = normalizePublicSlug(publicSlugInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const assignments = await withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      return em.getRepository(SiteProductAssignmentEntity).createQueryBuilder('assignment')
        .where('assignment.tenantId = :tenantId', { tenantId })
        .andWhere('assignment.siteId = :siteId', { siteId: site.id })
        .andWhere('assignment.status = :status', { status: 'published' })
        .andWhere('assignment.deletedAt IS NULL')
        .orderBy('assignment.displayOrder', 'ASC')
        .addOrderBy('assignment.createdAt', 'ASC')
        .take(500)
        .getMany();
    }, { tenantId });
    const assignment = assignments[0];
    if (!assignment) throw new NotFoundException('产品不存在');
    const items = await this.hydrate(siteCode, assignments, locale);
    const item = items.find((row) => String(row.slug || '').toLowerCase() === publicSlug);
    if (!item) throw new NotFoundException('产品不存在或已归档');
    return { success: true, data: item };
  }

  private async hydrate(siteCode: string, assignments: SiteProductAssignmentEntity[], locale?: string) {
    const groups = new Map<string, SiteProductAssignmentEntity[]>();
    for (const row of assignments) groups.set(row.productTenantId, [...(groups.get(row.productTenantId) || []), row]);
    const hydrated = new Map<string, Record<string, unknown>>();
    await Promise.all([...groups.entries()].map(async ([tenantId, rows]) => {
      const products = await this.products.listPublicLocalizedByIds(rows.map((row) => row.productId), locale, tenantId);
      for (const product of products) hydrated.set(String(product.productId), product);
    }));
    return assignments.flatMap((assignment) => {
      const product = hydrated.get(assignment.productId);
      if (!product) return [];
      if (!isSiteProductBrandAllowed(siteCode, text(product.brand))) return [];
      const { productId: _productId, ...publicProduct } = product;
      return [projectSiteProductDisplay(siteCode, assignment, publicProduct)];
    });
  }

  private matches(item: Record<string, unknown>, filters: Record<string, unknown>) {
    if (filters.brand && item.brand !== String(filters.brand)) return false;
    if (filters.category && item.category !== String(filters.category)) return false;
    if (filters.websiteCategory && item.websiteCategory !== String(filters.websiteCategory)) return false;
    if (filters.featured === 'true' && item.isFeatured !== true) return false;
    const keyword = String(filters.keyword || '').trim().toLowerCase();
    if (!keyword) return true;
    return [item.sku, item.name, item.slug, item.summary].some((value) => String(value || '').toLowerCase().includes(keyword));
  }

  private assignmentPatch(input: SiteProductAssignmentInput): Partial<SiteProductAssignmentEntity> {
    const patch: Partial<SiteProductAssignmentEntity> = {};
    const text = (key: 'websiteCategory' | 'menuGroup' | 'siteTitle' | 'siteSummary') => {
      if (input[key] === undefined) return;
      patch[key] = input[key] == null || !String(input[key]).trim() ? null : String(input[key]).trim();
    };
    text('websiteCategory'); text('menuGroup'); text('siteTitle'); text('siteSummary');
    if (input.displayOrder !== undefined) {
      const order = Number(input.displayOrder);
      if (!Number.isInteger(order) || order < 0 || order > 999999) throw new BadRequestException('排序必须是非负整数');
      patch.displayOrder = order;
    }
    if (input.isFeatured !== undefined) patch.isFeatured = Boolean(input.isFeatured);
    if (input.siteMeta !== undefined) patch.siteMeta = input.siteMeta && typeof input.siteMeta === 'object' ? input.siteMeta : {};
    return patch;
  }

  private assertProductTenantAccess(user: JwtPayload, productTenantId: string) {
    if (!['platform_admin', 'hq_admin'].includes(user.role) && productTenantId !== user.tenantId) {
      throw new ForbiddenException('品牌账号不可分配其他品牌租户的产品');
    }
  }

  private async findActiveProduct(productTenantId: string, productId: string) {
    const result = await this.products.get(productId, productTenantId);
    const product = result.data;
    return product.status === 'active' ? product : null;
  }

  private async findSite(em: EntityManager, tenantId: string, siteCode: string) {
    const site = await em.getRepository(BrandSiteEntity).findOneBy({
      tenantId, code: normalizeSiteCode(siteCode), status: 'active', deletedAt: null,
    } as any);
    if (!site) throw new NotFoundException('网站不存在或未启用');
    return site;
  }

  private async assignmentBrandCodes(em: EntityManager, tenantId: string, site?: BrandSiteEntity): Promise<string[]> {
    if (site?.code === GROUP_SITE_CODE) {
      return (site.childBrandCodes || []).map(normalizeSiteCode);
    }
    const rows = await em.getRepository(BrandSiteEntity).find({
      where: { tenantId, status: 'active', deletedAt: null } as any,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      take: 500,
    });
    return rows
      .map((row) => normalizeSiteCode(row.code))
      .filter((code) => code !== GROUP_SITE_CODE);
  }

  private async findAssignment(em: EntityManager, tenantId: string, siteCode: string, id: string) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteProductAssignmentEntity).findOneBy({
      id, tenantId, siteId: site.id, deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('网站产品分配不存在');
    return row;
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private async audit(
    em: EntityManager, user: JwtPayload, action: string, id: string,
    before: Record<string, unknown> | null, after: Record<string, unknown>,
  ) {
    const repo = em.getRepository(AuditLogEntity);
    await repo.save(repo.create({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action,
      resourceType: 'site-product-assignment',
      resourceId: id,
      beforeState: before,
      afterState: after,
      requestId: null, traceId: null, ipHash: null,
    }));
  }
}
