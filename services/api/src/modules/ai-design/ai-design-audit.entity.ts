import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Sprint 4.6 · AI 设计审计链
 *
 * 记录每一次 AI 设计调用的输入、输出、模型/算法版本、校验闸状态、人审角色，
 * 形成可辩护的审计链。当前为最小可运行结构，后续随 LLM/算法升级扩展字段。
 */

@Entity('ai_design_audits')
@Index(['tenantId', 'projectId'])
@Index(['tenantId', 'createdAt'])
export class AiDesignAuditEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'project_id' }) projectId: string;
  @Column({ name: 'user_id', type: 'varchar', nullable: true }) userId: string | null;
  @Column({ name: 'user_role', type: 'varchar', nullable: true }) userRole: string | null;

  @Column({ name: 'action_type' }) actionType: 'propose' | 'verify' | 'review' | 'select-quote';

  @Column({ type: 'jsonb', default: {} }) input: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) output: Record<string, unknown>;

  @Column({ name: 'trust_state', type: 'varchar', nullable: true }) trustState: string | null;
  @Column({ name: 'model_version', type: 'varchar', nullable: true }) modelVersion: string | null;
  @Column({ name: 'kernel_version', type: 'varchar', nullable: true }) kernelVersion: string | null;
  @Column({ name: 'gate_status', type: 'varchar', nullable: true }) gateStatus: string | null;

  @Column({ name: 'reviewed_by', type: 'varchar', nullable: true }) reviewedBy: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
