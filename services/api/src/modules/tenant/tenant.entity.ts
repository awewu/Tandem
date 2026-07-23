import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) code: string;
  @Column() name: string;
  @Column({ name: 'tenant_type', default: 'dealer_group' }) type: 'hq' | 'regional' | 'dealer_group';
  @Column({ default: 'active' }) @Index() status: 'active' | 'inactive' | 'suspended';
  @Column({ type: 'jsonb', default: {} }) settings: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('dealers')
@Index(['tenantId', 'code'], { unique: true })
export class DealerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() name: string;
  @Column() code: string;
  @Column({ type: 'varchar', nullable: true }) province: string;
  @Column({ type: 'varchar', nullable: true }) city: string;
  @Column({ type: 'jsonb', default: {} }) contact: Record<string, string>;
  @Column({ name: 'contract_level', default: 'standard' }) contractLevel: string;
  @Column({ default: 'active' }) @Index() status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('stores')
@Index(['tenantId', 'dealerId', 'code'], { unique: true })
export class StoreEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id' }) @Index() dealerId: string;
  @Column() code: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) city: string;
  @Column({ type: 'varchar', nullable: true }) address: string;
  @Column({ name: 'manager_user_id', nullable: true }) managerUserId: string;
  @Column({ default: 'active' }) @Index() status: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
