import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** 经销商收款路径配置（每家不同；migration 025）。 */
@Entity('dealer_collection_configs')
@Index(['tenantId', 'dealerId'], { unique: true })
export class DealerCollectionConfigEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id' }) dealerId: string;
  @Column({ default: 'offline' }) channel: string;
  @Column({ name: 'pay_url', type: 'varchar', nullable: true }) payUrl: string | null;
  @Column({ name: 'qr_image_url', type: 'varchar', nullable: true }) qrImageUrl: string | null;
  @Column({ name: 'offline_note', type: 'varchar', nullable: true }) offlineNote: string | null;
  @Column({ name: 'merchant_ref', type: 'varchar', nullable: true }) merchantRef: string | null;
  @Column({ name: 'default_deposit_amount', type: 'decimal', nullable: true }) defaultDepositAmount: number | null;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

/** 可退定金订单（migration 025）。 */
@Entity('deposit_orders')
@Index(['tenantId', 'reportId'])
export class DepositOrderEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'opportunity_id', type: 'varchar', nullable: true }) opportunityId: string | null;
  @Column({ name: 'report_id', type: 'varchar', nullable: true }) reportId: string | null;
  @Column({ type: 'decimal', nullable: true }) amount: number | null;
  @Column({ default: 'CNY' }) currency: string;
  @Column({ default: 'offline' }) channel: string;
  @Column({ default: 'created' }) @Index() state: string;
  @Column({ type: 'jsonb', default: {} }) instruction: Record<string, unknown>;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true }) refundedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
