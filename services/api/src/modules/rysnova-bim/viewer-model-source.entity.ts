import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ViewerModelSourceType = 'generated' | 'local-upload' | 'artifact';
export type ViewerModelType = 'ifc' | 'glb' | 'generated' | 'unknown';
export type ViewerModelLoadStatus = 'loading' | 'ready' | 'error' | 'archived';
export type ViewerModelRecordStatus = 'active' | 'archived' | 'deleted';

@Entity('viewer_model_sources')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'designProjectId'])
@Index(['tenantId', 'bimProjectId'])
@Index(['tenantId', 'artifactId'])
@Index(['tenantId', 'draftId'])
@Index(['tenantId', 'updatedAt'])
export class ViewerModelSourceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'created_by', type: 'varchar', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'varchar', nullable: true }) updatedBy: string | null;

  @Column({ name: 'draft_id', type: 'varchar', nullable: true }) draftId: string | null;
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'design_project_id', type: 'varchar', nullable: true }) designProjectId:
    string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'opportunity_id', type: 'varchar', nullable: true }) opportunityId: string | null;
  @Column({ name: 'contract_id', type: 'varchar', nullable: true }) contractId: string | null;

  @Column({ name: 'source_type' }) @Index() sourceType: ViewerModelSourceType;
  @Column({ name: 'model_type' }) @Index() modelType: ViewerModelType;
  @Column({ name: 'name', type: 'varchar', nullable: true }) name: string | null;
  @Column({ name: 'artifact_id', type: 'varchar', nullable: true }) artifactId: string | null;
  @Column({ name: 'upload_reference', type: 'jsonb', default: () => "'{}'::jsonb" })
  uploadReference: Record<string, unknown>;
  @Column({ name: 'load_status', default: 'loading' }) @Index() loadStatus: ViewerModelLoadStatus;
  @Column({ name: 'record_status', default: 'active' })
  @Index()
  recordStatus: ViewerModelRecordStatus;
  @Column({ name: 'load_error', type: 'text', nullable: true }) loadError: string | null;
  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" }) metadata: Record<
    string,
    unknown
  >;
  @Column({ name: 'component_summary', type: 'jsonb', default: () => "'{}'::jsonb" })
  componentSummary: Record<string, unknown>;
  @Column({ name: 'version', type: 'integer', default: 1 }) version: number;
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true }) archivedAt: Date | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
