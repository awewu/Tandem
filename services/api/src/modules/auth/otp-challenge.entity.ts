import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 短信 OTP 挑战（预认证）。按 phone_hash 索引；code 仅存 bcrypt 哈希；短生命周期 + 一次性消费。
 */
@Entity('auth_otp_challenges')
@Index(['phoneHash', 'createdAt'])
export class OtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'phone_hash' }) phoneHash: string;
  @Column({ name: 'code_hash' }) codeHash: string;
  @Column({ default: 'login' }) purpose: string;
  @Column({ default: 0 }) attempts: number;

  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
