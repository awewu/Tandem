import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// 售后工单（安装/维修/保养/投诉），承接 dealer 前端 /aftersales。
@Entity('service_tickets')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'customerId'])
export class ServiceTicketEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'ticket_no' }) ticketNo: string;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'customer_name', type: 'varchar', nullable: true }) customerName: string | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  // 项目主线锚点（P2 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  // installation | repair | maintenance | complaint | other
  @Column({ default: 'repair' }) category: string;
  // low | normal | high | urgent
  @Column({ default: 'normal' }) priority: string;
  @Column() title: string;
  @Column({ type: 'text', default: '' }) description: string;
  // open | assigned | in-progress | resolved | closed
  @Column({ default: 'open' }) @Index() status: string;
  @Column({ name: 'assigned_to', type: 'varchar', nullable: true }) assignedTo: string | null;
  @Column({ type: 'text', nullable: true }) resolution: string | null;
  @Column({ name: 'sla_due_at', type: 'timestamptz', nullable: true }) slaDueAt: Date | null;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// 保修台账（交付后按系统/产品登记，到期状态由 end_date 派生）。
@Entity('warranties')
@Index(['tenantId', 'customerId'])
export class WarrantyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'warranty_no' }) warrantyNo: string;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'customer_name', type: 'varchar', nullable: true }) customerName: string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  // 项目主线锚点（P2 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'product_name', type: 'varchar', nullable: true }) productName: string | null;
  @Column({ name: 'system_family', type: 'varchar', nullable: true }) systemFamily: string | null;
  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date' }) endDate: string;
  // active | expired | void（active/expired 一般由 end_date 派生，void 为人工作废）
  @Column({ default: 'active' }) @Index() status: string;
  @Column({ type: 'jsonb', default: {} }) terms: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
