import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/domain/errors';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import { ConflictError } from '@/lib/domain/errors';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import { presignUpload, presignDownload, deleteObject, getS3, BUCKET_DRIVE } from '@/lib/infra/s3-client';
import { generateId } from '@/lib/storage/repository';
import { canRead, canWrite, buildAncestorChain, type DriveAclUser } from '@/lib/drive/acl';

export interface CreateDriveFileCommand {
  name: string;
  mimeType?: string;
  size?: number;
  parentId?: string | null;
  ownerId?: string;
  tenantId?: string;
  storageKey: string;
  isFolder?: boolean;
}

export class DriveService {
  constructor(private ctx: ApplicationContext) {}

  /** 载入目标节点的祖先链 (自身在前) — 用于 ACL 继承解析. 一次性建租户索引, 避免 N+1. */
  private async loadChain(id: string, tenantId: string): Promise<DriveFile[]> {
    const all = await this.ctx.driveRepo.list({ tenantId });
    const byId = new Map(all.map((f) => [f.id, f]));
    return buildAncestorChain(id, byId);
  }

  private isAdmin(actor: DriveAclUser): boolean {
    return (actor.roles ?? []).some((r) => r === 'admin' || r === 'owner');
  }

  private isSystemManagedPersonalHome(file: DriveFile): boolean {
    return file.isFolder && file.nodeRole === 'personal_home';
  }

  /** 列出 parentId 下当前用户可读的子节点 (已经 ACL 过滤). */
  async list(
    opts: { parentId?: string | null; ownerId?: string; tenantId: string },
    actor: DriveAclUser,
  ): Promise<DriveFile[]> {
    const all = await this.ctx.driveRepo.list({ tenantId: opts.tenantId });
    const byId = new Map(all.map((f) => [f.id, f]));
    const inScope = all.filter((f) => {
      if (f.deletedAt) return false;
      if (opts.parentId !== undefined && (f.parentId ?? null) !== (opts.parentId ?? null)) return false;
      if (opts.ownerId && f.ownerId !== opts.ownerId) return false;
      return true;
    });
    return inScope.filter((f) => canRead(buildAncestorChain(f.id, byId), actor));
  }

