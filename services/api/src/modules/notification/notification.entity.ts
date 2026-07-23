import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
@Index(['tenantId', 'userId', 'readAt'])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'user_id' }) @Index() userId: string;
  @Column() type: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ type: 'jsonb', default: {} }) payload: Record<string, unknown>;
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true }) readAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) @Index() createdAt: Date;
}
