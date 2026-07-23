import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ViewerDraftStatus = 'draft' | 'archived';

@Entity('viewer_design_drafts')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'designProjectId'])
@Index(['tenantId', 'updatedAt'])
export class ViewerDesignDraftEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'created_by', type: 'varchar', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'varchar', nullable: true }) updatedBy: string | null;

  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'design_project_id', type: 'varchar', nullable: true }) designProjectId: string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'opportunity_id', type: 'varchar', nullable: true }) opportunityId: string | null;
  @Column({ name: 'contract_id', type: 'varchar', nullable: true }) contractId: string | null;
  @Column({ name: 'artifact_id', type: 'varchar', nullable: true }) artifactId: string | null;

  @Column({ name: 'version', type: 'integer', default: 1 }) version: number;
  @Column({ default: 'draft' }) @Index() status: ViewerDraftStatus;
  @Column({ name: 'project_inputs', type: 'jsonb', default: () => "'{}'::jsonb" }) projectInputs: Record<string, unknown>;
  @Column({ name: 'building_inputs', type: 'jsonb', default: () => "'{}'::jsonb" }) buildingInputs: Record<string, unknown>;
  @Column({ name: 'system_inputs', type: 'jsonb', default: () => "'{}'::jsonb" }) systemInputs: Record<string, unknown>;
  @Column({ name: 'generated_model', type: 'jsonb', default: () => "'{}'::jsonb" }) generatedModel: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
