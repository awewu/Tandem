import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FileArtifactEntity } from './file-artifact.entity';
import { ObjectStorageEvidenceService } from './object-storage-evidence.service';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { artifactBase64Url, artifactContentUrl, resolveStorageRoot } from './file-artifact.storage';

const STORAGE_ROOT = resolveStorageRoot();
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

@Injectable()
export class FileArtifactService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly evidence: ObjectStorageEvidenceService,
  ) {}

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId ?? undefined, role: user.role };
  }

  /** Save a buffer to disk and record in DB. Returns the artifact row. */
  async save(user: JwtPayload, opts: {
    entityType: string;
    entityId: string;
    originalName: string;
    mimeType?: string;
    buffer: Buffer;
  }) {
    this.assertUpload(opts);
    const ext = path.extname(opts.originalName) || '';
    const key = `${user.tenantId}/${opts.entityType}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const dest = path.join(STORAGE_ROOT, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, opts.buffer);

    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(FileArtifactEntity);
      const artifact = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        uploaderId: user.userId ?? null,
        entityType: opts.entityType,
        entityId: opts.entityId,
        fileKey: key,
        originalName: opts.originalName,
        mimeType: opts.mimeType ?? null,
        sizeBytes: opts.buffer.length,
      });
      const saved = await repo.save(artifact);
      // W-BIM-2 · 2.3：对象存储上传证据
      await this.evidence.record({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        actorId: user.userId ?? null,
        entityType: opts.entityType,
        entityId: opts.entityId,
        fileKey: key,
        originalName: opts.originalName,
        operation: 'upload',
        sizeBytes: opts.buffer.length,
        sourceHash: this.evidence.sha256(opts.buffer),
        destinationHash: this.evidence.sha256(opts.buffer),
        storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
        storageRegion: process.env.STORAGE_REGION ?? 'default',
        meta: { uploadedVia: 'file-artifact' },
      }, this.rls(user));
      return { success: true, data: this.toView(saved) };
    }, this.rls(user));
  }

  /**
   * Fastify 安全的 base64 上传：绕开 @nestjs/platform-express 的 FileInterceptor
   * （在 Fastify 适配器下不生效，返回 415）。供品牌产品图等 ops 脚本写入 DAM。
   */
  async saveBase64(user: JwtPayload, opts: {
    entityType: string;
    entityId: string;
    filename: string;
    mimeType?: string;
    dataBase64: string;
  }) {
    const buffer = Buffer.from(this.normalizeBase64(opts.dataBase64), 'base64');
    return this.save(user, {
      entityType: opts.entityType,
      entityId: opts.entityId,
      originalName: opts.filename,
      mimeType: opts.mimeType,
      buffer,
    });
  }

  /**
   * Fastify 安全的按 id 读取：以 base64 JSON 返回原始字节（不走 stream/@Res，
   * 后者在 Fastify 下同样不生效）。供构建期发布管线用 ops 令牌拉取。
   */
  async getBase64ById(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(FileArtifactEntity).createQueryBuilder('f')
        .where('f.id = :id', { id })
        .andWhere('f.tenantId = :t', { t: user.tenantId })
        .andWhere('f.status = :s', { s: 'active' });
      // dealer 级归属（文件无 store 维度 → 门店级退化为 dealer 级，与 scope.ts 一致）；
      // 旧/HQ 记录 dealer_id 为空视为共享，不隐藏；新上传一律 stamp，隔离随时间增强。
      if (user.dealerId) qb.andWhere('(f.dealerId = :d OR f.dealerId IS NULL)', { d: user.dealerId });
      const row = await qb.getOne();
      if (!row) return { success: false, error: 'not found' };
      const p = path.join(STORAGE_ROOT, row.fileKey);
      if (!fs.existsSync(p)) return { success: false, error: 'blob missing' };
      const pulledBuffer = fs.readFileSync(p);
      const pulledHash = this.evidence.sha256(pulledBuffer);
      // W-BIM-2 · 2.3：对象存储下载/回拉证据
      await this.evidence.record({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        actorId: user.userId ?? null,
        entityType: row.entityType,
        entityId: row.entityId,
        fileKey: row.fileKey,
        originalName: row.originalName,
        operation: 'download',
        sizeBytes: pulledBuffer.length,
        pulledHash,
        destinationHash: pulledHash,
        storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
        storageRegion: process.env.STORAGE_REGION ?? 'default',
        meta: { downloadedVia: 'file-artifact' },
      }, this.rls(user));
      return {
        success: true,
        data: {
          ...this.toView(row),
          fileKey: row.fileKey,
          originalName: row.originalName,
          mimeType: row.mimeType,
          sizeBytes: Number(row.sizeBytes),
          entityType: row.entityType,
          entityId: row.entityId,
          dataBase64: pulledBuffer.toString('base64'),
        },
      };
    }, this.rls(user));
  }

  /** List artifacts for an entity. */
  async list(user: JwtPayload, entityType: string, entityId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(FileArtifactEntity).createQueryBuilder('f')
        .where('f.tenantId = :t', { t: user.tenantId })
        .andWhere('f.entityType = :et', { et: entityType })
        .andWhere('f.entityId = :ei', { ei: entityId })
        .andWhere('f.status = :s', { s: 'active' });
      if (user.dealerId) qb.andWhere('(f.dealerId = :d OR f.dealerId IS NULL)', { d: user.dealerId });
      const items = await qb.orderBy('f.createdAt', 'DESC').getMany();
      return { success: true, data: { items } };
    }, this.rls(user));
  }

  async getPublicActiveArtifact(tenantId: string, id: string) {
    const load = async (em: import('typeorm').EntityManager) => {
      const row = await em.getRepository(FileArtifactEntity).findOne({
        where: { id, tenantId, status: 'active' } as any,
      });
      if (!row) return null;
      const stream = this.getStream(row.fileKey);
      if (!stream) return null;
      return { row, stream };
    };
    if (UUID_RE.test(tenantId)) {
      return withRlsTransaction(
        this.ds,
        load,
        { tenantId, actorId: 'public-brand-site', role: 'public' } as TenantScope,
      );
    }
    return load(this.ds.manager);
  }

  /** Return a readable stream for download. */
  getStream(fileKey: string) {
    const p = path.join(STORAGE_ROOT, fileKey);
    if (!fs.existsSync(p)) return null;
    return fs.createReadStream(p);
  }

  async getReadableById(user: JwtPayload, id: string) {
    const artifact = await this.getBase64ById(user, id);
    if (!artifact.success || !artifact.data) return null;
    return {
      row: artifact.data,
      buffer: Buffer.from(String(artifact.data.dataBase64 || ''), 'base64'),
    };
  }

  /** Soft-delete. */
  async remove(user: JwtPayload, id: string) {
    await withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(FileArtifactEntity).createQueryBuilder()
        .update(FileArtifactEntity).set({ status: 'deleted' })
        .where('id = :id', { id })
        .andWhere('tenant_id = :t', { t: user.tenantId });
      if (user.dealerId) qb.andWhere('(dealer_id = :d OR dealer_id IS NULL)', { d: user.dealerId });
      return qb.execute();
    }, this.rls(user));
    return { success: true };
  }

  private normalizeBase64(value: string) {
    return String(value || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  }

  private maxBytes() {
    const configured = Number(process.env.FILE_ARTIFACT_MAX_BYTES || DEFAULT_MAX_BYTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
  }

  private assertUpload(opts: { originalName: string; mimeType?: string; buffer: Buffer }) {
    const filename = String(opts.originalName || '').trim();
    if (!filename) throw new BadRequestException('filename is required');
    if (filename.includes('\0')) throw new BadRequestException('filename is invalid');
    if (!opts.buffer?.length) throw new BadRequestException('file cannot be empty');
    if (opts.buffer.length > this.maxBytes()) {
      throw new BadRequestException(`file exceeds max size ${this.maxBytes()} bytes`);
    }
    const mime = String(opts.mimeType || '').toLowerCase();
    if (mime && /[\r\n]/.test(mime)) throw new BadRequestException('mimeType is invalid');
  }

  private toView(row: FileArtifactEntity) {
    return {
      ...row,
      contentUrl: artifactContentUrl(row.id),
      base64Url: artifactBase64Url(row.id),
    };
  }
}
