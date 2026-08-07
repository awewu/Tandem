import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'positioning_house' })
export class PositioningHouseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_code' }) brandCode: string;
  @Column() category: string;
  @Column({ type: 'text', nullable: true }) promise: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) pillars: Array<{ title: string; desc?: string }>;
  @Column({ name: 'proof_points', type: 'jsonb', default: () => "'[]'::jsonb" }) proofPoints: Array<{ claim: string; evidence?: string }>;
  @Column({ name: 'target_segments', type: 'jsonb', default: () => "'[]'::jsonb" }) targetSegments: unknown[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) differentiation: Array<{ competitor: string; edge?: string }>;
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'varchar', nullable: true }) approver: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
