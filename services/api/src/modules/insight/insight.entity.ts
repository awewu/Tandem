import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'insight_competitor' })
export class InsightCompetitorEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() @Index() category: string;
  @Column() competitor: string;
  @Column() dimension: string;
  @Column() metric: string;
  @Column({ type: 'numeric', nullable: true }) value: number | null;
  @Column({ name: 'value_text', type: 'varchar', nullable: true }) valueText: string | null;
  @Column({ type: 'varchar', nullable: true }) source: string | null;
  /** 是否我方品牌（迁移 091）：份额/头部差距需要我方参照系，否则份额只是"竞品之间的份额" */
  @Column({ name: 'is_self', type: 'boolean', default: false }) isSelf: boolean;
  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' }) capturedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'insight_signal' })
export class InsightSignalEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ name: 'signal_type' }) signalType: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) summary: string | null;
  @Column({ type: 'varchar', nullable: true }) source: string | null;
  @Column({ default: 'info' }) severity: string;
  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' }) capturedAt: Date;
}
