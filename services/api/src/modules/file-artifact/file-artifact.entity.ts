import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// 通用上传器表：与「工程产物治理」表 file_artifacts(001) 解耦，独立 uploaded_files(008)。
@Entity('uploaded_files')
@Index(['tenantId', 'entityType', 'entityId'])
export class FileArtifactEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id',  type: 'varchar', nullable: true }) storeId:  string | null;
  @Column({ name: 'uploader_id', type: 'varchar', nullable: true }) uploaderId: string | null;
  @Column({ name: 'entity_type' }) entityType: string;  // 'customer'|'opportunity'|'floor_plan'|...
  @Column({ name: 'entity_id' }) entityId: string;
  @Column({ name: 'file_key' }) fileKey: string;        // S3/OSS object key
  @Column({ name: 'original_name' }) originalName: string;
  @Column({ name: 'mime_type', type: 'varchar', nullable: true }) mimeType: string | null;
  @Column({ name: 'size_bytes', type: 'bigint', default: 0 }) sizeBytes: number;
  @Column({ default: 'active' }) status: string;
  @CreateDateColumn({ name: 'created_at' }) @Index() createdAt: Date;
}
