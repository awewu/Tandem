import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'channel_partner' })
export class ChannelPartnerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() code: string;
  @Column() name: string;
  @Column({ default: 'prospect' }) tier: string;
  @Column({ type: 'varchar', nullable: true }) region: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) categories: string[];
  @Column({ default: false }) certified: boolean;
  @Column({ default: 'recruiting' }) status: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) contact: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'channel_rebate' })
export class ChannelRebateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'partner_id', type: 'uuid', nullable: true }) partnerId: string | null;
  @Column() period: string;
  @Column() basis: string;
  @Column({ type: 'numeric', default: 0 }) amount: number;
  @Column({ name: 'margin_calc', type: 'jsonb', default: () => "'{}'::jsonb" }) marginCalc: Record<string, unknown>;
  @Column({ default: 'submitted' }) status: string;
  @Column({ type: 'varchar', nullable: true }) approver: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'channel_performance' })
export class ChannelPerformanceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'partner_id', type: 'uuid', nullable: true }) partnerId: string | null;
  @Column() period: string;
  @Column({ type: 'numeric', default: 0 }) gmv: number;
  @Column({ default: 0 }) deals: number;
  @Column({ name: 'sell_through', type: 'numeric', default: 0 }) sellThrough: number;
  @Column({ name: 'active_profitable', default: false }) activeProfitable: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}
