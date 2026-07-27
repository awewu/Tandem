import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type BrandProductCategoryStatus = 'active' | 'inactive';

@Entity('brand_product_categories')
@Index(['brandCode', 'parentId', 'code'])
export class BrandProductCategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'brand_code' }) @Index() brandCode: string;
  @Column({ name: 'parent_id', type: 'uuid', nullable: true }) @Index() parentId: string | null;
  @Column() level: number;
  @Column() code: string;
  @Column({ name: 'name_cn' }) nameCn: string;
  @Column({ name: 'name_en', type: 'varchar', nullable: true }) nameEn: string | null;
  @Column({ type: 'varchar', nullable: true }) slug: string | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ default: 'active' }) @Index() status: BrandProductCategoryStatus;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
