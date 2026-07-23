import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** 施工项目（合同生效后派生；1 合同 1 项目）。 */
@Entity('delivery_projects')
@Index(['tenantId', 'status'])
export class DeliveryProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'contract_id' }) contractId: string;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ name: 'quotation_id', type: 'varchar', nullable: true }) quotationId: string | null;
  // 项目主线锚点（P0 可空；P2 收紧 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ default: 'scheduled' }) @Index() status: string;
  @Column({ name: 'current_milestone_key', type: 'varchar', nullable: true }) currentMilestoneKey: string | null;
  @Column({ name: 'total_amount', type: 'decimal', default: 0 }) totalAmount: number;
  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

/** 里程碑节点（模板实例化，逐节点推进）。 */
@Entity('delivery_milestones')
@Index(['tenantId', 'projectId', 'seq'])
export class DeliveryMilestoneEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'project_id' }) projectId: string;
  @Column() key: string;
  @Column() label: string;
  @Column() seq: number;
  @Column({ default: 'pending' }) status: string;
  @Column({ name: 'requires_evidence', default: false }) requiresEvidence: boolean;
  @Column({ name: 'requires_acceptance', default: false }) requiresAcceptance: boolean;
  @Column({ name: 'unlocks_payment_key', type: 'varchar', nullable: true }) unlocksPaymentKey: string | null;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

/** 进度款（节点完成才解锁；locked→payable→paid）。 */
@Entity('delivery_payments')
@Index(['tenantId', 'projectId'])
export class DeliveryPaymentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'project_id' }) projectId: string;
  @Column() kind: string;
  @Column({ type: 'decimal', default: 0 }) amount: number;
  @Column({ default: 'locked' }) status: string;
  @Column({ name: 'unlocked_by_milestone_key', type: 'varchar', nullable: true }) unlockedByMilestoneKey: string | null;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

/** 验收留证（隐蔽工程影像/电子签；过节点前置证据）。 */
@Entity('delivery_evidence')
@Index(['tenantId', 'milestoneId'])
export class DeliveryEvidenceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'project_id' }) projectId: string;
  @Column({ name: 'milestone_id' }) milestoneId: string;
  @Column() type: string;
  @Column({ name: 'object_key', type: 'varchar', nullable: true }) objectKey: string | null;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
  @Column({ name: 'signer_id', type: 'varchar', nullable: true }) signerId: string | null;
  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
