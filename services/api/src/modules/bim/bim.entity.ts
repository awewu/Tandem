import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('bim_projects')
@Index(['tenantId', 'quotationId'])
@Index(['tenantId', 'status'])
export class BimProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'store_id', nullable: true }) storeId: string | null;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ type: 'uuid', name: 'quotation_id', nullable: true }) quotationId: string | null;
  @Column({ type: 'varchar', name: 'quotation_no', nullable: true }) quotationNo: string | null;

  @Column({ default: 'inherited' }) status: string;
  @Column({ type: 'varchar', name: 'customer_name', nullable: true }) customerName: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) project: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) bom: unknown[];
  @Column({ type: 'jsonb', name: '"costBreakdown"', default: () => "'{}'::jsonb" }) costBreakdown: Record<string, unknown>;
  @Column({ type: 'numeric', name: 'paid_value', default: 0 }) paidValue: number;
  @Column({ type: 'varchar', name: 'system_families', default: '' }) systemFamilies: string;
  @Column({ type: 'varchar', name: 'drawing_url', nullable: true }) drawingUrl: string | null;
  @Column({ type: 'varchar', name: 'bom_xlsx_url', nullable: true }) bomXlsxUrl: string | null;
  @Column({ type: 'jsonb', name: 'acceptance_checklist', default: () => "'[]'::jsonb" }) acceptanceChecklist: unknown[];
  @Column({ type: 'timestamptz', name: 'accepted_at', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'varchar', name: 'accepted_by', nullable: true }) acceptedBy: string | null;
  @Column({ type: 'varchar', name: 'assigned_to', nullable: true }) assignedTo: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('rysnova_bim_artifacts')
@Index(['tenantId', 'projectId'])
export class RysnovaBimArtifactEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'project_id', nullable: true }) projectId: string | null;
  @Column({ type: 'uuid', name: 'customer_id', nullable: true }) customerId: string | null;

  @Column({ name: 'artifact_type', default: 'bim_model' }) artifactType: string;
  @Column() name: string;
  @Column({ type: 'varchar', name: 'file_key', nullable: true }) fileKey: string | null;
  @Column({ type: 'jsonb', name: 'bim_data', default: () => "'{}'::jsonb" }) bimData: Record<string, unknown>;
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'jsonb', name: 'artifact_doc', default: () => "'{}'::jsonb" }) artifactDoc: Record<string, unknown>;
  @Column({ type: 'varchar', name: 'project_key', nullable: true }) projectKey: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('bcf_topics')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'bimProjectId'])
export class BcfTopicEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'varchar', name: 'store_id', nullable: true }) storeId: string | null;

  @Column({ name: 'topic_guid' }) topicGuid: string;
  @Column() title: string;
  @Column({ default: '' }) description: string;
  @Column({ name: 'topic_type', default: 'issue' }) topicType: 'clash' | 'rfi' | 'change' | 'issue';
  @Column({ default: 'open' }) status: 'open' | 'resolved' | 'closed';
  @Column({ default: 'normal' }) priority: string;
  @Column({ name: 'creation_author' }) creationAuthor: string;
  @Column({ type: 'varchar', name: 'assigned_to', nullable: true }) assignedTo: string | null;
  @Column({ type: 'varchar', name: 'design_project_id', nullable: true }) designProjectId: string | null;
  @Column({ type: 'varchar', name: 'bim_project_id', nullable: true }) bimProjectId: string | null;

  @Column({ type: 'jsonb', name: 'related_ifc_guids', default: () => "'[]'::jsonb" }) relatedIfcGuids: unknown[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) comments: unknown[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) viewpoints: unknown[];

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
