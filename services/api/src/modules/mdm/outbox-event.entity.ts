import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn
} from 'typeorm';

/**
 * M15 · 跨板块事件总线（event_bus）的 outbox 表。
 * 板块间不直连：写业务库的同一事务里写 outbox，由投递器异步发布，消费方订阅。
 * 保证至少一次投递 + 可重放 + 死信。
 */
export type OutboxStatus = 'pending' | 'delivered' | 'dead';

@Entity('mdm_outbox_events')
@Index(['status', 'createdAt'])
@Index(['aggregateType', 'aggregateId'])
export class OutboxEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true }) @Index() tenantId: string | null;

  @Column({ name: 'event_type' }) eventType: string;          // e.g. product.master.updated / lead.created
  @Column({ name: 'aggregate_type' }) aggregateType: string;  // e.g. global_product / lead
  @Column({ name: 'aggregate_id' }) aggregateId: string;

  @Column({ type: 'jsonb', default: {} }) payload: Record<string, unknown>;

  @Column({ default: 'pending' }) @Index() status: OutboxStatus;
  @Column({ default: 0 }) attempts: number;
  @Column({ name: 'last_error', type: 'varchar', nullable: true }) lastError: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true }) deliveredAt: Date | null;
}
