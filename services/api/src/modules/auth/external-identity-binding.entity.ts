import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExternalIdentityBindingStatus =
  | 'active'
  | 'inactive'
  | 'disabled'
  | 'pending_authorization';

@Entity('auth_external_identity_bindings')
@Index(['provider', 'issuer', 'subject'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['localUserId', 'status'])
export class ExternalIdentityBindingEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() provider: string;
  @Column() issuer: string;
  @Column({ name: 'external_subject' }) subject: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true }) tenantId: string | null;
  @Column({ name: 'local_user_id', type: 'uuid', nullable: true }) localUserId: string | null;

  @Column({ default: 'pending_authorization' }) status: ExternalIdentityBindingStatus;

  @Column({ name: 'first_login_at', type: 'timestamptz' }) firstLoginAt: Date;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @Column({ name: 'last_seen_profile', type: 'jsonb', default: () => "'{}'" })
  lastSeenProfile: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
