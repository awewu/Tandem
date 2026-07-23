import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** 瑞诺瓦BIM 项目表 —— 签单后后场工作流的核心载体 */
@Entity('bim_projects')
@Index(['tenantId', 'quotationId'])
@Index(['tenantId', 'status'])
export class BimProjectEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id',  type: 'varchar', nullable: true }) storeId:  string | null;
  @Column({ name: 'customer_id' }) @Index() customerId: string;
  @Column({ name: 'quotation_id', type: 'varchar', nullable: true }) quotationId: string | null;
  @Column({ name: 'quotation_no', type: 'varchar', nullable: true }) quotationNo: string | null;
  // 项目主线锚点（P0 可空；P2 收紧 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;

  // 项目阶段：inherited → drawing → bom_confirmed → construction → acceptance → iot_delivered
  @Column({ default: 'inherited' }) @Index() status: string;

  // 从报价单承接的原始数据（签单后快照）
  @Column({ name: 'customer_name', type: 'varchar', nullable: true }) customerName: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'jsonb', default: {} }) project: Record<string, unknown>;       // 面积/楼层/户型
  @Column({ type: 'jsonb', default: [] }) bom: Record<string, unknown>[];           // 完整BOM行
  @Column({ type: 'jsonb', default: {} }) costBreakdown: Record<string, number>;   // 成本汇总
  @Column({ name: 'paid_value', type: 'decimal', precision: 14, scale: 2, default: 0 }) paidValue: number;
  @Column({ name: 'system_families', type: 'simple-array', default: '' }) systemFamilies: string[];

  // 后场工作产出
  @Column({ name: 'drawing_url', type: 'varchar', nullable: true }) drawingUrl: string | null;
  @Column({ name: 'bom_xlsx_url', type: 'varchar', nullable: true }) bomXlsxUrl: string | null;

  // 验收
  @Column({ name: 'acceptance_checklist', type: 'jsonb', default: [] }) acceptanceChecklist: Record<string, unknown>[];
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true }) acceptedAt: Date | null;
  @Column({ name: 'accepted_by', type: 'varchar', nullable: true }) acceptedBy: string | null;

  @Column({ name: 'assigned_to', type: 'varchar', nullable: true }) assignedTo: string | null;
  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
