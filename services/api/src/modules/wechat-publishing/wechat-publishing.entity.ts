import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('wechat_official_accounts')
@Index(['tenantId', 'appId'], { unique: true })
@Index(['tenantId', 'brandId'])
export class WechatOfficialAccountEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'brand_id', type: 'varchar' }) brandId: string;
  @Column({ name: 'display_name', type: 'varchar' }) displayName: string;
  @Column({ name: 'app_id', type: 'varchar' }) appId: string;
  @Column({ name: 'original_id', type: 'varchar', nullable: true }) originalId: string | null;
  @Column({ name: 'app_secret_ciphertext', type: 'text' }) appSecretCiphertext: string;
  @Column({ type: 'varchar', default: 'disabled' }) status: 'enabled' | 'disabled';
  @Column({ name: 'connection_status', type: 'varchar', default: 'untested' }) connectionStatus:
    | 'untested'
    | 'normal'
    | 'credential_error'
    | 'permission_error'
    | 'ip_whitelist_error'
    | 'temporary_error';
  @Column({ name: 'last_tested_at', type: 'timestamptz', nullable: true }) lastTestedAt: Date | null;
  @Column({ name: 'last_successful_sync_at', type: 'timestamptz', nullable: true }) lastSuccessfulSyncAt: Date | null;
  @Column({ name: 'connection_error_summary', type: 'text', nullable: true }) connectionErrorSummary: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('wechat_content_review_versions')
@Index(['tenantId', 'sourceContentId'])
@Index(['tenantId', 'reviewStatus'])
export class WechatContentReviewVersionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'source_content_id', type: 'varchar' }) sourceContentId: string;
  @Column({ name: 'version_no', type: 'int' }) versionNo: number;
  @Column({ name: 'review_status', type: 'varchar', default: 'pending_review' }) reviewStatus:
    | 'editing'
    | 'pending_review'
    | 'changes_requested'
    | 'approved'
    | 'voided';
  @Column({ name: 'wechat_payload', type: 'jsonb' }) wechatPayload: Record<string, unknown>;
  @Column({ name: 'review_content_hash', type: 'varchar' }) reviewContentHash: string;
  @Column({ name: 'wechat_payload_hash', type: 'varchar' }) wechatPayloadHash: string;
  @Column({ name: 'asset_snapshots', type: 'jsonb', default: [] }) assetSnapshots: Array<Record<string, unknown>>;
  @Column({ name: 'target_snapshot', type: 'jsonb' }) targetSnapshot: Record<string, unknown>;
  @Column({ name: 'submitter_id', type: 'uuid' }) submitterId: string;
  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true }) reviewerId: string | null;
  @Column({ name: 'review_comment', type: 'text', nullable: true }) reviewComment: string | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', default: () => 'now()' }) submittedAt: Date;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('wechat_draft_sync_tasks')
@Index(['tenantId', 'syncStatus'])
@Index(['tenantId', 'reviewVersionId'], { unique: true })
export class WechatDraftSyncTaskEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'review_version_id', type: 'uuid' }) reviewVersionId: string;
  @Column({ name: 'account_id', type: 'uuid' }) accountId: string;
  @Column({ name: 'idempotency_key', type: 'varchar', unique: true }) idempotencyKey: string;
  @Column({ name: 'sync_status', type: 'varchar', default: 'queued' }) syncStatus:
    | 'not_started'
    | 'queued'
    | 'syncing'
    | 'succeeded'
    | 'failed'
    | 'unconfirmed'
    | 'superseded';
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'wechat_draft_id', type: 'varchar', nullable: true }) wechatDraftId: string | null;
  @Column({ name: 'material_mapping', type: 'jsonb', default: {} }) materialMapping: Record<string, unknown>;
  @Column({ name: 'error_type', type: 'varchar', nullable: true }) errorType: string | null;
  @Column({ name: 'error_summary', type: 'text', nullable: true }) errorSummary: string | null;
  @Column({ name: 'trace_id', type: 'varchar', nullable: true }) traceId: string | null;
  @Column({ name: 'manual_handler_id', type: 'uuid', nullable: true }) manualHandlerId: string | null;
  @Column({ name: 'manual_handled_at', type: 'timestamptz', nullable: true }) manualHandledAt: Date | null;
  @Column({ name: 'manual_note', type: 'text', nullable: true }) manualNote: string | null;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('wechat_publish_audit_events')
@Index(['tenantId', 'objectType', 'objectId'])
export class WechatPublishAuditEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id', type: 'uuid' }) tenantId: string;
  @Column({ name: 'actor_id', type: 'uuid', nullable: true }) actorId: string | null;
  @Column({ name: 'event_type', type: 'varchar' }) eventType: string;
  @Column({ name: 'object_type', type: 'varchar' }) objectType: string;
  @Column({ name: 'object_id', type: 'uuid' }) objectId: string;
  @Column({ name: 'before_state', type: 'jsonb', nullable: true }) beforeState: Record<string, unknown> | null;
  @Column({ name: 'after_state', type: 'jsonb', nullable: true }) afterState: Record<string, unknown> | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

export const WECHAT_PUBLISHING_ENTITIES = [
  WechatOfficialAccountEntity,
  WechatContentReviewVersionEntity,
  WechatDraftSyncTaskEntity,
  WechatPublishAuditEventEntity,
];
