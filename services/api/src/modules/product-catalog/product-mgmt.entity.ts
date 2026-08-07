import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// 4.5 NPI 新品上市计划
@Entity({ schema: 'rhautt_nexus', name: 'product_launch' })
export class ProductLaunchEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column() name: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) plan: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) checklist: unknown[];
  @Column({ default: 'planned' }) status: string;
  @Column({ name: 'target_date', type: 'date', nullable: true }) targetDate: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

// 4.10 per-产品卖点体系
@Entity({ schema: 'rhautt_nexus', name: 'product_selling_point' })
export class ProductSellingPointEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ type: 'varchar', nullable: true }) segment: string | null;
  @Column() claim: string;
  @Column({ name: 'evidence_ref', type: 'varchar', nullable: true }) evidenceRef: string | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}

// 4.17 定价政策（毛利闸·基座3）
@Entity({ schema: 'rhautt_nexus', name: 'pricing_policy' })
export class PricingPolicyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ name: 'policy_type' }) policyType: string;
  @Column({ name: 'proposed_price', type: 'numeric', default: 0 }) proposedPrice: number;
  @Column({ name: 'cost_price', type: 'numeric', default: 0 }) costPrice: number;
  @Column({ name: 'margin_calc', type: 'jsonb', default: () => "'{}'::jsonb" }) marginCalc: Record<string, unknown>;
  @Column({ default: 'draft' }) status: string;
  @Column({ name: 'submitted_by', type: 'varchar', nullable: true }) submittedBy: string | null;
  @Column({ type: 'varchar', nullable: true }) approver: string | null;
  @Column({ name: 'decision_note', type: 'varchar', nullable: true }) decisionNote: string | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true }) decidedAt: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
