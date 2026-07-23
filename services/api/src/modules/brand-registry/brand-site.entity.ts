import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('tenant_brand_sites')
@Index(['tenantId', 'code'], { unique: true })
export class BrandSiteEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() code: string;
  @Column({ name: 'name_cn' }) nameCn: string;
  @Column({ name: 'name_en' }) nameEn: string;
  @Column({ name: 'app_key', type: 'varchar', nullable: true }) appKey: string | null;
  @Column({ name: 'delivery_type', default: 'self_hosted' }) deliveryType: 'self_hosted' | 'external';
  @Column({ name: 'development_url', type: 'varchar', nullable: true }) developmentUrl: string | null;
  @Column({ name: 'production_url', type: 'varchar', nullable: true }) productionUrl: string | null;
  @Column({ name: 'logo_artifact_id', type: 'uuid', nullable: true }) logoArtifactId: string | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ default: 'active' }) status: 'active' | 'inactive';
  @Column({ name: 'site_note', type: 'text', nullable: true }) siteNote: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}


@Entity('site_product_assignments')
@Index(['tenantId', 'siteId', 'productId'])
export class SiteProductAssignmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'product_tenant_id' }) productTenantId: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  @Column({ type: 'varchar', nullable: true }) brand: string | null;
  @Column({ name: 'public_slug' }) publicSlug: string;
  @Column({ name: 'website_category', type: 'varchar', nullable: true }) websiteCategory: string | null;
  @Column({ name: 'menu_group', type: 'varchar', nullable: true }) menuGroup: string | null;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({ default: 'draft' }) @Index() status: 'draft' | 'published' | 'hidden';
  @Column({ name: 'site_title', type: 'varchar', nullable: true }) siteTitle: string | null;
  @Column({ name: 'site_summary', type: 'text', nullable: true }) siteSummary: string | null;
  @Column({ name: 'site_meta', type: 'jsonb', default: () => "'{}'::jsonb" }) siteMeta: Record<string, unknown>;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
