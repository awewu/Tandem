import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('workflow_instances')
@Index(['tenantId', 'workflowType', 'status'])
export class WorkflowInstanceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'workflow_type' }) @Index() workflowType: string;
  @Column({ name: 'temporal_workflow_id' }) temporalWorkflowId: string;
  @Column({ name: 'aggregate_type' }) aggregateType: string;
  @Column({ name: 'aggregate_id' }) aggregateId: string;
  @Column({ default: 'running' }) @Index() status: string;
  @Column({ type: 'jsonb', default: {} }) input: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) state: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' }) startedAt: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
