import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';

/**
 * M12 · design ↔ Rysnova 单一真相源同步账本（PRD 4.10）
 * 规则：
 *  - design 侧（DesignProject/FloorPlan/BOM/计算结果）为业务真相源。
 *  - Rysnova 深化产物 (RysnovaArtifact) 派生自某个 design 版本，登记于此账本。
 *  - design 变更 → 关联产物置 'stale'，须重做深化。
 *  - Rysnova 工程修正 → 以 'proposed_change' 回流，经确认后更新 design 并 re-sync，
 *    禁止两侧静默分叉。
 */
export type DesignSyncState = 'in_sync' | 'stale' | 'proposed_change';

@Entity('design_rysnova_bim_sync')
@Index(['tenantId', 'designId'])
@Index(['tenantId', 'artifactId'])
@Index(['tenantId', 'syncState'])
export class DesignSyncEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;

  // 真相源指针
  @Column({ name: 'design_id' }) designId: string;
  @Column({ name: 'design_version' }) designVersion: string;

  // 派生产物指针
  @Column({ name: 'artifact_id', type: 'varchar', nullable: true }) artifactId: string | null;
  @Column({ name: 'artifact_version', type: 'varchar', nullable: true }) artifactVersion: string | null;

  @Column({ name: 'sync_state', default: 'in_sync' }) syncState: DesignSyncState;

  // Rysnova 工程修正回流 design 的变更建议（proposed_change 时填）
  @Column({ name: 'change_proposal', type: 'jsonb', nullable: true }) changeProposal: Record<string, unknown> | null;
  @Column({ name: 'reviewed_by', type: 'varchar', nullable: true }) reviewedBy: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
