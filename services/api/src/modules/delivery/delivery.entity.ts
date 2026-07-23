import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('contracts')
@Index(['tenantId', 'customerId'])
export class ContractEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ name: 'quotation_id', type: 'varchar', nullable: true }) quotationId: string | null;
  // 项目主线锚点（P0 可空；P2 收紧 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'contract_no' }) contractNo: string;
  @Column({ name: 'total_amount', type: 'decimal', default: 0 }) totalAmount: number;
  @Column({ default: 'draft' }) @Index() status: string;
  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true }) signedAt: Date | null;
  @Column({ type: 'jsonb', default: {} }) terms: Record<string, unknown>;
  /** 契约锁平台侧合同 ID，发起后写入 */
  @Column({ name: 'esign_contract_id', type: 'varchar', nullable: true }) esignContractId: string | null;
  /** 契约锁合同状态（0草稿/1签署中/2已完成/3已撤回/4已拒签/5已过期） */
  @Column({ name: 'esign_status', type: 'int', nullable: true }) esignStatus: number | null;
  /** 最近一次生成的 H5 签署链接（30min 有效，仅做临时记录） */
  @Column({ name: 'esign_sign_url', type: 'text', nullable: true }) esignSignUrl: string | null;
  /** 已签署 PDF 在 object-storage 中的 key（契约锁回调后下载存入） */
  @Column({ name: 'signed_pdf_key', type: 'varchar', nullable: true }) signedPdfKey: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('delivery_records')
@Index(['tenantId', 'contractId'])
export class DeliveryRecordEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'contract_id' }) contractId: string;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  @Column({ default: 'scheduled' }) @Index() status: string;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ type: 'jsonb', default: {} }) checklist: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
