import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_events')
@Index(['tenantId', 'eventType', 'createdAt'])
export class AnalyticsEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'user_id', type: 'varchar', nullable: true }) userId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'event_type' }) @Index() eventType: string;
  @Column({ name: 'surface', type: 'varchar', nullable: true }) surface: string | null;
  @Column({ type: 'jsonb', default: {} }) properties: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) @Index() createdAt: Date;
}
