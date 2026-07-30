import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { FileArtifactEntity } from '../file-artifact/file-artifact.entity';
import { FileArtifactService } from '../file-artifact/file-artifact.service';
import { AuditLogEntity } from '../governance/governance.entity';
import { BrandSiteEntity } from './brand-site.entity';
import { resolveBrandPublishCapability } from './brand-site-publish.service';

export interface BrandSiteInput {
  code?: string;
  nameCn?: string;
  nameEn?: string;
  appKey?: string | null;
  deliveryType?: 'self_hosted' | 'external';
  developmentUrl?: string | null;
  productionUrl?: string | null;
  logoArtifactId?: string | null;
  sortOrder?: number;
  status?: 'active' | 'inactive';
  siteNote?: string | null;
  childBrandCodes?: string[] | null;
}

const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class BrandSiteService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly files: FileArtifactService,
  ) {}

  list(user: JwtPayload, includeDeleted = false) {
    if (includeDeleted && !this.can(user, 'brand.library.read')) {
      throw new ForbiddenException('无权查看已归档品牌');
    }
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(BrandSiteEntity).createQueryBuilder('brand')
        .where('brand.tenantId = :tenantId', { tenantId: user.tenantId });
      if (!includeDeleted) qb.andWhere('brand.deletedAt IS NULL');
      const rows = await qb.orderBy('brand.sortOrder', 'ASC').addOrderBy('brand.createdAt', 'ASC').getMany();
      return { items: rows.map(row => this.toView(row)), total: rows.length };
    }, this.scope(user));
  }

  get(user: JwtPayload, id: string, includeDeleted = false) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await this.find(em, user.tenantId, id, includeDeleted);
      return this.toView(row);
    }, this.scope(user));
  }

  create(user: JwtPayload, input: BrandSiteInput) {
    const code = String(input.code || '').trim().toLowerCase();
    if (!CODE_RE.test(code)) throw new BadRequestException('品牌代码只能使用小写字母、数字和连字符');
    this.requireNames(input);
    const patch = this.normalize(input, true);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BrandSiteEntity);
      if (await repo.findOneBy({ tenantId: user.tenantId, code })) {
        throw new ConflictException('该品牌代码已存在；已归档品牌请执行恢复');
      }
      if (patch.logoArtifactId) await this.assertLogo(em, user.tenantId, patch.logoArtifactId);
      const saved = await repo.save(repo.create({
        ...patch,
        code,
        tenantId: user.tenantId,
        createdBy: user.userId,
        updatedBy: user.userId,
      }));
      await this.audit(em, user, 'brand-site.create', saved.id, null, this.snapshot(saved));
      return this.toView(saved);
    }, this.scope(user));
  }

  update(user: JwtPayload, id: string, input: BrandSiteInput) {
    if (Object.prototype.hasOwnProperty.call(input, 'code')) {
      throw new BadRequestException('品牌代码创建后不可修改');
    }
    if (input.nameCn !== undefined && !String(input.nameCn).trim()) throw new BadRequestException('品牌中文名称不能为空');
    if (input.nameEn !== undefined && !String(input.nameEn).trim()) throw new BadRequestException('品牌英文名称不能为空');
    const patch = this.normalize(input, false);
    if (!Object.keys(patch).length) throw new BadRequestException('没有可更新字段');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BrandSiteEntity);
      const row = await this.find(em, user.tenantId, id, false);
      const before = this.snapshot(row);
      if (patch.logoArtifactId) await this.assertLogo(em, user.tenantId, patch.logoArtifactId, id);
      Object.assign(row, patch, { updatedBy: user.userId });
      const saved = await repo.save(row);
      await this.audit(em, user, 'brand-site.update', id, before, this.snapshot(saved));
      return this.toView(saved);
    }, this.scope(user));
  }

  remove(user: JwtPayload, id: string) {
    if (!this.can(user, 'brand.library.delete')) {
      throw new ForbiddenException('仅平台管理员可以删除品牌官网配置');
    }
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BrandSiteEntity);
      const row = await this.find(em, user.tenantId, id, true);
      const before = this.snapshot(row);
      if (row.deletedAt) {
        await repo.delete({ id, tenantId: user.tenantId } as any);
        await this.audit(em, user, 'brand-site.delete', id, before, { deleted: true });
        return { deleted: true, id };
      }
      row.deletedAt = new Date();
      row.deletedBy = user.userId;
      row.updatedBy = user.userId;
      const saved = await repo.save(row);
      await this.audit(em, user, 'brand-site.archive', id, before, this.snapshot(saved));
      return { archived: true, id };
    }, this.scope(user));
  }

  restore(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BrandSiteEntity);
      const row = await this.find(em, user.tenantId, id, true);
      if (!row.deletedAt) throw new ConflictException('品牌未归档');
      const before = this.snapshot(row);
      row.deletedAt = null;
      row.deletedBy = null;
      row.updatedBy = user.userId;
      const saved = await repo.save(row);
      await this.audit(em, user, 'brand-site.restore', id, before, this.snapshot(saved));
      return this.toView(saved);
    }, this.scope(user));
  }

  async getLogo(user: JwtPayload, id: string) {
    const brand = await this.get(user, id);
    if (!brand.logoArtifactId) throw new NotFoundException('品牌尚未绑定 Logo');
    return this.files.getBase64ById(user, brand.logoArtifactId);
  }

  async uploadLogo(user: JwtPayload, id: string, input: {
    filename?: string; mimeType?: string; dataBase64?: string;
  }) {
    await this.get(user, id);
    const mimeType = String(input.mimeType || '').toLowerCase();
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
    if (!allowed.has(mimeType)) throw new BadRequestException('Logo 仅支持 PNG、JPEG、WebP 或 SVG');
    const dataBase64 = String(input.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    const size = Buffer.byteLength(dataBase64, 'base64');
    if (!size || size > 2 * 1024 * 1024) throw new BadRequestException('Logo 文件不能为空且不能超过 2MB');
    const uploaded = await this.files.saveBase64(user, {
      entityType: 'brand_logo',
      entityId: id,
      filename: String(input.filename || 'brand-logo'),
      mimeType,
      dataBase64,
    });
    const artifactId = uploaded.data.id;
    const brand = await this.update(user, id, { logoArtifactId: artifactId });
    return { brand, logoArtifactId: artifactId };
  }

  private normalize(input: BrandSiteInput, creating: boolean): Partial<BrandSiteEntity> {
    const patch: Partial<BrandSiteEntity> = {};
    const text = (key: keyof BrandSiteInput, target: keyof BrandSiteEntity) => {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      const value = input[key];
      (patch as Record<string, unknown>)[target] = value == null || String(value).trim() === '' ? null : String(value).trim();
    };
    text('nameCn', 'nameCn'); text('nameEn', 'nameEn'); text('appKey', 'appKey');
    text('developmentUrl', 'developmentUrl'); text('productionUrl', 'productionUrl'); text('siteNote', 'siteNote');
    if (input.developmentUrl) this.validateUrl(input.developmentUrl, false);
    if (input.productionUrl) this.validateUrl(input.productionUrl, true);
    if (input.deliveryType !== undefined) {
      if (!['self_hosted', 'external'].includes(input.deliveryType)) throw new BadRequestException('交付类型无效');
      patch.deliveryType = input.deliveryType;
    }
    if (input.status !== undefined) {
      if (!['active', 'inactive'].includes(input.status)) throw new BadRequestException('品牌状态无效');
      patch.status = input.status;
    }
    if (input.sortOrder !== undefined) {
      const order = Number(input.sortOrder);
      if (!Number.isInteger(order) || order < 0 || order > 9999) throw new BadRequestException('排序必须为 0 到 9999 的整数');
      patch.sortOrder = order;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'logoArtifactId')) patch.logoArtifactId = input.logoArtifactId || null;
    if (Object.prototype.hasOwnProperty.call(input, 'childBrandCodes')) {
      patch.childBrandCodes = this.normalizeChildBrandCodes(input.childBrandCodes);
    }
    if (creating) {
      patch.deliveryType ??= 'self_hosted';
      patch.status ??= 'active';
      patch.sortOrder ??= 0;
      patch.childBrandCodes ??= [];
    }
    return patch;
  }

  private normalizeChildBrandCodes(value: unknown): string[] {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('子品牌配置必须是数组');
    const codes = value.map((item) => normalizeBrandCodeInput(item)).filter((code) => code && code !== 'rhautt-group');
    return [...new Set(codes)];
  }

  private requireNames(input: BrandSiteInput) {
    if (!String(input.nameCn || '').trim() || !String(input.nameEn || '').trim()) {
      throw new BadRequestException('品牌中英文名称必填');
    }
  }

  private validateUrl(value: string, production: boolean) {
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestException('官网地址格式无效'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestException('官网地址只允许 http/https');
    if (production && url.protocol !== 'https:') throw new BadRequestException('生产官网必须使用 https');
  }

  private async assertLogo(em: EntityManager, tenantId: string, artifactId: string, brandId?: string) {
    const file = await em.getRepository(FileArtifactEntity).findOneBy({ id: artifactId, tenantId });
    if (!file || file.status !== 'active') throw new BadRequestException('Logo 素材不存在或已删除');
    if (file.entityType !== 'brand_logo') throw new BadRequestException('只能绑定品牌 Logo 类型素材');
    if (brandId && file.entityId !== brandId) throw new BadRequestException('Logo 素材未绑定当前品牌');
    if (!file.mimeType?.startsWith('image/')) throw new BadRequestException('Logo 素材必须是图片');
  }

  private async find(em: EntityManager, tenantId: string, id: string, includeDeleted: boolean) {
    const qb = em.getRepository(BrandSiteEntity).createQueryBuilder('brand')
      .where('brand.id = :id', { id }).andWhere('brand.tenantId = :tenantId', { tenantId });
    if (!includeDeleted) qb.andWhere('brand.deletedAt IS NULL');
    const row = await qb.getOne();
    if (!row) throw new NotFoundException('品牌不存在');
    return row;
  }

  private toView(row: BrandSiteEntity) {
    const runtime = process.env.BRAND_SITE_RUNTIME_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    const resolvedUrl = runtime === 'production'
      ? row.productionUrl
      : (row.developmentUrl || row.productionUrl);
    return {
      ...row,
      resolvedUrl,
      resolvedEnvironment: runtime,
      publishCapability: resolveBrandPublishCapability(row),
    };
  }

  private snapshot(row: BrandSiteEntity): Record<string, unknown> {
    return {
      id: row.id, tenantId: row.tenantId, code: row.code, nameCn: row.nameCn, nameEn: row.nameEn,
      appKey: row.appKey, deliveryType: row.deliveryType, developmentUrl: row.developmentUrl,
      productionUrl: row.productionUrl, logoArtifactId: row.logoArtifactId, sortOrder: row.sortOrder,
      status: row.status, siteNote: row.siteNote, childBrandCodes: row.childBrandCodes || [], deletedAt: row.deletedAt,
    };
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private can(user: JwtPayload, permission: string) {
    if (user.role === 'platform_admin' || user.role === 'hq_admin') return true;
    const permissions = new Set(user.permissions ?? []);
    return permissions.has('*') || permissions.has(permission);
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
      resourceType: 'brand-site',
      resourceId: id,
      beforeState: before,
      afterState: after,
      requestId: null, traceId: null, ipHash: null,
    }));
  }
}

function normalizeBrandCodeInput(value: unknown): string {
  const code = String(value || '').trim().toLowerCase();
  if (!code) return '';
  if (!CODE_RE.test(code)) throw new BadRequestException('子品牌代码只能使用小写字母、数字和连字符');
  return code;
}
