/**
 * DOC-2 — 文档 → Memory 升级 服务层单测
 *
 * 覆盖核心场景:
 *   1. 成功路径: 创建 Material + Promotion + 反向写 spawnedPromotionId
 *   2. 文档不存在 → 抛 not found
 *   3. 已发起过升级 → 抛 "已发起过 Memory 升级" (防重)
 *   4. participants 包含 ownerId + triggeredBy + permissions.read/write 并去重
 *   5. proposedTitle 缺省回退到 doc.title
 *   6. originRefs 反链到 document:<id>
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { promoteDocumentToMemory } from '../../lib/services/document-promotion';
import { getStore, setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';
import { seedDoc, resetDocPromotionStores } from '../fixtures/document';

beforeAll(() => {
  setStore(createInMemoryStore());
});

const reset = resetDocPromotionStores;

beforeEach(async () => {
  await reset();
});

describe('promoteDocumentToMemory', () => {
  it('成功路径: 创建 Material + Promotion + 反写 spawnedPromotionId', async () => {
    await seedDoc({ id: 'doc_1', ownerId: 'alice', title: 'Q3 复盘心得' });

    const result = await promoteDocumentToMemory({
      documentId: 'doc_1',
      triggeredBy: 'alice',
      proposedType: 'lesson',
      level: 'team',
    });

    expect(result.documentId).toBe('doc_1');
    expect(result.materialId).toBeTruthy();
    expect(result.promotionId).toBeTruthy();

    const store = getStore();
    const doc = await store.documents.get('doc_1');
    expect(doc?.spawnedPromotionId).toBe(result.promotionId);

    const material = await store.materials.get(result.materialId);
    expect(material).toBeTruthy();
    expect(material?.originRefs).toEqual(['document:doc_1']);

    const promotion = await store.promotions.get(result.promotionId);
    expect(promotion?.materialId).toBe(result.materialId);
    expect(promotion?.proposedType).toBe('lesson');
    expect(promotion?.level).toBe('team');
    expect(promotion?.status).toBe('pending');
  });

  it('文档不存在 → 抛 not found', async () => {
    await expect(
      promoteDocumentToMemory({ documentId: 'doc_missing', triggeredBy: 'alice' }),
    ).rejects.toThrow(/not found/);
  });

  it('已发起过升级 → 拒绝重复 (防重)', async () => {
    await seedDoc({
      id: 'doc_dup',
      ownerId: 'alice',
      title: '已升级文档',
      spawnedPromotionId: 'promo_existing',
    });

    await expect(
      promoteDocumentToMemory({ documentId: 'doc_dup', triggeredBy: 'alice' }),
    ).rejects.toThrow(/已发起过 Memory 升级/);
  });

  it('participants 含 owner + triggeredBy + permissions.read/write 并去重', async () => {
    await seedDoc({
      id: 'doc_perm',
      ownerId: 'alice',
      title: '协作文档',
      permissions: { read: ['bob', 'alice'], write: ['carol'] },
    });

    const result = await promoteDocumentToMemory({
      documentId: 'doc_perm',
      triggeredBy: 'dave',
    });

    const store = getStore();
    const material = await store.materials.get(result.materialId);
    const participants = (material?.participants ?? []).slice().sort();
    expect(participants).toEqual(['alice', 'bob', 'carol', 'dave']);
  });

  it('缺省 proposedTitle 回退到 doc.title', async () => {
    await seedDoc({ id: 'doc_t', ownerId: 'alice', title: '原标题 X' });

    const result = await promoteDocumentToMemory({
      documentId: 'doc_t',
      triggeredBy: 'alice',
    });

    const store = getStore();
    const promotion = await store.promotions.get(result.promotionId);
    expect(promotion?.proposedTitle).toBe('原标题 X');
  });

  it('proposedType 缺省 = lesson', async () => {
    await seedDoc({ id: 'doc_type', ownerId: 'alice', title: '默认类型测试' });

    const result = await promoteDocumentToMemory({
      documentId: 'doc_type',
      triggeredBy: 'alice',
    });

    const store = getStore();
    const promotion = await store.promotions.get(result.promotionId);
    expect(promotion?.proposedType).toBe('lesson');
  });

  it('level 缺省 = team (最低门槛, 鼓励员工沉淀)', async () => {
    await seedDoc({ id: 'doc_l', ownerId: 'alice', title: '默认级别测试' });

    const result = await promoteDocumentToMemory({
      documentId: 'doc_l',
      triggeredBy: 'alice',
    });

    const store = getStore();
    const promotion = await store.promotions.get(result.promotionId);
    expect(promotion?.level).toBe('team');
  });

  it('proposedTitle 显式覆盖 doc.title', async () => {
    await seedDoc({ id: 'doc_o', ownerId: 'alice', title: '原始' });

    const result = await promoteDocumentToMemory({
      documentId: 'doc_o',
      triggeredBy: 'alice',
      proposedTitle: '我自定义的标题',
    });

    const store = getStore();
    const promotion = await store.promotions.get(result.promotionId);
    expect(promotion?.proposedTitle).toBe('我自定义的标题');
  });
});
