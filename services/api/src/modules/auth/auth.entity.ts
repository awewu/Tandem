import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';

export type UserRole =
  | 'platform_admin' | 'hq_admin' | 'brand_admin' | 'regional_manager'
  | 'dealer_admin' | 'store_manager' | 'designer'
  | 'sales' | 'engineer' | 'installer' | 'customer';

@Entity('users')
@Index(['tenantId', 'phoneHash'], { unique: true })
@Index(['tenantId', 'dealerId', 'role', 'status'])
@Index(['tenantId', 'storeId', 'status'])
export class UserEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;

  // PIPL：手机号不落明文。phone_hash 用于可检索去重/登录命中（compliance.pii.hashPII），
  // phone_encrypted 为 AES-256-GCM 可逆密文（compliance.pii.encryptPII），界面按需脱敏。
  @Column({ name: 'phone_hash' }) phoneHash: string;
  @Column({ name: 'phone_encrypted' }) phoneEncrypted: string;
  @Column({ name: 'password_hash', select: false }) passwordHash: string;
  @Column({ name: 'display_name' }) name: string;
  @Column() role: UserRole;
  @Column({ type: 'jsonb', default: () => "'[]'" }) permissions: string[];

  @Column({ default: 'active' }) @Index() status: 'active' | 'inactive' | 'suspended';
  @Column({ name: 'login_attempts', default: 0 }) loginAttempts: number;
  @Column({ name: 'lock_until', type: 'timestamptz', nullable: true }) lockUntil: Date | null;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;

  get isLocked(): boolean {
    return Boolean(this.lockUntil && this.lockUntil > new Date());
  }
}
