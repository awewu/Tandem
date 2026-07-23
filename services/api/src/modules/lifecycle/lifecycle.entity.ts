import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('lifecycle_links')
@Index(['tenantId', 'customerId'])
export class LifecycleLinkEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId: string;
  @Column({ name: 'opportunity_id', type: 'uuid', nullable: true }) opportunityId: string | null;
  @Column({ name: 'quotation_id', type: 'uuid', nullable: true }) quotationId: string | null;
  @Column({ name: 'contract_id', type: 'uuid', nullable: true }) contractId: string | null;
  @Column({ name: 'design_project_id', type: 'uuid', nullable: true }) designProjectId: string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  @Column({ default: 'lead-created' }) @Index() stage: string;
  @Column({ type: 'jsonb', default: {} }) transitions: Record<string, unknown>;

  // ── #2 收敛：14 态富投影（原 Mongo LifecycleLink 字段，收敛到本表单一真相源）──
  @Column({ name: 'project_state', default: 'lead-created' }) @Index() projectState: string;
  @Column({ name: 'customer_visible_state', type: 'varchar', nullable: true }) customerVisibleState: string | null;
  @Column({ name: 'progress_percent', type: 'int', default: 0 }) progressPercent: number;
  @Column({ name: 'current_milestone', type: 'varchar', nullable: true }) currentMilestone: string | null;
  @Column({ name: 'lifecycle_stage', type: 'varchar', nullable: true }) lifecycleStage: string | null;
  @Column({ name: 'handover_status', default: 'pending' }) handoverStatus: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'design_package_id', type: 'varchar', nullable: true }) designPackageId: string | null;
  @Column({ name: 'rysnova_bim_package_id', type: 'varchar', nullable: true }) rysnovaBimPackageId: string | null;
  @Column({ name: 'project_address', type: 'varchar', nullable: true }) projectAddress: string | null;
  // 项目主线业务唯一键组成（P0 可空；P2 加 UNIQUE(tenant_id, phone_hash, address_normalized)）。
  // 见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'phone_hash', type: 'varchar', nullable: true }) phoneHash: string | null;
  @Column({ name: 'address_normalized', type: 'varchar', nullable: true }) addressNormalized: string | null;
  @Column({ type: 'jsonb', default: [] }) systems: unknown[];
  @Column({ type: 'jsonb', default: {} }) iot: Record<string, unknown>;
  @Column({ type: 'jsonb', default: [] }) devices: unknown[];
  @Column({ name: 'installed_assets', type: 'jsonb', default: [] }) installedAssets: unknown[];
  @Column({ name: 'service_plan', type: 'jsonb', default: {} }) servicePlan: Record<string, unknown>;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true }) acceptedAt: Date | null;
  @Column({ name: 'created_by', type: 'varchar', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'varchar', nullable: true }) updatedBy: string | null;
  @Column({ name: 'assigned_to', type: 'varchar', nullable: true }) assignedTo: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
