import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { FileArtifactService } from '../file-artifact/file-artifact.service';
import { AuditLogEntity } from '../governance/governance.entity';
import { BrandSiteEntity, SiteNewsArticleEntity } from './brand-site.entity';
import { normalizePublicSlug, normalizeSiteCode, resolvePublicSiteTenant } from './site-product-assignment.service';

type NewsStatus = 'draft' | 'published' | 'hidden' | 'archived';

export interface SiteNewsArticleInput {
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  coverImageArtifactId?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: string | Date | null;
  status?: NewsStatus;
  sortOrder?: number;
  isFeatured?: boolean;
  siteMeta?: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_VALUES = new Set<NewsStatus>(['draft', 'published', 'hidden', 'archived']);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function articleImageUrl(article: SiteNewsArticleEntity, siteCode: string): string {
  if (article.coverImageArtifactId) {
    return `/api/v2/sites/${encodeURIComponent(siteCode)}/news/${encodeURIComponent(article.id)}/cover`;
  }
  if (article.coverImageUrl) return article.coverImageUrl;
  return '';
}

function publicArticle(article: SiteNewsArticleEntity, siteCode: string) {
  return {
    id: article.id,
    siteCode,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    body: article.body,
    date: article.publishedAt ? article.publishedAt.toISOString().slice(0, 7) : '',
    publishedAt: article.publishedAt,
    image: articleImageUrl(article, siteCode),
    coverImageUrl: articleImageUrl(article, siteCode),
    sortOrder: article.sortOrder,
    isFeatured: article.isFeatured,
  };
}

@Injectable()
export class SiteNewsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly files: FileArtifactService,
  ) {}

  list(user: JwtPayload, siteCode: string, query: Record<string, unknown> = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const qb = em.getRepository(SiteNewsArticleEntity).createQueryBuilder('article')
        .where('article.tenantId = :tenantId', { tenantId: user.tenantId })
        .andWhere('article.siteId = :siteId', { siteId: site.id });
      if (query.includeArchived !== 'true') qb.andWhere('article.deletedAt IS NULL');
      const status = text(query.status);
      if (status && status !== 'all') qb.andWhere('article.status = :status', { status });
      const keyword = text(query.q || query.keyword).toLowerCase();
      if (keyword) {
        qb.andWhere('(lower(article.title) LIKE :keyword OR lower(article.summary) LIKE :keyword)', {
          keyword: `%${keyword}%`,
        });
      }
      qb.orderBy('article.sortOrder', 'ASC').addOrderBy('article.publishedAt', 'DESC').addOrderBy('article.createdAt', 'DESC');
      const page = Math.max(Number(query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
      const [items, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
      return { items, total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
    }, this.scope(user));
  }

  get(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(this.ds, async (em) => this.findArticle(em, user.tenantId, siteCode, id), this.scope(user));
  }

  create(user: JwtPayload, siteCode: string, input: SiteNewsArticleInput) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const repo = em.getRepository(SiteNewsArticleEntity);
      const patch = this.articlePatch(input, true);
      this.assertPublishable({ ...patch });
      const saved = await repo.save(repo.create({
        tenantId: user.tenantId,
        siteId: site.id,
        ...patch,
        status: patch.status || 'draft',
        createdBy: user.userId,
        updatedBy: user.userId,
      }));
      await this.audit(em, user, 'site-news.create', saved.id, null, { ...saved });
      return saved;
    }, this.scope(user));
  }

  update(user: JwtPayload, siteCode: string, id: string, input: SiteNewsArticleInput) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.findArticle(em, user.tenantId, siteCode, id);
      const before = { ...row };
      Object.assign(row, this.articlePatch(input, false), { updatedBy: user.userId });
      this.assertPublishable(row);
      const saved = await em.getRepository(SiteNewsArticleEntity).save(row);
      await this.audit(em, user, 'site-news.update', saved.id, before, { ...saved });
      return saved;
    }, this.scope(user));
  }

  setStatus(user: JwtPayload, siteCode: string, id: string, status: Extract<NewsStatus, 'published' | 'hidden'>) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.findArticle(em, user.tenantId, siteCode, id);
      if (status === 'published') this.assertPublishable(row);
      const before = { ...row };
      row.status = status;
      row.publishedAt = status === 'published' ? row.publishedAt || new Date() : row.publishedAt;
      row.updatedBy = user.userId;
      const saved = await em.getRepository(SiteNewsArticleEntity).save(row);
      await this.audit(em, user, `site-news.${status}`, saved.id, before, { ...saved });
      return saved;
    }, this.scope(user));
  }

  archive(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.findArticle(em, user.tenantId, siteCode, id);
      const before = { ...row };
      row.status = 'archived';
      row.deletedAt = new Date();
      row.deletedBy = user.userId;
      row.updatedBy = user.userId;
      await em.getRepository(SiteNewsArticleEntity).save(row);
      await this.audit(em, user, 'site-news.archive', row.id, before, { ...row });
      return { ok: true, id };
    }, this.scope(user));
  }

  publicList(siteCodeInput: string, query: Record<string, unknown> = {}) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      const limit = Math.min(Math.max(Number(query.limit || query.pageSize) || 20, 1), 100);
      const items = await em.getRepository(SiteNewsArticleEntity).find({
        where: { tenantId, siteId: site.id, status: 'published', deletedAt: null } as any,
        order: { sortOrder: 'ASC', publishedAt: 'DESC', createdAt: 'DESC' },
        take: limit,
      });
      return { success: true, data: { items: items.map((article) => publicArticle(article, siteCode)), total: items.length } };
    }, { tenantId });
  }

  async publicCover(siteCodeInput: string, articleId: string) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const artifactId = await withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      const article = await em.getRepository(SiteNewsArticleEntity).findOne({
        where: { id: articleId, tenantId, siteId: site.id, status: 'published', deletedAt: null } as any,
      });
      if (!article?.coverImageArtifactId) throw new NotFoundException('资讯封面不存在');
      return article.coverImageArtifactId;
    }, { tenantId });
    const artifact = await this.files.getPublicActiveArtifact(tenantId, artifactId);
    if (!artifact) throw new NotFoundException('资讯封面不存在');
    return artifact;
  }

  private articlePatch(input: SiteNewsArticleInput, creating: boolean): Partial<SiteNewsArticleEntity> {
    const patch: Partial<SiteNewsArticleEntity> = {};
    if (creating || input.slug !== undefined) patch.slug = normalizePublicSlug(input.slug);
    if (creating || input.title !== undefined) {
      const title = text(input.title);
      if (!title) throw new BadRequestException('资讯标题不能为空');
      patch.title = title;
    }
    if (creating || input.summary !== undefined) {
      const summary = text(input.summary);
      if (!summary) throw new BadRequestException('资讯摘要不能为空');
      patch.summary = summary;
    }
    if (input.body !== undefined) patch.body = text(input.body);
    if (input.coverImageArtifactId !== undefined) {
      const id = text(input.coverImageArtifactId);
      patch.coverImageArtifactId = id || null;
    }
    if (input.coverImageUrl !== undefined) patch.coverImageUrl = text(input.coverImageUrl) || null;
    if (input.publishedAt !== undefined) {
      patch.publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
      if (patch.publishedAt && Number.isNaN(patch.publishedAt.getTime())) throw new BadRequestException('发布日期无效');
    } else if (creating) {
      patch.publishedAt = null;
    }
    if (input.status !== undefined) {
      if (!STATUS_VALUES.has(input.status)) throw new BadRequestException('资讯状态无效');
      patch.status = input.status;
    }
    if (input.sortOrder !== undefined) {
      const order = Number(input.sortOrder);
      if (!Number.isInteger(order) || order < 0 || order > 999999) throw new BadRequestException('排序必须是非负整数');
      patch.sortOrder = order;
    }
    if (input.isFeatured !== undefined) patch.isFeatured = Boolean(input.isFeatured);
    if (input.siteMeta !== undefined) patch.siteMeta = input.siteMeta && typeof input.siteMeta === 'object' ? input.siteMeta : {};
    return patch;
  }

  private assertPublishable(article: Partial<SiteNewsArticleEntity>) {
    if (article.status !== 'published') return;
    if (!article.coverImageArtifactId && !article.coverImageUrl) {
      throw new BadRequestException('发布资讯前请先上传封面');
    }
  }

  private async findSite(em: EntityManager, tenantId: string, siteCode: string) {
    const site = await em.getRepository(BrandSiteEntity).findOneBy({
      tenantId, code: normalizeSiteCode(siteCode), status: 'active', deletedAt: null,
    } as any);
    if (!site) throw new NotFoundException('网站不存在或未启用');
    return site;
  }

  private async findArticle(em: EntityManager, tenantId: string, siteCode: string, id: string) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteNewsArticleEntity).findOneBy({
      id, tenantId, siteId: site.id, deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('资讯不存在或已归档');
    return row;
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private async audit(
    em: EntityManager, user: JwtPayload, action: string, id: string,
    before: Record<string, unknown> | null, after: Record<string, unknown>,
  ) {
    await em.getRepository(AuditLogEntity).save(em.getRepository(AuditLogEntity).create({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action,
      resourceType: 'site-news',
      resourceId: id,
      beforeState: before,
      afterState: after,
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
  }
}
