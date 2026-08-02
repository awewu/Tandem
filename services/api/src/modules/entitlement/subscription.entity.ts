import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';

/**
 * 可售模块标识（底座 auth/tenant/entitlement/compliance/mdm/governance/notification/workflow
 * 不单独售卖，恒可用，不出现在此枚举）。
 */
export type SellableModuleId =
  | 'site'            // 板块一 A · 建站/标准治理
  | 'product-catalog' // 板块一 B · 产品管理
  | 'growth'          // 板块一 C · AI 增长
  | 'crm'             // 板块二 · 引流线索成交
  | 'diagnosis'       // 板块二 · AI 问诊
  | 'quote'           // 板块二 · 报价
  | 'design'          // 板块二 · 设计
  | 'delivery'        // 板块二 · 交付/合同
  | 'lifecycle'       // 板块二 · 生命周期
  | 'analytics';      // 横向 · 分析

export const SELLABLE_MODULES: readonly SellableModuleId[] = [
  'site', 'product-catalog', 'growth',
  'crm', 'diagnosis', 'quote', 'delivery', 'lifecycle',
  'analytics'
] as const;

export type SubscriptionStatus =
  | 'active' | 'trialing' | 'past_due' | 'suspended' | 'canceled' | 'expired';

export type SubscriptionPlan = 'trial' | 'standard' | 'professional' | 'enterprise';

/**
 * 租户模块订阅（商业化 SaaS 授权账本）。
 * 每条记录 = 某租户对某可售模块的一份订阅。UNIQUE(tenant_id, module_id)。
 */
@Entity('tenant_module_subscriptions')
@Index(['tenantId', 'status'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;

  @Column({ name: 'module_id' }) moduleId: SellableModuleId;

  @Column({ default: 'trial' }) plan: SubscriptionPlan;
  @Column({ default: 'active' }) status: SubscriptionStatus;

  // null = 不限席位
  @Column({ type: 'int', nullable: true }) seats: number | null;

  @Column({ name: 'starts_at', type: 'timestamptz', default: () => 'now()' }) startsAt: Date;
  // null = 无到期
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true }) endsAt: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  /** 是否为「有效可用」的订阅（授权判定核心）。 */
  get isActive(): boolean {
    if (this.status !== 'active' && this.status !== 'trialing') return false;
    return !this.endsAt || this.endsAt > new Date();
  }
}
