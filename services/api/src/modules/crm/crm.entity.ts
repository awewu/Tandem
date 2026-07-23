import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
@Index(['tenantId', 'phoneHash'], { unique: true })
@Index(['tenantId', 'ownerUserId', 'status'])
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'varchar', name: 'store_id',  nullable: true }) storeId:  string | null;
  @Column({ type: 'varchar', name: 'owner_user_id', nullable: true }) ownerUserId: string | null;
  @Column({ name: 'phone_hash' }) phoneHash: string;
  @Column({ name: 'phone_encrypted' }) phoneEncrypted: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'varchar', nullable: true }) address: string | null;
  @Column({ default: 'unknown' }) source: string;
  @Column({ default: 'lead' }) @Index() status: string;
  @Column({ type: 'jsonb', default: {} }) profile: Record<string, unknown>;
  @Column('text', { array: true, default: () => "ARRAY[]::text[]" }) tags: string[];
  @Column({ name: 'product_data_namespace', default: 'rhautt_shared' }) productDataNamespace: string;
  @Column({ type: 'timestamptz', name: 'last_interaction_at', nullable: true }) lastInteractionAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('opportunities')
@Index(['tenantId', 'customerId'])
export class OpportunityEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'varchar', name: 'store_id',  nullable: true }) storeId:  string | null;
  @Column({ name: 'customer_id' }) @Index() customerId: string;
  @Column({ type: 'varchar', name: 'owner_user_id', nullable: true }) ownerUserId: string | null;
  @Column({ default: 'lead' }) @Index() stage: string;
  @Column({ name: 'estimated_budget', type: 'decimal', nullable: true }) estimatedValue: number;
  @Column({ type: 'decimal', default: 0.1 }) probability: number;
  @Column({ type: 'timestamptz', name: 'next_action_at', nullable: true }) nextActionAt: Date | null;
  @Column({ type: 'varchar', name: 'lost_reason', nullable: true }) lostReason: string | null;
  @Column({ type: 'varchar', name: 'quotation_id', nullable: true }) quotationId: string | null;
  // 项目主线锚点（P0 可空；P2 收紧 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ type: 'varchar', name: 'project_id', nullable: true }) projectId: string | null;
  @Column({ name: 'product_data_namespace', default: 'rhautt_shared' }) productDataNamespace: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('interactions')
@Index(['tenantId', 'customerId'])
export class InteractionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'customer_id' }) @Index() customerId: string;
  @Column({ type: 'varchar', name: 'opportunity_id', nullable: true }) opportunityId: string | null;
  @Column({ type: 'varchar', name: 'actor_user_id', nullable: true }) actorUserId: string | null;
  @Column({ default: 'note' }) type: string;
  @Column({ type: 'varchar', nullable: true }) content: string | null;
  @Column({ type: 'varchar', name: 'next_action', nullable: true }) nextAction: string | null;
  @Column({ type: 'timestamptz', name: 'next_action_at', nullable: true }) nextActionAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