  /** 搜索当前用户可读的云盘节点, rootId 用于限制在组织共享范围内。 */
  async search(
    opts: { query: string; tenantId: string; rootId?: string | null; ownerId?: string; limit?: number },
    actor: DriveAclUser,
  ): Promise<DriveFile[]> {
    const q = opts.query.trim().toLowerCase();
    if (!q) return [];
    const all = await this.ctx.driveRepo.list({ tenantId: opts.tenantId });
    const byId = new Map(all.map((f) => [f.id, f]));
    const limit = opts.limit ?? 100;
    const result: DriveFile[] = [];

    for (const f of all) {
      if (f.deletedAt) continue;
      const chain = buildAncestorChain(f.id, byId);
      if (opts.rootId && !chain.some((node) => node.id === opts.rootId)) continue;
      if (opts.ownerId && f.ownerId !== opts.ownerId) continue;
      const searchableText = [
        f.name,
        ...chain.slice(1).map((node) => node.name),
      ].join('\n').toLowerCase();
      if (!searchableText.includes(q)) continue;
      if (!canRead(chain, actor)) continue;
      result.push(f);
    }

    return result.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    }).slice(0, limit);
  }

  async getById(id: string, actor: DriveAclUser): Promise<DriveFile | null> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) return null;
    const chain = await this.loadChain(id, f.tenantId);
    if (!canRead(chain, actor)) throw new ForbiddenError('No read permission');
    return f;
  }

  /** 面包屑 (root → 目标) — 仅当用户对目标可读时返回, 否则 []. */
  async breadcrumbs(id: string, tenantId: string, actor: DriveAclUser): Promise<Array<{ id: string; name: string }>> {
    const chain = await this.loadChain(id, tenantId);
    if (chain.length === 0 || !canRead(chain, actor)) return [];
    // chain 自身在前, 反转为 root → 目标
    return chain.slice().reverse().map((f) => ({ id: f.id, name: f.name }));
  }

  async create(cmd: CreateDriveFileCommand, actor: DriveAclUser): Promise<DriveFile> {
    if (!cmd.name.trim()) throw new ValidationError('name is required');
    const tenantId = cmd.tenantId ?? 'default';
    const parentId = cmd.parentId ?? null;
    if (parentId) {
      const parentChain = await this.loadChain(parentId, tenantId);
      if (parentChain.length === 0) throw new NotFoundError('DriveFile', parentId);
      if (!canWrite(parentChain, actor)) throw new ForbiddenError('No write permission on parent');
    }
    return this.ctx.driveRepo.create({
      name: cmd.name.trim(),
      mimeType: cmd.mimeType ?? 'application/octet-stream',
      size: cmd.size ?? 0,
      parentId,
      ownerId: cmd.ownerId ?? actor.id,
      tenantId,
      storageKey: cmd.storageKey,
      storageUrl: null,
      permissions: {}, // 留空 = 继承父目录 ACL (owner 恒可读写)
      version: 1,
      isFolder: cmd.isFolder ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string, actor: DriveAclUser): Promise<void> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (!this.isAdmin(actor) && f.ownerId !== actor.id) {
      throw new ForbiddenError('Only admin or owner can delete drive files');
    }
    if (f.isFolder) {
      const children = await this.ctx.driveRepo.list({ parentId: id, tenantId: f.tenantId });
      if (children.some((child) => !child.deletedAt)) {
        throw new ConflictError('Folder is not empty');
      }
    }
    const chain = await this.loadChain(id, f.tenantId);
    if (!canWrite(chain, actor)) throw new ForbiddenError('No write permission');
    await this.ctx.driveRepo.softDelete(id);
    // §T6 软删后异步清理 S3 (失败不阻塞业务)
    if (!f.isFolder && f.storageKey && getS3()) {
      deleteObject(f.storageKey).catch(() => {/* swallow, retry via cron */});
    }
  }

  async move(id: string, parentId: string | null, actor: DriveAclUser): Promise<DriveFile> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (f.ownerId !== actor.id) {
      throw new ForbiddenError('Only owner can move drive files');
    }
    const chain = await this.loadChain(id, f.tenantId);
    if (!canWrite(chain, actor)) throw new ForbiddenError('No write permission');
    if (parentId) {
      if (parentId === id) throw new ValidationError('Cannot move folder into itself');
      const parentChain = await this.loadChain(parentId, f.tenantId);
      if (parentChain.length === 0) throw new NotFoundError('DriveFile', parentId);
      if (f.isFolder && parentChain.some((node) => node.id === id)) {
        throw new ValidationError('Cannot move folder into its child folder');
      }
      if (!canWrite(parentChain, actor)) throw new ForbiddenError('No write permission on target');
    }
    return this.ctx.driveRepo.move(id, parentId);
  }

  async rename(id: string, name: string, actor: DriveAclUser): Promise<DriveFile> {
    if (!name.trim()) throw new ValidationError('name is required');
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (this.isSystemManagedPersonalHome(f)) {
      throw new ForbiddenError('Personal home folders are managed by organization structure');
    }
    const chain = await this.loadChain(id, f.tenantId);
    if (f.ownerId !== actor.id && !canWrite(chain, actor)) throw new ForbiddenError('No write permission');
    return this.ctx.driveRepo.rename(id, name.trim());
  }

  /** 共享 (改 ACL) — 仅 owner 或 admin/owner 角色可改, 避免协作者篡改共享面. */
  async updatePermissions(
    id: string,
    permissions: DriveFile['permissions'],
    actor: DriveAclUser,
  ): Promise<DriveFile> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (f.ownerId !== actor.id && !this.isAdmin(actor)) {
      throw new ForbiddenError('Only owner or admin can change sharing');
    }
    return this.ctx.driveRepo.updatePermissions(id, permissions ?? {});
  }

  /**
   * 申请上传 URL · 返回预签名 PUT URL + 待回调 storageKey.
   * 客户端: PUT 文件到 uploadUrl, 然后 POST /api/drive 提交元数据 (用 storageKey).
   */
  async requestUpload(
    opts: { fileName: string; contentType?: string; tenantId?: string; parentId?: string | null },
    actor: DriveAclUser,
  ): Promise<{ uploadUrl: string; storageKey: string; bucket: string; expiresInSec: number }> {
    if (!getS3()) throw new ValidationError('object storage not configured');
    const tenantId = opts.tenantId ?? 'default';
    if (opts.parentId) {
      const parentChain = await this.loadChain(opts.parentId, tenantId);
      if (parentChain.length === 0) throw new NotFoundError('DriveFile', opts.parentId);
      if (!canWrite(parentChain, actor)) throw new ForbiddenError('No write permission on parent');
    }
    const safeName = opts.fileName.replace(/[^\w.\-]/g, '_').slice(0, 200);
    const storageKey = `${tenantId}/${actor.id}/${Date.now()}-${generateId()}-${safeName}`;
    const uploadUrl = await presignUpload(storageKey, {
      contentType: opts.contentType,
      expiresInSec: 900,
    });
    return { uploadUrl, storageKey, bucket: BUCKET_DRIVE, expiresInSec: 900 };
  }

  /** 申请下载 URL · 校验 ACL 后返回预签名 GET URL. */
  async requestDownload(id: string, actor: DriveAclUser): Promise<{ url: string; expiresInSec: number }> {
    const f = await this.ctx.driveRepo.findById(id);
    if (!f) throw new NotFoundError('DriveFile', id);
    if (f.isFolder) throw new ValidationError('folders cannot be downloaded');
    const chain = await this.loadChain(id, f.tenantId);
    if (!canRead(chain, actor)) throw new ForbiddenError('No read permission');
    if (!getS3()) throw new ValidationError('object storage not configured');
    const url = await presignDownload(f.storageKey, { expiresInSec: 900 });
    return { url, expiresInSec: 900 };
  }
}
