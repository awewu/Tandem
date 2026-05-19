/**
 * Document Service
 * §T1 宪章: Service 层处理业务用例 + 事务边界
 */

import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/domain/errors';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { Document } from '@/lib/types/feishu-catchup';

export interface CreateDocumentCommand {
  title: string;
  content?: string;
  type: 'doc' | 'sheet' | 'slide';
  ownerId: string;
  tenantId: string;
  permissions?: { read?: string[]; write?: string[] };
}

export interface UpdateDocumentCommand {
  title?: string;
  content?: string;
  permissions?: { read?: string[]; write?: string[] };
}

export class DocumentService {
  constructor(private ctx: ApplicationContext) {}

  async list(opts?: { ownerId?: string; tenantId?: string }): Promise<Document[]> {
    return this.ctx.documentRepo.list(opts);
  }

  async getById(id: string): Promise<Document | null> {
    return this.ctx.documentRepo.findById(id);
  }

  async create(cmd: CreateDocumentCommand): Promise<Document> {
    if (!cmd.title.trim()) throw new ValidationError('title is required');
    return this.ctx.documentRepo.create({
      title: cmd.title.trim(),
      content: cmd.content ?? '',
      type: cmd.type,
      ownerId: cmd.ownerId,
      tenantId: cmd.tenantId ?? 'default',
      permissions: cmd.permissions ?? { read: [cmd.ownerId], write: [cmd.ownerId] },
      version: 1,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async update(id: string, cmd: UpdateDocumentCommand, actorId: string): Promise<Document> {
    const doc = await this.ctx.documentRepo.findById(id);
    if (!doc) throw new NotFoundError('Document', id);
    this.assertCanWrite(doc, actorId);

    const patch: Partial<Document> = { updatedAt: new Date().toISOString() };
    if (cmd.title !== undefined) patch.title = cmd.title;
    if (cmd.content !== undefined) patch.content = cmd.content;
    if (cmd.permissions !== undefined) {
      return this.ctx.documentRepo.updatePermissions(id, { ...doc.permissions, ...cmd.permissions });
    }

    return this.ctx.documentRepo.create({ ...doc, ...patch } as any); // 临时，等完整 update
  }

  async delete(id: string, actorId: string): Promise<void> {
    const doc = await this.ctx.documentRepo.findById(id);
    if (!doc) throw new NotFoundError('Document', id);
    if (doc.ownerId !== actorId) throw new ForbiddenError('Only owner can delete');
    await this.ctx.documentRepo.softDelete(id);
  }

  private assertCanWrite(doc: Document, userId: string): void {
    const canWrite = doc.ownerId === userId || (doc.permissions?.write?.includes(userId) ?? false);
    if (!canWrite) throw new ForbiddenError('No write permission');
  }
}
