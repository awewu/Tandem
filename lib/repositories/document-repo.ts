/**
 * Document Repository Interface
 * §T3 宪章: 按业务语义拆分，禁止通用 CRUD
 */

import type { Document } from '@/lib/types/feishu-catchup';

export interface DocumentRepository {
  findById(id: string): Promise<Document | null>;
  findByOwner(ownerId: string): Promise<Document[]>;
  findByTenant(tenantId: string): Promise<Document[]>;
  create(draft: Omit<Document, 'id'> & { id?: string }): Promise<Document>;
  updateTitle(id: string, title: string): Promise<Document>;
  updateContent(id: string, content: string): Promise<Document>;
  updatePermissions(id: string, permissions: Document['permissions']): Promise<Document>;
  lock(id: string): Promise<Document>;
  unlock(id: string): Promise<Document>;
  setSpawnedPromotionId(id: string, promotionId: string): Promise<Document>;
  setSpawnedDecisionCardId(id: string, decisionCardId: string): Promise<Document>;
  softDelete(id: string): Promise<void>;
  list(filter?: { ownerId?: string; tenantId?: string }): Promise<Document[]>;
}
