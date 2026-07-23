import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('rysnova_bim_artifacts')
@Index(['tenantId', 'projectId'])
export class RysnovaArtifactEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'artifact_type', default: 'bim_model' }) artifactType: string;
  @Column() name: string;
  @Column({ name: 'file_key', type: 'varchar', nullable: true }) fileKey: string | null;
  @Column({ type: 'jsonb', default: {} }) bim_data: Record<string, unknown>;
  @Column({ default: 'draft' }) @Index() status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
