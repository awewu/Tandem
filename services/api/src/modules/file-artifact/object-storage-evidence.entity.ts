import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * W-BIM-2 · 2.3：对象存储外部往返证据。
 *
 * 记录「上传→对象存储→下载」的完整性校验链，用于：
 *  1. 迁移 legacy 产物到 NestJS 时证明对象存储可往返；
 *  2. 任何关键产物（BOM、出图、签章 PDF）的存证闭环；
 *  3. 审计：源哈希、目标哈希、回拉哈希三者是否一致。
 *
 * 字段语义：
 *  - operation: upload / download / migrate
 *  - sourceHash: 写入对象存储前本地计算的 SHA-256
 *  - destinationHash: 对象存储侧返回/确认的校验值（如 ETag 或服务器端哈希）
 *  - pulledHash: 从对象存储回拉后重新计算的 SHA-256，用于证明可往返
 */
@Entity('object_storage_evidence')
@Index(['tenantId', 'entityType', 'entityId'])
@Index(['tenantId', 'fileKey'])
export class ObjectStorageEvidenceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'actor_id', type: 'varchar', nullable: true }) actorId: string | null;

  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'entity_id' }) entityId: string;
  @Column({ name: 'file_key' }) fileKey: string;
  @Column({ name: 'original_name', type: 'varchar', nullable: true }) originalName: string | null;

  @Column({ name: 'operation', type: 'varchar', length: 20 }) operation: 'upload' | 'download' | 'migrate' | 'verify';
  @Column({ name: 'size_bytes', type: 'bigint', default: 0 }) sizeBytes: number;

  @Column({ name: 'source_hash', type: 'varchar', length: 64, nullable: true }) sourceHash: string | null;
  @Column({ name: 'destination_hash', type: 'varchar', length: 64, nullable: true }) destinationHash: string | null;
  @Column({ name: 'pulled_hash', type: 'varchar', length: 64, nullable: true }) pulledHash: string | null;

  @Column({ name: 'storage_provider', type: 'varchar', length: 32, nullable: true }) storageProvider: string | null;
  @Column({ name: 'storage_region', type: 'varchar', length: 32, nullable: true }) storageRegion: string | null;
  @Column({ name: 'storage_url', type: 'text', nullable: true }) storageUrl: string | null;

  @Column({ type: 'jsonb', default: {} }) meta: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' }) @Index() createdAt: Date;
}
