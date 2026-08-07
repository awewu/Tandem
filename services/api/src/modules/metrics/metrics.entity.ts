import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'metric_daily_rollup' })
export class MetricDailyRollupEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'date' }) day: string;
  @Column({ default: 'unknown' }) channel: string;
  @Column({ type: 'int', default: 0 }) reach: number;
  @Column({ type: 'int', default: 0 }) lead: number;
  @Column({ type: 'int', default: 0 }) visit: number;
  @Column({ type: 'int', default: 0 }) proposal: number;
  @Column({ type: 'int', default: 0 }) revenue: number;
  @Column({ type: 'int', default: 0 }) referral: number;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'metric_channel_attribution' })
export class MetricChannelAttributionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() period: string;
  @Column() model: string;
  @Column() channel: string;
  @Column({ name: 'credited_conversions', type: 'numeric', default: 0 }) creditedConversions: number;
  @Column({ type: 'int', default: 0 }) touches: number;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
