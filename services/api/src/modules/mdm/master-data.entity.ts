import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';

/**
 * M15 · 主数据（MDM）· 全局产品主记录
 * 跨板块唯一产品标识 global_product_id：把板块一各品牌独立产品库的 SKU、
 * 共享库、租户私有产品统一映射到一个全局 id，供板块二（报价/精算/BOM）只读引用。
 * 单写收口：owned 由品牌库唯一写入，shared 由总部维护，tenant-private 由经销商录入。
 */
export type SourceTier = 'owned' | 'shared' | 'tenant-private';
export type DataTrustLevel = 'verified' | 'calibrated' | 'unverified';

@Entity('mdm_global_products')
@Index(['sourceTier', 'brandSlug', 'sku'], { unique: true })
@Index(['globalProductId'], { unique: true })
export class GlobalProductEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  // 跨板块唯一标识（其它板块/模块只引用此 id，不直接引用品牌库主键）
  @Column({ name: 'global_product_id' }) globalProductId: string;

  // tenant-private 才有 tenantId；owned/shared 为 null（全租户可见）
  @Column({ name: 'tenant_id', type: 'varchar', nullable: true }) @Index() tenantId: string | null;

  @Column({ name: 'source_tier' }) sourceTier: SourceTier;
  @Column({ name: 'brand_slug', type: 'varchar', nullable: true }) brandSlug: string | null;
  @Column() sku: string;
  @Column() name: string;

  // 精算必填参数（仅 verified 可驱动 design CALC-*；calibrated/unverified 只进 BOM）
  @Column({ name: 'data_trust_level', default: 'unverified' }) dataTrustLevel: DataTrustLevel;
  @Column({ name: 'canonical_params', type: 'jsonb', default: {} }) canonicalParams: Record<string, unknown>;

  // 只读副本同步水位（最终一致：副本延迟期内业务以此判断是否可下单）
  @Column({ name: 'source_version', default: 1 }) sourceVersion: number;
  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true }) syncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
