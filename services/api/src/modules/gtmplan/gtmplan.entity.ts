import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'gtm_campaign' })
export class GtmCampaignEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() name: string;
  @Column({ name: 'bu_type', type: 'varchar', nullable: true }) buType: string | null;
  @Column({ name: 'bu_ref', type: 'varchar', nullable: true }) buRef: string | null;
  @Column({ type: 'varchar', nullable: true }) period: string | null;
  @Column({ type: 'numeric', default: 0 }) budget: number;
  @Column({ type: 'numeric', default: 0 }) spend: number;
  @Column({ name: 'attributed_revenue', type: 'numeric', default: 0 }) attributedRevenue: number;
  @Column({ default: 'planned' }) status: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'gtm_okr' })
export class GtmOkrEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() level: string;
  @Column({ type: 'varchar', nullable: true }) owner: string | null;
  @Column({ name: 'bu_ref', type: 'varchar', nullable: true }) buRef: string | null;
  @Column() objective: string;
  @Column({ name: 'key_results', type: 'jsonb', default: () => "'[]'::jsonb" }) keyResults: Array<{ kr: string; target?: number; current?: number }>;
  @Column({ type: 'numeric', default: 0 }) progress: number;
  @Column({ type: 'varchar', nullable: true }) period: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
