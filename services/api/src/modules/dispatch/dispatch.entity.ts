import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * 派单路由目录（底座 · foundation 行 tenant_id 为 NULL 全租户可读）。
 * 仅含路由字段——无 PII、无成本价——由 HQ/招商在经销商上线时维护。
 * 派单器（系统态）读此目录做打分，避免直接读 FORCE-RLS 的 dealers 表。
 */
@Entity('dispatch_dealer_directory')
@Index(['active', 'city'])
export class DealerDirectoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', name: 'tenant_id', nullable: true }) tenantId: string | null;
  @Column({ name: 'dealer_id' }) @Index() dealerId: string;
  @Column({ type: 'varchar', name: 'dealer_tenant_id', nullable: true }) dealerTenantId: string | null;
  @Column({ type: 'varchar', name: 'store_id', nullable: true }) storeId: string | null;

  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) province: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column('text', { array: true, default: () => "ARRAY[]::text[]" }) categories: string[];
  @Column({ type: 'varchar', name: 'contract_level', nullable: true }) contractLevel: string | null;

  @Column({ default: true }) active: boolean;
  @Column({ name: 'active_load', default: 0 }) activeLoad: number;
  @Column({ default: 50 }) capacity: number;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

/**
 * 派单决策审计（租户隔离 · 落获客暂存池租户）。
 * 每条 = 一次 lead 的派单裁决（候选打分明细 + 命中经销商 + 规则），供申诉/复盘。
 */
@Entity('dispatch_routing_decisions')
@Index(['tenantId', 'createdAt'])
export class RoutingDecisionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'intake_customer_id' }) @Index() intakeCustomerId: string;
  @Column({ type: 'varchar', name: 'intake_opportunity_id', nullable: true }) intakeOpportunityId: string | null;

  @Column({ type: 'varchar', nullable: true }) source: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'varchar', nullable: true }) province: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;

  @Column({ default: 'geo+category+load' }) rule: string;
  @Column({ type: 'varchar', name: 'chosen_dealer_id', nullable: true }) chosenDealerId: string | null;
  @Column({ type: 'varchar', name: 'chosen_store_id', nullable: true }) chosenStoreId: string | null;
  @Column({ type: 'varchar', name: 'chosen_dealer_tenant_id', nullable: true }) chosenDealerTenantId: string | null;

  @Column({ type: 'decimal', nullable: true }) score: number | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) candidates: unknown;
  @Column({ type: 'varchar', nullable: true }) reason: string | null;
  @Column({ default: 'routed' }) status: 'routed' | 'unrouted';

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
