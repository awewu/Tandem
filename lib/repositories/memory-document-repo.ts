import type { DocumentRepository } from './document-repo';
import type { Document } from '@/lib/types/feishu-catchup';

let _id = 0;
const genId = () => `doc_${++_id}_${Date.now()}`;

export class InMemoryDocumentRepository implements DocumentRepository {
  private data = new Map<string, Document>();

  async findById(id: string): Promise<Document | null> { return this.data.get(id) ?? null; }
  async findByOwner(ownerId: string): Promise<Document[]> { return Array.from(this.data.values()).filter(d => d.ownerId === ownerId && !d.deletedAt); }
  async findByTenant(tenantId: string): Promise<Document[]> { return Array.from(this.data.values()).filter(d => d.tenantId === tenantId && !d.deletedAt); }
  async create(draft: Omit<Document, 'id'> & { id?: string }): Promise<Document> {
    const doc = { ...(draft as Document), id: draft.id ?? genId() };
    this.data.set(doc.id, doc);
    return doc;
  }
  async updateTitle(id: string, title: string): Promise<Document> {
    const d = this.data.get(id); if (!d) throw new Error('not found');
    d.title = title; d.updatedAt = new Date().toISOString(); return d;
  }
  async updateContent(id: string, content: string): Promise<Document> {
    const d = this.data.get(id); if (!d) throw new Error('not found');
    d.content = content; d.updatedAt = new Date().toISOString(); return d;
  }
  async updatePermissions(id: string, permissions: Document['permissions']): Promise<Document> {
    const d = this.data.get(id); if (!d) throw new Error('not found');
    d.permissions = permissions; d.updatedAt = new Date().toISOString(); return d;
  }
  async lock(id: string): Promise<Document> {
    const d = this.data.get(id); if (!d) throw new Error('not found');
    d.isLocked = true; d.updatedAt = new Date().toISOString(); return d;
  }
  async unlock(id: string): Promise<Document> {
    const d = this.data.get(id); if (!d) throw new Error('not found');
    d.isLocked = false; d.updatedAt = new Date().toISOString(); return d;
  }
  async softDelete(id: string): Promise<void> {
    const d = this.data.get(id); if (d) { d.deletedAt = new Date().toISOString(); }
  }
  async list(filter?: { ownerId?: string; tenantId?: string }): Promise<Document[]> {
    let arr = Array.from(this.data.values()).filter(d => !d.deletedAt);
    if (filter?.ownerId) arr = arr.filter(d => d.ownerId === filter.ownerId);
    if (filter?.tenantId) arr = arr.filter(d => d.tenantId === filter.tenantId);
    return arr;
  }
}
