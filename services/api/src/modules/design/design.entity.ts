import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('design_projects')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'status'])
export class DesignProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'customer_id', nullable: true }) customerId: string | null;
  @Column({ type: 'uuid', name: 'opportunity_id', nullable: true }) opportunityId: string | null;

  @Column() name: string;
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('floor_plans')
@Index(['tenantId', 'projectId'])
export class FloorPlanEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'project_id' }) @Index() projectId: string;
  @Column({ default: 'v1' }) version: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) walls: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) equipment: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) rooms: Record<string, unknown>;
  @Column({ type: 'jsonb', nullable: true }) doors: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) windows: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) furniture: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) pipes: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) devices: Record<string, unknown> | null;
  @Column({ type: 'varchar', name: 'cad_image_url', nullable: true, length: 2048 }) cadImageUrl: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('design_releases')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'status'])
export class DesignReleaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'project_id', nullable: true }) projectId: string | null;
  @Column({ type: 'uuid', name: 'customer_id', nullable: true }) customerId: string | null;

  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'jsonb', name: 'calc_snapshot', default: () => "'{}'::jsonb" }) calcSnapshot: Record<string, unknown>;
  @Column({ type: 'boolean', name: 'gate_pass', nullable: true }) gatePass: boolean | null;
  @Column({ type: 'boolean', name: 'gate_blocked', default: false }) gateBlocked: boolean;

  @Column({ type: 'boolean', name: 'override_required', default: false }) overrideRequired: boolean;
  @Column({ type: 'boolean', name: 'override_signed', default: false }) overrideSigned: boolean;
  @Column({ type: 'uuid', name: 'override_by', nullable: true }) overrideBy: string | null;
  @Column({ type: 'text', name: 'override_reason', nullable: true }) overrideReason: string | null;
  @Column({ type: 'timestamptz', name: 'override_signed_at', nullable: true }) overrideSignedAt: Date | null;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true }) reviewedBy: string | null;
  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true }) reviewedAt: Date | null;
  @Column({ type: 'uuid', name: 'released_by', nullable: true }) releasedBy: string | null;
  @Column({ type: 'timestamptz', name: 'released_at', nullable: true }) releasedAt: Date | null;

  @Column({ type: 'boolean', name: 'disclaimer_accepted', default: false }) disclaimerAccepted: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('design_rysnova_bim_sync')
@Index(['tenantId', 'designId'])
@Index(['tenantId', 'artifactId'])
export class DesignRysnovaBimSyncEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'design_id' }) designId: string;
  @Column({ name: 'design_version' }) designVersion: string;
  @Column({ type: 'uuid', name: 'artifact_id', nullable: true }) artifactId: string | null;
  @Column({ type: 'varchar', name: 'artifact_version', nullable: true }) artifactVersion: string | null;

  @Column({ name: 'sync_state', default: 'in_sync' }) syncState: 'in_sync' | 'stale' | 'proposed_change';
  @Column({ type: 'jsonb', name: 'change_proposal', nullable: true }) changeProposal: Record<string, unknown> | null;
  @Column({ type: 'varchar', name: 'reviewed_by', nullable: true }) reviewedBy: string | null;
  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true }) reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('ai_design_audits')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'createdAt'])
export class AiDesignAuditEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'project_id' }) projectId: string;
  @Column({ type: 'uuid', name: 'user_id', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', name: 'user_role', nullable: true }) userRole: string | null;

  @Column({ name: 'action_type' }) actionType: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) input: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) output: Record<string, unknown>;

  @Column({ type: 'varchar', name: 'trust_state', nullable: true }) trustState: string | null;
  @Column({ type: 'varchar', name: 'model_version', nullable: true }) modelVersion: string | null;
  @Column({ type: 'varchar', name: 'kernel_version', nullable: true }) kernelVersion: string | null;
  @Column({ type: 'varchar', name: 'gate_status', nullable: true }) gateStatus: string | null;

  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true }) reviewedBy: string | null;
  @Column({ type: 'timestamptz', name: 'reviewed_at', nullable: true }) reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
