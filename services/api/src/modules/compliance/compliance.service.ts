import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ConsentEntity, ConsentPurpose, SubjectType } from './consent.entity';
import { hashPII } from './compliance.pii';
import { withRlsTransaction } from '../common/rls';

export interface RecordConsentDto {
  tenantId: string;
  subjectId: string;
  subjectType?: SubjectType;
  purpose: ConsentPurpose;
  policyVersion: string;
  granted: boolean;
  channel?: string;
  ip?: string;
  userAgent?: string;
  ttlDays?: number;
}

/**
 * 数据保留策略（PIPL 第19条：保留期限为实现处理目的所必要的最短时间）。
 * 按数据分类给出默认保留天数；到期由 purgeExpired 触发清理/匿名化。
 */
export const DATA_RETENTION_POLICY: Record<string, { days: number; action: 'purge' | 'anonymize'; note: string }> = {
  diagnosis_lead:   { days: 365,  action: 'anonymize', note: '问诊留资：1 年未转化匿名化' },
  marketing_consent:{ days: 730,  action: 'purge',     note: '营销同意：2 年' },
  customer_record:  { days: 3650, action: 'anonymize', note: '已签约客户：10 年（保修/合同期）' },
  audit_log:        { days: 1825, action: 'purge',     note: '审计日志：5 年（等保要求）' },
};

@Injectable()
export class ComplianceService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  async recordConsent(dto: RecordConsentDto): Promise<ConsentEntity> {
    return withRlsTransaction(this.ds, (em) => this.recordConsentInTx(em, dto), { tenantId: dto.tenantId });
  }

  /**
   * 事务内记录同意——供上游领域写（如 ingress 留资）在同一 RLS 事务里
   * 把「建线索」与「存同意」原子化（PIPL 第13/14条：同意须与处理行为一并可追溯）。
   */
  async recordConsentInTx(em: EntityManager, dto: RecordConsentDto): Promise<ConsentEntity> {
    if (!dto.tenantId || !dto.subjectId || !dto.purpose || !dto.policyVersion) {
      throw new BadRequestException('tenantId/subjectId/purpose/policyVersion 必填');
    }
    const now = new Date();
    const consents = em.getRepository(ConsentEntity);
    const entity = consents.create({
      tenantId: dto.tenantId,
      subjectId: dto.subjectId,
      subjectType: dto.subjectType || 'consumer',
      purpose: dto.purpose,
      policyVersion: dto.policyVersion,
      granted: dto.granted,
      channel: dto.channel || 'web',
      ipHash: dto.ip ? hashPII(dto.ip) : null,
      userAgent: dto.userAgent || null,
      grantedAt: dto.granted ? now : null,
      withdrawnAt: dto.granted ? null : now,
      expiresAt: dto.ttlDays ? new Date(now.getTime() + dto.ttlDays * 86400000) : null,
    });
    return consents.save(entity);
  }

  async getConsentStatus(tenantId: string, subjectId: string, purpose: ConsentPurpose) {
    const rows = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(ConsentEntity).find({ where: { tenantId, subjectId, purpose } }), { tenantId });
    const latest = rows.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0];
    return {
      tenantId, subjectId, purpose,
      active: latest ? latest.isActive : false,
      policyVersion: latest?.policyVersion || null,
      grantedAt: latest?.grantedAt || null,
      withdrawnAt: latest?.withdrawnAt || null,
    };
  }

  async withdrawConsent(tenantId: string, subjectId: string, purpose: ConsentPurpose) {
    // PIPL 第15条：撤回同意须与给予同样便捷
    return this.recordConsent({ tenantId, subjectId, purpose, policyVersion: 'withdraw', granted: false });
  }

  async listConsents(tenantId: string, subjectId: string) {
    return withRlsTransaction(this.ds, (em) =>
      em.getRepository(ConsentEntity).find({ where: { tenantId, subjectId } }), { tenantId });
  }

  dataRetentionPolicy() {
    return { policy: DATA_RETENTION_POLICY, basis: 'PIPL 第19条 · 等保二级' };
  }
}
