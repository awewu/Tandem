import { beforeEach, describe, expect, it } from 'vitest';
import { createNode, deleteNode, listNodes } from '@/lib/knowledge/service';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';

describe('knowledge delete', () => {
  beforeEach(() => setStore(createInMemoryStore()));

  it('soft-deletes a folder and its descendants without crossing owners', async () => {
    const folder = await createNode({
      ownerId: 'owner_a', tenantId: 'tenant_a', name: '项目资料', type: 'folder', parentId: 'root',
    });
    const file = await createNode({
      ownerId: 'owner_a', tenantId: 'tenant_a', name: '方案.md', type: 'file', parentId: folder.id, content: '正文',
    });
    const otherOwnerFile = await createNode({
      ownerId: 'owner_b', tenantId: 'tenant_a', name: '其他人的资料.md', type: 'file', parentId: folder.id, content: '正文',
    });

    await expect(deleteNode('owner_a', folder.id)).resolves.toBe(2);
    await expect(listNodes('owner_a')).resolves.toEqual([]);
    expect((await getStore().knowledgeNodes.get(folder.id))?.deletedAt).toBeTruthy();
    expect((await getStore().knowledgeNodes.get(file.id))?.deletedAt).toBeTruthy();
    expect((await getStore().knowledgeNodes.get(otherOwnerFile.id))?.deletedAt).toBeUndefined();
  });
});
