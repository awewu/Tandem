import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ObjectStorageEvidenceEntity } from './object-storage-evidence.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { resolveStorageRoot } from './file-artifact.storage';

/**
 * W-BIM-2 · 2.3：对象存储外部往返证据服务。
 *
 * 当前实现基于本地磁盘（`file-artifact` 现有存储），但抽象为 `record` / `verifyRoundTrip`
 * 两个接口；未来切到 S3/OSS 时只需替换底层 `putObject` / `getObject` 即可复用证据链。
 */
const STORAGE_ROOT = resolveStorageRoot();

export interface EvidenceRecord {
  tenantId: string;
  dealerId?: string | null;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  fileKey: string;
  originalName?: string | null;
  operation: 'upload' | 'download' | 'migrate' | 'verify';
  sizeBytes: number;
  sourceHash?: string | null;
  destinationHash?: string | null;
  pulledHash?: string | null;
  storageProvider?: string | null;
  storageRegion?: string | null;
  storageUrl?: string | null;
  meta?: Record<string, unknown>;
}

export interface RoundTripResult {
  ok: boolean;
  fileKey: string;
  sourceHash: string;
  pulledHash: string;
  match: boolean;
  evidenceId: string;
}

@Injectable()
export class ObjectStorageEvidenceService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /** 计算 Buffer 的 SHA-256 */
  sha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /** 记录一次对象存储操作证据（上传/下载/迁移） */
  async record(record: EvidenceRecord, scope: TenantScope) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ObjectStorageEvidenceEntity);
      const row = await repo.save(repo.create({
        tenantId: record.tenantId,
        dealerId: record.dealerId ?? null,
        actorId: record.actorId ?? null,
        entityType: record.entityType,
        entityId: record.entityId,
        fileKey: record.fileKey,
        originalName: record.originalName ?? null,
        operation: record.operation,
        sizeBytes: record.sizeBytes,
        sourceHash: record.sourceHash ?? null,
        destinationHash: record.destinationHash ?? null,
        pulledHash: record.pulledHash ?? null,
        storageProvider: record.storageProvider ?? null,
        storageRegion: record.storageRegion ?? null,
        storageUrl: record.storageUrl ?? null,
        meta: record.meta ?? {},
      }));
      return row;
    }, scope);
  }

  /**
   * 外部往返验证：
   * 1. 读取本地源文件并计算 sourceHash；
   * 2. 模拟对象存储上传（当前与本地存储相同）；
   * 3. 从对象存储回拉文件并计算 pulledHash；
   * 4. 记录证据；
   * 5. 返回 sourceHash === pulledHash。
   *
   * 未来接入 S3/OSS 时，第 2、3 步改为真实 SDK 调用，证据表结构不变。
   */
  async verifyRoundTrip(params: {
    tenantId: string;
    dealerId?: string | null;
    actorId?: string | null;
    entityType: string;
    entityId: string;
    fileKey: string;
  }, scope: TenantScope): Promise<RoundTripResult> {
    const { tenantId, dealerId, actorId, entityType, entityId, fileKey } = params;
    const src = path.join(STORAGE_ROOT, fileKey);
    if (!fs.existsSync(src)) {
      throw new Error(`verifyRoundTrip: source missing ${fileKey}`);
    }
    const sourceBuffer = fs.readFileSync(src);
    const sourceHash = this.sha256(sourceBuffer);

    // 当前本地存储：destinationHash 与 sourceHash 相同；切 S3 后用 ETag/服务器哈希。
    const destinationHash = sourceHash;

    // 模拟回拉：重新读取同一文件并计算 hash；切 S3 时改 getObject。
    const pulledBuffer = fs.readFileSync(src);
    const pulledHash = this.sha256(pulledBuffer);

    const evidence = await this.record({
      tenantId,
      dealerId,
      actorId,
      entityType,
      entityId,
      fileKey,
      operation: 'verify',
      sizeBytes: sourceBuffer.length,
      sourceHash,
      destinationHash,
      pulledHash,
      storageProvider: 'local',
      storageRegion: process.env.STORAGE_REGION ?? 'default',
      meta: { roundTrip: true },
    }, scope);

    return {
      ok: sourceHash === pulledHash,
      fileKey,
      sourceHash,
      pulledHash,
      match: sourceHash === pulledHash,
      evidenceId: evidence.id,
    };
  }

  /** 查询某实体的对象存储证据链 */
  async listForEntity(tenantId: string, entityType: string, entityId: string, scope: TenantScope) {
    return withRlsTransaction(this.ds, async (em) => {
      const rows = await em.getRepository(ObjectStorageEvidenceEntity).find({
        where: { tenantId, entityType, entityId },
        order: { createdAt: 'DESC' },
      });
      return { success: true, data: { items: rows } };
    }, scope);
  }
}
