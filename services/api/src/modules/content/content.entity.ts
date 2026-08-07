import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'content_asset' })
export class ContentAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_code', type: 'varchar', nullable: true }) brandCode: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ default: 'article' }) kind: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ name: 'fact_refs', type: 'jsonb', default: () => "'[]'::jsonb" }) factRefs: Array<{ type: string; id: string }>;
  @Column({ type: 'varchar', nullable: true }) channel: string | null;
  @Column({ name: 'compliance_flags', type: 'jsonb', default: () => "'[]'::jsonb" }) complianceFlags: string[];
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'varchar', nullable: true }) author: string | null;
  @Column({ type: 'varchar', nullable: true }) reviewer: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
