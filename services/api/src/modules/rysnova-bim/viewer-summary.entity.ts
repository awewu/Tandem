import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ViewerSummaryTrustStatus = 'estimate' | 'verified';

@Entity('viewer_design_summaries')
@Index(['tenantId', 'draftId', 'updatedAt'])
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'designProjectId'])
export class ViewerDesignSummaryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'created_by', type: 'varchar', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'varchar', nullable: true }) updatedBy: string | null;

  @Column({ name: 'draft_id', type: 'uuid', nullable: true }) draftId: string | null;
  @Column({ name: 'draft_version', type: 'integer', nullable: true }) draftVersion: number | null;
  @Column({ name: 'model_id', type: 'varchar', nullable: true }) modelId: string | null;
  @Column({ name: 'model_version', type: 'integer', nullable: true }) modelVersion: number | null;
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'design_project_id', type: 'varchar', nullable: true }) designProjectId:
    string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  @Column({ name: 'trust_status', default: 'estimate' })
  @Index()
  trustStatus: ViewerSummaryTrustStatus;

  @Column({ name: 'calculation_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  calculationSummary: Record<string, unknown>;
  @Column({ name: 'equipment_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  equipmentSummary: Record<string, unknown>;
  @Column({ name: 'pipe_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  pipeSummary: Record<string, unknown>;
  @Column({ name: 'compliance_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  complianceSummary: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
