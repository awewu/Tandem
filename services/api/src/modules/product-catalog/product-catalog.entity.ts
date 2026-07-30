import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ProductPositioning, AssetRef, ProductSeo, ProductMarketing } from './product-taxonomy';

@Entity('products')
@Index(['tenantId', 'sku'], { unique: true })
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', default: 'rhautt_shared' }) @Index() tenantId: string;
  @Column() sku: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) brand: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ type: 'jsonb', default: {} }) spec: Record<string, unknown>;
  // D2 定位层（P1）：把产品「说清楚」——卖给谁/渠道/用户/市场/卖点。
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) positioning: ProductPositioning;
  // D2 素材引用（P2）：产品挂载的 DAM 制品引用（主图/参数表/认证/BIM族/说明书），只存引用。
  @Column({ name: 'asset_refs', type: 'jsonb', default: () => "'[]'::jsonb" }) assetRefs: AssetRef[];
  // MDM-lite 预留：跨品牌稳定产品身份（P4 去重用），P1 仅建列不启用去重逻辑。
  @Column({ name: 'product_key', type: 'varchar', nullable: true }) @Index() productKey: string | null;
  @Column({ name: 'list_price', type: 'decimal', default: 0 }) listPrice: number;
  @Column({ name: 'cost_price', type: 'decimal', default: 0 }) costPrice: number;
  @Column({ type: 'varchar', default: 'CNY' }) currency: string;
  @Column({ default: 'active' }) @Index() status: string;
  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('price_list_items')
@Index(['tenantId', 'dealerId', 'productId'])
export class PriceListItemEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'product_id' }) productId: string;
  @Column({ name: 'dealer_price', type: 'decimal', default: 0 }) dealerPrice: number;
  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true }) validFrom: Date | null;
  @Column({ name: 'valid_to', type: 'timestamptz', nullable: true }) validTo: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// L7 营销供给层：每「产品 × locale」一行（i18n + SEO/GEO + 富营销内容）。
// tenant_id 跟随产品的品牌运营租户（模型 B），FORCE RLS（迁移 021）。
@Entity('product_content')
@Index(['tenantId', 'productId', 'locale'], { unique: true })
export class ProductContentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  // L7a i18n
  @Column() locale: string;                          // BCP-47, e.g. zh-CN / en-US
  @Column({ type: 'varchar', nullable: true }) name: string | null;
  @Column({ name: 'display_currency', default: 'CNY' }) displayCurrency: string;
  // L7b SEO/GEO
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) seo: ProductSeo;
  @Column({ type: 'varchar', nullable: true }) gtin: string | null;
  @Column({ type: 'varchar', nullable: true }) mpn: string | null;
  // L7c 富营销内容
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) marketing: ProductMarketing;
  @Column({ name: 'official_detail_html', type: 'text', nullable: true }) officialDetailHtml: string | null;
  // 发布工作流：draft→review→scheduled→published（只有 published 且 publishedAt<=now 进公开供给）
  @Column({ default: 'draft' }) @Index() status: string;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'reviewed_by', type: 'varchar', nullable: true }) reviewedBy: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// L7 发布工作流审计：每次状态流转一行（跟随租户，FORCE RLS，迁移 022）。
@Entity('product_content_events')
@Index(['contentId', 'createdAt'])
export class ProductContentEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'content_id' }) @Index() contentId: string;
  @Column({ name: 'from_status', type: 'varchar', nullable: true }) fromStatus: string | null;
  @Column({ name: 'to_status' }) toStatus: string;
  @Column() action: string;
  @Column({ type: 'varchar', nullable: true }) actor: string | null;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// 产品关系（P1）：配件/兼容/替代/交叉·向上销售/对比。两端同租户，FORCE RLS（迁移 023）。
@Entity('product_relations')
@Index(['tenantId', 'productId', 'relatedProductId', 'relationType'], { unique: true })
export class ProductRelationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  @Column({ name: 'related_product_id' }) relatedProductId: string;
  @Column({ name: 'relation_type' }) relationType: string;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
