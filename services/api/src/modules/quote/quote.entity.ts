import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('quotations')
@Index(['tenantId', 'customerId'])
@Index(['tenantId', 'status'])
export class QuotationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar', name: 'dealer_id', nullable: true }) dealerId: string | null;
  @Column({ type: 'varchar', name: 'store_id',  nullable: true }) storeId:  string | null;
  @Column({ name: 'customer_id' }) @Index() customerId: string;
  @Column({ type: 'varchar', name: 'opportunity_id', nullable: true }) opportunityId: string | null;
  @Column({ type: 'varchar', name: 'lifecycle_link_id', nullable: true }) lifecycleLinkId: string | null;
  // 项目主线锚点（P0 可空；P2 收紧 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ type: 'varchar', name: 'project_id', nullable: true }) projectId: string | null;
  @Column({ type: 'varchar', name: 'owner_user_id', nullable: true }) ownerUserId: string | null;
  @Column({ name: 'quotation_no', unique: true }) quotationNo: string;
  @Column({ default: 'draft' }) @Index() status: string;
  @Column({ default: 'designer-bom' }) source: string;
  @Column({ type: 'jsonb', default: {} }) project: Record<string, unknown>;
  @Column({ name: 'bom', type: 'jsonb', default: [] }) items: Record<string, unknown>[];
  @Column('text', { name: 'system_families', array: true, default: () => "ARRAY[]::text[]" }) systemFamilies: string[];
  @Column({ name: 'cost_snapshot', type: 'jsonb', default: {} }) costBreakdown: Record<string, number>;
  @Column({ name: 'econet_premium', type: 'jsonb', default: {} }) econetPremium: Record<string, unknown>;
  @Column({ name: 'tax_profile', type: 'jsonb', default: {} }) taxProfile: Record<string, unknown>;
  @Column({ name: 'product_data_namespace', default: 'rhautt_shared' }) productDataNamespace: string;

  // M11 · 价格快照锁定（PRD 4.9）：报价生成即冻结所选 SKU 价格/参数；
  // 品牌库改价只影响其后的新报价，不自动改写已发出/待签报价。
  @Column({ name: 'price_snapshot', type: 'jsonb', default: {} }) priceSnapshot: Record<string, unknown>;
  @Column({ name: 'quotation_lock', type: 'jsonb', default: {} }) quotationLock: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
