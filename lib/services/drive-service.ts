import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/domain/errors';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import { presignUpload, presignDownload, deleteObject, getS3, BUCKET_DRIVE } from '@/lib/infra/s3-client';
import { generateId } from '@/lib/storage/repository';

export interface CreateDriveFileCommand {
  name: string;
  mimeType?: string;
  size?: number;
  parentId?: string | null;
  ownerId: string;
  tenantId?: string;
  storageKey: string;
  isFolder?: boolean;
}

export class DriveService {
  constructor(private ctx: ApplicationContext) {}

  async list(opts?: { parentId?: string | null; ownerId?: string; tenantId?: string }): Promise<DriveFile[]> {
    return this.ctx.driveRepo.list(opts);
  }

  async getById(id: string): Promise<DriveFile | null> {
    return this.ctx.driveRepo.findById(id);
  }

  async create(cmd: CreateDriveFileCommand): Promise<DriveFile> {
    if (!cmd.name.trim()) throw new ValidationError('name is required');
    return this.ctx.driveRepo.create({
      name: cmd.name.trim(),
      mimeType: cmd.mimeType ?? 'application/octet-stream',
      size: cmd.size ?? 0,
      parentId: cmd.parentId ?? null,
      ownerId: cmd.ownerId,
      tenantId: cmd.tenantId ?? 'default',
      storageKey: cmd.storageKey,
      storageUrl: null,
      permissions: { read: [cmd.ownerId] },
      version: 1,
      isFolder: cmd.isFolder ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string, actorId: string): Promise<void> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (f.ownerId !== actorId) throw new ForbiddenError('Only owner can delete');
    await this.ctx.driveRepo.softDelete(id);
    // §T6 软删后异步清理 S3 (失败不阻塞业务)
    if (!f.isFolder && f.storageKey && getS3()) {
      deleteObject(f.storageKey).catch(() => {/* swallow, retry via cron */});
    }
  }

  async move(id: string, parentId: string | null, actorId: string): Promise<DriveFile> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (f.ownerId !== actorId) throw new ForbiddenError();
    return this.ctx.driveRepo.move(id, parentId);
  }

  /**
   * 申请上传 URL · 返回预签名 PUT URL + 待回调 storageKey.
   * 客户端: PUT 文件到 uploadUrl, 然后 POST /api/drive 提交元数据 (用 storageKey).
   */
  async requestUpload(opts: {
    ownerId: string;
    fileName: string;
    contentType?: string;
    tenantId?: string;
  }): Promise<{ uploadUrl: string; storageKey: string; bucket: string; expiresInSec: number }> {
    if (!getS3()) throw new ValidationError('object storage not configured');
    const tenantId = opts.tenantId ?? 'default';
    const safeName = opts.fileName.replace(/[^\w.\-]/g, '_').slice(0, 200);
    const storageKey = `${tenantId}/${opts.ownerId}/${Date.now()}-${generateId()}-${safeName}`;
    const uploadUrl = await presignUpload(storageKey, {
      contentType: opts.contentType,
      expiresInSec: 900,
    });
    return { uploadUrl, storageKey, bucket: BUCKET_DRIVE, expiresInSec: 900 };
  }

  /** 申请下载 URL · 校验权限后返回预签名 GET URL. */
  async requestDownload(id: string, actorId: string): Promise<{ url: string; expiresInSec: number }> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (f.isFolder) throw new ValidationError('folders cannot be downloaded');
    const allowed =
      f.ownerId === actorId || (f.permissions?.read ?? []).includes(actorId);
    if (!allowed) throw new ForbiddenError('No read permission');
    if (!getS3()) throw new ValidationError('object storage not configured');
    const url = await presignDownload(f.storageKey, { expiresInSec: 900 });
    return { url, expiresInSec: 900 };
  }
}
