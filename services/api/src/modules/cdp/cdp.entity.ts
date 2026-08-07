import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'cdp_end_user_profile' })
export class CdpProfileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'external_ref', type: 'varchar', nullable: true }) externalRef: string | null;
  @Column({ name: 'name_enc', type: 'text', nullable: true }) nameEnc: string | null;
  @Column({ name: 'phone_hash', type: 'varchar', nullable: true }) @Index() phoneHash: string | null;
  @Column({ name: 'phone_enc', type: 'text', nullable: true }) phoneEnc: string | null;
  @Column({ name: 'email_enc', type: 'text', nullable: true }) emailEnc: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) attributes: Record<string, unknown>;
  @Column({ name: 'segment_codes', type: 'jsonb', default: () => "'[]'::jsonb" }) segmentCodes: string[];
  @Column({ name: 'consent_status', default: 'unknown' }) consentStatus: string;
  @Column({ type: 'varchar', nullable: true }) source: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'cdp_segment' })
export class CdpSegmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() code: string;
  @Column() name: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) rule: Record<string, unknown>;
  @Column({ name: 'member_count', default: 0 }) memberCount: number;
  @Column({ default: 'active' }) status: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'cdp_consent_ledger' })
export class CdpConsentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'profile_id' }) @Index() profileId: string;
  @Column() purpose: string;
  @Column() granted: boolean;
  @Column({ type: 'varchar', nullable: true }) channel: string | null;
  @Column({ type: 'varchar', nullable: true }) evidence: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}
