import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('contracts')
@Index(['tenantId', 'contractNo'], { unique: true })
@Index(['tenantId', 'dealerId', 'status'])
@Index(['tenantId', 'esignContractId'])
@Index(['tenantId', 'projectId'])
export class ContractEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'uuid', name: 'customer_id' }) customerId: string;
  @Column({ type: 'uuid', name: 'quotation_id', nullable: true }) quotationId: string | null;
  @Column({ name: 'contract_no' }) contractNo: string;
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'timestamptz', name: 'signed_at', nullable: true }) signedAt: Date | null;
  @Column({ type: 'numeric', precision: 14, scale: 2, name: 'total_amount', nullable: true }) totalAmount: number | null;

  @Column({ type: 'uuid', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'jsonb', name: 'terms', default: () => "'{}'::jsonb" }) terms: Record<string, unknown>;
  @Column({ type: 'varchar', name: 'esign_contract_id', nullable: true }) esignContractId: string | null;
  @Column({ type: 'int', name: 'esign_status', nullable: true }) esignStatus: number | null;
  @Column({ type: 'text', name: 'esign_sign_url', nullable: true }) esignSignUrl: string | null;
  @Column({ type: 'varchar', name: 'signed_pdf_key', nullable: true }) signedPdfKey: string | null;
  @Column({ type: 'uuid', name: 'project_id', nullable: true }) projectId: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
