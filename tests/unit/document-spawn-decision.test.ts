/**
 * DOC-4 闭环单测 · convergence 创建后回写 document.spawnedDecisionCardId
 *
 * 因 store 层无独立 service (PATCH 逻辑在 route.ts 内联), 这里测纯逻辑:
 *   1. 文档不存在 → 404 语义 (返回 null)
 *   2. 已关联同一 cardId → 幂等 (alreadyLinked: true)
 *   3. 已关联不同 cardId → 拒绝 (409 语义)
 *   4. 未关联 → 写入 + 返回 alreadyLinked: false
 *   5. spawnedDecisionCardId 字段确实被持久化
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getStore, setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';
import type { Document } from '../../lib/types/feishu-catchup';

beforeAll(() => {
  setStore(createInMemoryStore());
});

async function reset() {
  const store = getStore();
  for (const d of await store.documents.list()) await store.documents.delete(d.id);
}

async function seedDoc(p: Partial<Document> & { id: string; title: string; ownerId: string }): Promise<Document> {
  const store = getStore();
  const now = new Date().toISOString();
  const doc: Document = {
    id: p.id,
    title: p.title,
    content: p.content ?? '正文',
    type: p.type ?? 'doc',
    ownerId: p.ownerId,
    tenantId: p.tenantId ?? 'default',
    permissions: p.permissions ?? { read: [], write: [] },
    version: 1,
    isLocked: false,
    createdAt: now,
    updatedAt: now,
    ...(p.spawnedDecisionCardId ? { spawnedDecisionCardId: p.spawnedDecisionCardId } : {}),
  };
  await store.documents.create(doc);
  return doc;
}

/**
 * 模拟 PATCH /api/documents/[id]/spawned-decision-card 的核心业务逻辑.
 * 跟 route.ts 保持一致, 单测主要保障 invariant.
 */
async function linkDecisionCard(
  documentId: string,
  decisionCardId: string,
): Promise<
  | { ok: false; reason: 'not_found' | 'invalid_input' | 'conflict' }
  | { ok: true; alreadyLinked: boolean }
> {
  if (!decisionCardId || decisionCardId.trim().length === 0) {
    return { ok: false, reason: 'invalid_input' };
  }
  const store = getStore();
  const doc = await store.documents.get(documentId);
  if (!doc) return { ok: false, reason: 'not_found' };

  if (doc.spawnedDecisionCardId && doc.spawnedDecisionCardId !== decisionCardId) {
    return { ok: false, reason: 'conflict' };
  }
  if (doc.spawnedDecisionCardId === decisionCardId) {
    return { ok: true, alreadyLinked: true };
  }

  await store.documents.update(doc.id, {
    spawnedDecisionCardId: decisionCardId,
  } as Partial<typeof doc>);
  return { ok: true, alreadyLinked: false };
}

beforeEach(async () => {
  await reset();
});

describe('DOC-4 闭环 · 文档→议事 反链', () => {
  it('成功路径: 写入 spawnedDecisionCardId + alreadyLinked=false', async () => {
    await seedDoc({ id: 'doc_1', ownerId: 'alice', title: 'Q3 复盘' });

    const result = await linkDecisionCard('doc_1', 'dc_abc');
    expect(result).toEqual({ ok: true, alreadyLinked: false });

    const store = getStore();
    const doc = await store.documents.get('doc_1');
    expect(doc?.spawnedDecisionCardId).toBe('dc_abc');
  });

  it('文档不存在 → 404 语义', async () => {
    const result = await linkDecisionCard('doc_missing', 'dc_abc');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('decisionCardId 空 → 400 语义', async () => {
    await seedDoc({ id: 'doc_1', ownerId: 'alice', title: 'X' });
    const r1 = await linkDecisionCard('doc_1', '');
    expect(r1).toEqual({ ok: false, reason: 'invalid_input' });
    const r2 = await linkDecisionCard('doc_1', '   ');
    expect(r2).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('幂等: 同一 cardId 重复 PATCH → alreadyLinked=true 不重写', async () => {
    await seedDoc({
      id: 'doc_dup',
      ownerId: 'alice',
      title: 'X',
      spawnedDecisionCardId: 'dc_xyz',
    });

    const result = await linkDecisionCard('doc_dup', 'dc_xyz');
    expect(result).toEqual({ ok: true, alreadyLinked: true });
  });

  it('冲突: 已关联不同 cardId → 拒绝 (409)', async () => {
    await seedDoc({
      id: 'doc_existing',
      ownerId: 'alice',
      title: 'X',
      spawnedDecisionCardId: 'dc_old',
    });

    const result = await linkDecisionCard('doc_existing', 'dc_new');
    expect(result).toEqual({ ok: false, reason: 'conflict' });

    // 确认未被覆盖
    const store = getStore();
    const doc = await store.documents.get('doc_existing');
    expect(doc?.spawnedDecisionCardId).toBe('dc_old');
  });

  it('两次不同文档分别派生 → 各自独立', async () => {
    await seedDoc({ id: 'doc_a', ownerId: 'alice', title: 'A' });
    await seedDoc({ id: 'doc_b', ownerId: 'bob', title: 'B' });

    const r1 = await linkDecisionCard('doc_a', 'dc_111');
    const r2 = await linkDecisionCard('doc_b', 'dc_222');

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const store = getStore();
    const a = await store.documents.get('doc_a');
    const b = await store.documents.get('doc_b');
    expect(a?.spawnedDecisionCardId).toBe('dc_111');
    expect(b?.spawnedDecisionCardId).toBe('dc_222');
  });
});
