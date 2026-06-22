/**
 * Tests fixtures · Document domain (DOC-2 升级 Memory / DOC-4 议事反链)
 *
 * 抽自重复的 seedDoc 定义 (原散落在 document-promotion / document-spawn-decision).
 *
 * 调用方:
 *   import { seedDoc, resetDocStore } from '../fixtures/document';
 *   beforeEach(async () => { await resetDocStore(); });
 *   await seedDoc({ id: 'doc_1', ownerId: 'alice', title: 'Q3 复盘' });
 *
 * 设计原则:
 *   - 直接走 store.documents.create (因为这两个测试都需 store + service 集成)
 *   - resetDocStore 清空, 配合 beforeEach 隔离测试
 *   - 必填: id / title / ownerId, 其余有默认值
 */

import { createAppContext } from '../../lib/repositories/app-context-factory';
import { getStore } from '../../lib/storage/repository';
import type { Document } from '../../lib/types/feishu-catchup';

/**
 * 创建并 store.create 一个测试文档.
 *
 * @example
 *   await seedDoc({ id: 'doc_1', ownerId: 'alice', title: 'Q3 复盘' });
 *   await seedDoc({ id: 'doc_dup', ownerId: 'alice', title: 'X', spawnedDecisionCardId: 'dc_old' });
 */
export async function seedDoc(
  p: Partial<Document> & { id: string; title: string; ownerId: string },
): Promise<Document> {
  const now = new Date().toISOString();
  const doc: Document = {
    id: p.id,
    title: p.title,
    content: p.content ?? '正文内容',
    type: p.type ?? 'doc',
    ownerId: p.ownerId,
    tenantId: p.tenantId ?? 'default',
    permissions: p.permissions ?? { read: [], write: [] },
    version: p.version ?? 1,
    isLocked: p.isLocked ?? false,
    createdAt: p.createdAt ?? now,
    updatedAt: p.updatedAt ?? now,
    ...(p.spawnedPromotionId ? { spawnedPromotionId: p.spawnedPromotionId } : {}),
    ...(p.spawnedDecisionCardId ? { spawnedDecisionCardId: p.spawnedDecisionCardId } : {}),
    ...(p.deletedAt !== undefined ? { deletedAt: p.deletedAt } : {}),
  };
  await createAppContext().documentRepo.create(doc);
  return doc;
}

/** 清空 documents 表 (canonical documentRepo). 用在 beforeEach 隔离测试. */
export async function resetDocStore(): Promise<void> {
  const { documentRepo } = createAppContext();
  for (const d of await documentRepo.list()) {
    await documentRepo.softDelete(d.id);
  }
}

/** 同时清 documents (documentRepo) + materials + promotions (DOC-2 升级测试用) */
export async function resetDocPromotionStores(): Promise<void> {
  const { documentRepo } = createAppContext();
  for (const d of await documentRepo.list()) await documentRepo.softDelete(d.id);
  const store = getStore();
  for (const m of await store.materials.list()) await store.materials.delete(m.id);
  for (const p of await store.promotions.list()) await store.promotions.delete(p.id);
}
