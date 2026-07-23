import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { ProductEntity } from '../product-catalog/product-catalog.entity';
import { ProductCatalogService } from '../product-catalog/product-catalog.service';
import { BrandSiteEntity, SiteProductAssignmentEntity } from './brand-site.entity';

const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

@Injectable()
export class SiteProductAssignmentService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly products: ProductCatalogService,
  ) {}

  list(user: JwtPayload, siteCode: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const items = await em.getRepository(SiteProductAssignmentEntity).find({
        where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      return { items, total: items.length };
    }, this.scope(user));
  }

  create(user: JwtPayload, siteCode: string, input: SiteProductAssignmentInput) {
    const productId = String(input.productId || '').trim();
    const productTenantId = String(input.productTenantId || user.tenantId).trim();
    if (!UUID_RE.test(productId) || !UUID_RE.test(productTenantId)) {
      throw new BadRequestException('产品和产品租户必须使用 UUID');
    }
    this.assertProductTenantAccess(user, productTenantId);
    const publicSlug = normalizePublicSlug(input.publicSlug);
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const product = await em.getRepository(ProductEntity).findOneBy({
        id: productId, tenantId: productTenantId, status: 'active',
      } as any);
      if (!product) throw new NotFoundException('产品不存在或已归档');
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
        brand: product.brand,
        publicSlug,
        ...this.assignmentPatch(input),
        status: 'draft',
        publishedAt: null,
        createdBy: user.userId,
        updatedBy: user.userId,
      }));
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
    const assignment = await withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      return em.getRepository(SiteProductAssignmentEntity).createQueryBuilder('assignment')
        .where('assignment.tenantId = :tenantId', { tenantId })
        .andWhere('assignment.siteId = :siteId', { siteId: site.id })
        .andWhere('assignment.status = :status', { status: 'published' })
        .andWhere('assignment.deletedAt IS NULL')
        .andWhere('lower(assignment.publicSlug) = :publicSlug', { publicSlug })
        .getOne();
    }, { tenantId });
    if (!assignment) throw new NotFoundException('产品不存在');
    const [item] = await this.hydrate(siteCode, [assignment], locale);
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
      const { productId: _productId, ...publicProduct } = product;
      return [{
        ...publicProduct,
        siteCode,
        slug: assignment.publicSlug,
        name: assignment.siteTitle || publicProduct.name,
        summary: assignment.siteSummary || publicProduct.tagline || '',
        websiteCategory: assignment.websiteCategory,
        menuGroup: assignment.menuGroup,
        displayOrder: assignment.displayOrder,
        isFeatured: assignment.isFeatured,
        siteMeta: assignment.siteMeta,
      }];
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

  private async findSite(em: EntityManager, tenantId: string, siteCode: string) {
    const site = await em.getRepository(BrandSiteEntity).findOneBy({
      tenantId, code: normalizeSiteCode(siteCode), status: 'active', deletedAt: null,
    } as any);
    if (!site) throw new NotFoundException('网站不存在或未启用');
    return site;
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
