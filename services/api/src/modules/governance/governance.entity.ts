import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['tenantId', 'actorUserId', 'createdAt'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'actor_user_id', type: 'varchar', nullable: true }) actorUserId: string | null;
  @Column({ name: 'action' }) @Index() action: string;
  @Column({ name: 'resource_type' }) resourceType: string;
  @Column({ name: 'resource_id', type: 'varchar', nullable: true }) resourceId: string | null;
  @Column({ name: 'before_state', type: 'jsonb', nullable: true }) beforeState: Record<string, unknown> | null;
  @Column({ name: 'after_state', type: 'jsonb', nullable: true }) afterState: Record<string, unknown> | null;
  @Column({ name: 'request_id', type: 'varchar', nullable: true }) requestId: string | null;
  @Column({ name: 'trace_id', type: 'varchar', nullable: true }) traceId: string | null;
  @Column({ name: 'ip_hash', type: 'varchar', nullable: true }) ipHash: string | null;
  @CreateDateColumn({ name: 'created_at' }) @Index() createdAt: Date;
}
