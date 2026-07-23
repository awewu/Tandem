import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('design_projects')
@Index(['tenantId', 'customerId'])
export class DesignProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'opportunity_id', type: 'varchar', nullable: true }) opportunityId: string | null;
  @Column() name: string;
  @Column({ default: 'draft' }) @Index() status: string;
  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('design_releases')
@Index(['tenantId', 'projectId'])
export class DesignReleaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  // 签章状态机：draft → reviewed → released
  @Column({ default: 'draft' }) @Index() status: string;
  @Column({ name: 'calc_snapshot', type: 'jsonb', default: {} }) calcSnapshot: Record<string, unknown>;
  @Column({ name: 'gate_pass', type: 'boolean', nullable: true }) gatePass: boolean | null;
  @Column({ name: 'gate_blocked', type: 'boolean', default: false }) gateBlocked: boolean;
  // 软闸签字越过审计
  @Column({ name: 'override_required', type: 'boolean', default: false }) overrideRequired: boolean;
  @Column({ name: 'override_signed', type: 'boolean', default: false }) overrideSigned: boolean;
  @Column({ name: 'override_by', type: 'varchar', nullable: true }) overrideBy: string | null;
  @Column({ name: 'override_reason', type: 'text', nullable: true }) overrideReason: string | null;
  @Column({ name: 'override_signed_at', type: 'timestamptz', nullable: true }) overrideSignedAt: Date | null;
  @Column({ name: 'reviewed_by', type: 'varchar', nullable: true }) reviewedBy: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @Column({ name: 'released_by', type: 'varchar', nullable: true }) releasedBy: string | null;
  @Column({ name: 'released_at', type: 'timestamptz', nullable: true }) releasedAt: Date | null;
  @Column({ name: 'disclaimer_accepted', type: 'boolean', default: false }) disclaimerAccepted: boolean;
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
  @Column({ type: 'jsonb', default: [] }) walls: unknown[];
  @Column({ type: 'jsonb', default: {} }) equipment: Record<string, unknown>;
  @Column({ type: 'jsonb', default: [] }) rooms: unknown[];
  @Column({ type: 'jsonb', nullable: true }) doors: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) windows: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) furniture: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) pipes: unknown[] | null;
  @Column({ type: 'jsonb', nullable: true }) devices: unknown[] | null;
  @Column({ name: 'cad_image_url', type: 'varchar', nullable: true }) cadImageUrl: string | null;
  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
