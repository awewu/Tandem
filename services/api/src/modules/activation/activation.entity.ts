import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'activation_activity' })
export class ActivationActivityEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_code', type: 'varchar', nullable: true }) brandCode: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column() type: string;
  @Column() name: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) rules: Record<string, unknown>;
  @Column({ type: 'numeric', default: 0 }) budget: number;
  @Column({ default: 'draft' }) status: string;
  @Column({ name: 'period_start', type: 'date', nullable: true }) periodStart: string | null;
  @Column({ name: 'period_end', type: 'date', nullable: true }) periodEnd: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metrics: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'activation_participation' })
export class ActivationParticipationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'activity_id', type: 'uuid', nullable: true }) activityId: string | null;
  @Column({ name: 'participant_ref', type: 'varchar', nullable: true }) participantRef: string | null;
  @Column() action: string;
  @Column({ name: 'referred_lead', default: false }) referredLead: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}
