import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('delivery_projects')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'customerId'])
export class DeliveryProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'store_id', nullable: true }) storeId: string | null;
  @Column({ name: 'contract_id' }) contractId: string;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ type: 'uuid', name: 'quotation_id', nullable: true }) quotationId: string | null;

  @Column({ default: 'scheduled' }) status: string;
  @Column({ type: 'varchar', name: 'current_milestone_key', nullable: true }) currentMilestoneKey: string | null;
  @Column({ type: 'numeric', name: 'total_amount', default: 0 }) totalAmount: number;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('delivery_milestones')
@Index(['tenantId', 'projectId', 'seq'])
export class DeliveryMilestoneEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'project_id' }) @Index() projectId: string;
  @Column() key: string;
  @Column() label: string;
  @Column() seq: number;
  @Column({ default: 'pending' }) status: 'pending' | 'in-progress' | 'completed';
  @Column({ type: 'boolean', name: 'requires_evidence', default: false }) requiresEvidence: boolean;
  @Column({ type: 'boolean', name: 'requires_acceptance', default: false }) requiresAcceptance: boolean;
  @Column({ type: 'varchar', name: 'unlocks_payment_key', nullable: true }) unlocksPaymentKey: string | null;
  @Column({ type: 'timestamptz', name: 'started_at', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true }) completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('delivery_payments')
@Index(['tenantId', 'projectId'])
export class DeliveryPaymentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'project_id' }) @Index() projectId: string;
  @Column() kind: 'deposit' | 'progress' | 'final';
  @Column({ type: 'numeric', name: 'amount', default: 0 }) amount: number;
  @Column({ default: 'locked' }) status: 'locked' | 'payable' | 'paid';
  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true }) paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('delivery_evidence')
@Index(['tenantId', 'projectId'])
export class DeliveryEvidenceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) tenantId: string;
  @Column({ name: 'project_id' }) @Index() projectId: string;
  @Column({ name: 'milestone_key' }) milestoneKey: string;
  @Column({ type: 'varchar', name: 'file_key', nullable: true }) fileKey: string | null;
  @Column({ type: 'varchar', name: 'file_url', nullable: true }) fileUrl: string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) meta: Record<string, unknown>;
  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true }) uploadedBy: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('service_tickets')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'customerId'])
export class ServiceTicketEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'store_id', nullable: true }) storeId: string | null;
  @Column({ name: 'ticket_no' }) ticketNo: string;
  @Column({ type: 'uuid', name: 'customer_id', nullable: true }) customerId: string | null;
  @Column({ type: 'varchar', name: 'customer_name', nullable: true }) customerName: string | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ type: 'uuid', name: 'bim_project_id', nullable: true }) bimProjectId: string | null;

  @Column({ default: 'repair' }) category: string;
  @Column({ default: 'normal' }) priority: string;
  @Column() title: string;
  @Column({ default: '' }) description: string;
  @Column({ default: 'open' }) status: string;
  @Column({ type: 'varchar', name: 'assigned_to', nullable: true }) assignedTo: string | null;
  @Column({ type: 'text', nullable: true }) resolution: string | null;
  @Column({ type: 'timestamptz', name: 'sla_due_at', nullable: true }) slaDueAt: Date | null;
  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('warranties')
@Index(['tenantId', 'status'])
export class WarrantyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'uuid', name: 'store_id', nullable: true }) storeId: string | null;
  @Column({ name: 'warranty_no' }) warrantyNo: string;
  @Column({ type: 'uuid', name: 'customer_id', nullable: true }) customerId: string | null;
  @Column({ type: 'varchar', name: 'customer_name', nullable: true }) customerName: string | null;
  @Column({ type: 'uuid', name: 'bim_project_id', nullable: true }) bimProjectId: string | null;
  @Column({ type: 'varchar', name: 'product_name', nullable: true }) productName: string | null;
  @Column({ type: 'varchar', name: 'system_family', nullable: true }) systemFamily: string | null;
  @Column({ type: 'date', name: 'start_date' }) startDate: string;
  @Column({ type: 'date', name: 'end_date' }) endDate: string;
  @Column({ default: 'active' }) status: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) terms: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('lifecycle_links')
@Index(['tenantId', 'customerId'])
export class LifecycleLinkEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ type: 'uuid', name: 'opportunity_id', nullable: true }) opportunityId: string | null;
  @Column({ type: 'uuid', name: 'quotation_id', nullable: true }) quotationId: string | null;
  @Column({ type: 'uuid', name: 'contract_id', nullable: true }) contractId: string | null;
  @Column({ type: 'uuid', name: 'design_project_id', nullable: true }) designProjectId: string | null;
  @Column({ default: 'lead' }) stage: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) transitions: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
