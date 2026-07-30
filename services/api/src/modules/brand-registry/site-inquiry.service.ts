import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { BrandSiteEntity, SiteInquiryEntity } from './brand-site.entity';
import { normalizeSiteCode, resolvePublicSiteTenant } from './site-product-assignment.service';

type InquiryKind = 'customer' | 'dealer';

export interface PublicSiteInquiryInput {
  name?: string;
  phone?: string;
  city?: string;
  inquiryType?: string;
  message?: string;
  companyName?: string;
  intendedRegion?: string;
  businessSummary?: string;
  sourcePath?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set<InquiryKind>(['customer', 'dealer']);

function text(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

function longText(value: unknown, max = 5000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function dateBoundary(value: unknown, endOfDay = false): Date | null {
  const raw = text(value, 40);
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+08:00`
    : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function publicRow(row: SiteInquiryEntity) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name || '',
    phone: row.phone || '',
    city: row.city || '',
    inquiryType: row.inquiryType || '',
    message: row.message || '',
    companyName: row.companyName || '',
    intendedRegion: row.intendedRegion || '',
    businessSummary: row.businessSummary || '',
    sourcePath: row.sourcePath || '',
    submittedAt: row.createdAt,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class SiteInquiryService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  list(user: JwtPayload, siteCodeInput: string, query: Record<string, unknown> = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCodeInput);
      const kind = this.kind(query.kind || 'customer');
      const qb = em.getRepository(SiteInquiryEntity).createQueryBuilder('inquiry')
        .where('inquiry.tenantId = :tenantId', { tenantId: user.tenantId })
        .andWhere('inquiry.siteId = :siteId', { siteId: site.id })
        .andWhere('inquiry.kind = :kind', { kind })
        .andWhere('inquiry.deletedAt IS NULL');
      const keyword = text(query.q || query.keyword, 100).toLowerCase();
      if (keyword) {
        qb.andWhere(`(
          lower(coalesce(inquiry.name, '')) LIKE :keyword OR
          lower(coalesce(inquiry.phone, '')) LIKE :keyword OR
          lower(coalesce(inquiry.city, '')) LIKE :keyword OR
          lower(coalesce(inquiry.inquiryType, '')) LIKE :keyword OR
          lower(coalesce(inquiry.message, '')) LIKE :keyword OR
          lower(coalesce(inquiry.companyName, '')) LIKE :keyword OR
          lower(coalesce(inquiry.intendedRegion, '')) LIKE :keyword OR
          lower(coalesce(inquiry.businessSummary, '')) LIKE :keyword
        )`, { keyword: `%${keyword}%` });
      }
      const submittedFrom = dateBoundary(query.submittedFrom || query.dateFrom || query.from);
      const submittedTo = dateBoundary(query.submittedTo || query.dateTo || query.to, true);
      if (submittedFrom) qb.andWhere('inquiry.createdAt >= :submittedFrom', { submittedFrom });
      if (submittedTo) qb.andWhere('inquiry.createdAt <= :submittedTo', { submittedTo });
      qb.orderBy('inquiry.createdAt', 'DESC');
      const page = Math.max(Number(query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(query.pageSize) || 50, 1), 200);
      const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
      return { items: rows.map(publicRow), total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1) };
    }, this.scope(user));
  }

  remove(user: JwtPayload, siteCodeInput: string, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCodeInput);
      const row = await em.getRepository(SiteInquiryEntity).findOneBy({
        id, tenantId: user.tenantId, siteId: site.id, deletedAt: null,
      } as any);
      if (!row) throw new NotFoundException('Inquiry not found.');
      const before = { ...row };
      row.deletedAt = new Date();
      row.deletedBy = user.userId;
      await em.getRepository(SiteInquiryEntity).save(row);
      await this.audit(em, user, 'site-inquiry.delete', row.id, before, { ...row });
      return { ok: true, id };
    }, this.scope(user));
  }

  publicCreate(siteCodeInput: string, kindInput: unknown, input: PublicSiteInquiryInput, meta: { userAgent?: string } = {}) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const kind = this.kind(kindInput || 'customer');
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('Public site tenant is not configured.');
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      const patch = this.publicPatch(kind, input, meta);
      const saved = await em.getRepository(SiteInquiryEntity).save(em.getRepository(SiteInquiryEntity).create({
        tenantId,
        siteId: site.id,
        siteCode,
        kind,
        ...patch,
      }));
      return { success: true, data: { id: saved.id, submittedAt: saved.createdAt } };
    }, { tenantId });
  }

  private publicPatch(kind: InquiryKind, input: PublicSiteInquiryInput, meta: { userAgent?: string }) {
    const phone = text(input.phone, 40);
    if (!phone) throw new BadRequestException('Phone is required.');
    if (kind === 'customer') {
      const name = text(input.name, 120);
      const message = longText(input.message);
      if (!name) throw new BadRequestException('Name is required.');
      if (!message) throw new BadRequestException('Message is required.');
      return {
        name,
        phone,
        city: text(input.city, 160) || null,
        inquiryType: text(input.inquiryType, 120) || null,
        message,
        sourcePath: text(input.sourcePath, 500) || null,
        userAgent: text(meta.userAgent, 500) || null,
      };
    }
    const name = text(input.name, 120);
    const companyName = text(input.companyName, 200);
    const intendedRegion = text(input.intendedRegion || input.city, 200);
    const businessSummary = longText(input.businessSummary || input.message);
    if (!name) throw new BadRequestException('Contact name is required.');
    if (!companyName) throw new BadRequestException('Company or store name is required.');
    if (!intendedRegion) throw new BadRequestException('Intended region is required.');
    return {
      name,
      phone,
      companyName,
      intendedRegion,
      businessSummary: businessSummary || null,
      sourcePath: text(input.sourcePath, 500) || null,
      userAgent: text(meta.userAgent, 500) || null,
    };
  }

  private kind(value: unknown): InquiryKind {
    const kind = String(value || '').trim().toLowerCase() as InquiryKind;
    if (!KINDS.has(kind)) throw new BadRequestException('Inquiry kind must be customer or dealer.');
    return kind;
  }

  private async findSite(em: EntityManager, tenantId: string, siteCodeInput: string) {
    const site = await em.getRepository(BrandSiteEntity).findOneBy({
      tenantId, code: normalizeSiteCode(siteCodeInput), status: 'active', deletedAt: null,
    } as any);
    if (!site) throw new NotFoundException('Site not found or inactive.');
    return site;
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
      resourceType: 'site-inquiry',
      resourceId: id,
      beforeState: before,
      afterState: after,
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
  }
}
