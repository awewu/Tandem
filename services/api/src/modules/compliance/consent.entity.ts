import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';

/**
 * PIPL 同意记录（个人信息保护法 · 知情-同意留痕）
 * 每条记录 = 某个个人信息主体对某一处理目的的一次授权/撤回。
 * 法律依据：PIPL 第13/14条（同意须自愿、明确、可撤回、可追溯）。
 */
export type ConsentPurpose =
  | 'diagnosis_intake'      // 问诊需求采集
  | 'lead_to_dealer'        // 留资分发给经销商
  | 'marketing'             // 营销触达
  | 'service_followup'      // 售后回访
  | 'data_cross_border';    // 个人信息出境

export type SubjectType = 'consumer' | 'customer' | 'dealer_staff';

@Entity('pipl_consents')
@Index(['tenantId', 'subjectId', 'purpose'])
@Index(['tenantId', 'purpose', 'granted'])
export class ConsentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;

  // subjectId 为业务主体标识（不存明文 PII）；明文联系方式加密存于 quote/crm 域
  @Column({ name: 'subject_id' }) subjectId: string;
  @Column({ name: 'subject_type', default: 'consumer' }) subjectType: SubjectType;

  @Column() purpose: ConsentPurpose;
  @Column({ name: 'policy_version' }) policyVersion: string;   // 隐私政策版本，撤回与重授权追溯
  @Column({ default: true }) granted: boolean;

  // 采集证据（PIPL 可追溯要求）：渠道 + 来源 IP 哈希（不存明文 IP）+ UA
  @Column({ default: 'web' }) channel: string;
  @Column({ name: 'ip_hash', type: 'varchar', nullable: true }) ipHash: string | null;
  @Column({ name: 'user_agent', type: 'varchar', nullable: true }) userAgent: string | null;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: true }) grantedAt: Date | null;
  @Column({ name: 'withdrawn_at', type: 'timestamptz', nullable: true }) withdrawnAt: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  get isActive(): boolean {
    if (!this.granted || this.withdrawnAt) return false;
    return !this.expiresAt || this.expiresAt > new Date();
  }
}
