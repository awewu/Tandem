import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('diagnosis_sessions')
@Index(['tenantId', 'customerId'])
export class DiagnosisSessionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'customer_id', type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ name: 'opportunity_id', type: 'varchar', nullable: true }) opportunityId: string | null;
  // 项目主线锚点（P0 可空；P2 收紧 NOT NULL）。见 docs/PROJECT-SPINE-DATA-MODEL-DESIGN.md。
  @Column({ name: 'project_id', type: 'varchar', nullable: true }) projectId: string | null;
  @Column({ name: 'report_id', type: 'varchar', nullable: true }) reportId: string | null;
  @Column({ type: 'jsonb', default: [] }) pain_points: string[];
  @Column({ type: 'jsonb', default: [] }) systems: string[];
  @Column({ name: 'recommended_tier', type: 'varchar', nullable: true }) recommendedTier: string | null;
  @Column({ type: 'jsonb', default: {} }) solutions: Record<string, unknown>;
  @Column({ name: 'ai_reasoning', type: 'text', nullable: true }) aiReasoning: string | null;
  @Column({ name: 'share_token_hash', type: 'varchar', nullable: true }) shareTokenHash: string | null;
  @Column({ name: 'consent_id', type: 'varchar', nullable: true }) consentId: string | null;
  @Column({ default: 'active' }) @Index() status: string;
  @Column({ name: 'source_surface', type: 'varchar', default: 'consumer-diagnosis' }) sourceSurface: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
