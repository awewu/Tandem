import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { hashPII, encryptPII } from '../compliance/compliance.pii';
import type { JwtPayload } from '../auth/auth.service';
import { CdpProfileEntity, CdpSegmentEntity, CdpConsentEntity } from './cdp.entity';

function normalizePhone(raw: string): string {
  const s = String(raw ?? '').trim();
  return /[a-zA-Z@]/.test(s) ? s.toLowerCase() : s.replace(/\D/g, '');
}

@Injectable()
export class CdpService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // 终端用户档案 upsert（PII 加密 + 检索哈希；PIPL：默认 consent unknown，成交/留资另记同意）。
  async upsertProfile(actor: JwtPayload, dto: { phone?: string; name?: string; email?: string; externalRef?: string; attributes?: Record<string, unknown>; source?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(CdpProfileEntity);
      const phoneHash = dto.phone ? hashPII(normalizePhone(dto.phone)) : null;
      let profile = phoneHash ? await repo.findOne({ where: { tenantId: actor.tenantId, phoneHash } }) : null;
      const patch: any = {
        tenantId: actor.tenantId,
        externalRef: dto.externalRef ?? profile?.externalRef ?? null,
        nameEnc: dto.name ? encryptPII(dto.name) : profile?.nameEnc ?? null,
        phoneHash,
        phoneEnc: dto.phone ? encryptPII(dto.phone) : profile?.phoneEnc ?? null,
        emailEnc: dto.email ? encryptPII(dto.email) : profile?.emailEnc ?? null,
        attributes: { ...(profile?.attributes ?? {}), ...(dto.attributes ?? {}) },
        source: dto.source ?? profile?.source ?? null,
        updatedAt: new Date(),
      };
      if (profile) {
        await repo.update({ id: profile.id }, patch);
        return { id: profile.id, updated: true };
      }
      const saved = await repo.save(repo.create(patch as Partial<CdpProfileEntity>) as CdpProfileEntity);
      return { id: saved.id, created: true };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async listProfiles(actor: JwtPayload, q: { segment?: string; limit?: number } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(CdpProfileEntity);
      const qb = repo.createQueryBuilder('p').where('p.tenant_id = :t', { t: actor.tenantId });
      if (q.segment) qb.andWhere(`p.segment_codes @> :seg`, { seg: JSON.stringify([q.segment]) });
      qb.orderBy('p.updated_at', 'DESC').limit(Math.min(Number(q.limit) || 50, 200));
      const rows = await qb.getMany();
      // 只回脱敏视图（不出明文 PII）。
      const profiles = rows.map((r) => ({ id: r.id, source: r.source, consentStatus: r.consentStatus, segmentCodes: r.segmentCodes, attributes: r.attributes, updatedAt: r.updatedAt }));
      return { profiles, total: profiles.length };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async createSegment(actor: JwtPayload, dto: { code?: string; name?: string; rule?: Record<string, unknown> }) {
    const code = String(dto.code || '').trim();
    const name = String(dto.name || '').trim();
    if (!code || !name) throw new BadRequestException('segment code and name are required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(CdpSegmentEntity);
      const seg = await repo.save(repo.create({ tenantId: actor.tenantId, code, name, rule: dto.rule ?? {}, status: 'active' }));
      return { segment: { id: seg.id, code: seg.code, name: seg.name } };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  async listSegments(actor: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const segments = await em.getRepository(CdpSegmentEntity).find({ where: { tenantId: actor.tenantId }, order: { code: 'ASC' } });
      return { segments };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }

  // PIPL 同意台账：记录 + 同步档案 consent_status。
  async recordConsent(actor: JwtPayload, dto: { profileId?: string; purpose?: string; granted?: boolean; channel?: string; evidence?: string }) {
    if (!dto.profileId || !dto.purpose) throw new BadRequestException('profileId and purpose are required');
    return withRlsTransaction(this.ds, async (em) => {
      await em.getRepository(CdpConsentEntity).save(em.getRepository(CdpConsentEntity).create({
        tenantId: actor.tenantId, profileId: dto.profileId!, purpose: dto.purpose!, granted: !!dto.granted,
        channel: dto.channel ?? null, evidence: dto.evidence ?? null,
      }));
      await em.getRepository(CdpProfileEntity).update(
        { id: dto.profileId, tenantId: actor.tenantId },
        { consentStatus: dto.granted ? 'granted' : 'revoked', updatedAt: new Date() },
      );
      return { recorded: true };
    }, { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role });
  }
}
