import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// GEO 选点 / 千问千面（借鉴分众选楼系统）
@Entity({ schema: 'rhautt_nexus', name: 'geo_target' })
export class GeoTargetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_code', type: 'varchar', nullable: true }) brandCode: string | null;
  @Column() @Index() category: string;
  @Column({ type: 'varchar', nullable: true }) segment: string | null;
  @Column({ type: 'varchar', nullable: true }) scenario: string | null;
  @Column({ type: 'varchar', nullable: true }) engine: string | null;
  @Column() query: string;
  @Column({ name: 'priority_score', type: 'numeric', default: 0 }) priorityScore: number;
  @Column({ name: 'variant_strategy', type: 'jsonb', default: () => "'{}'::jsonb" }) variantStrategy: Record<string, unknown>;
  @Column({ default: 'candidate' }) status: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

// 认知资产漏斗 AI-AIPL（借鉴分众品牌人群资产：可累积的护城河）
@Entity({ schema: 'rhautt_nexus', name: 'geo_cognition_asset' })
export class GeoCognitionAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_code' }) brandCode: string;
  @Column() category: string;
  @Column({ type: 'varchar', nullable: true }) engine: string | null;
  @Column({ default: 0 }) reach: number;
  @Column({ default: 0 }) cited: number;
  @Column({ default: 0 }) recommended: number;
  @Column({ default: 0 }) lead: number;
  @Column({ type: 'varchar', nullable: true }) period: string | null;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
