/**
 * 知识库 · 服务层
 *
 * 文件树节点 CRUD (按 ownerId 隔离) + 递归删除 + 防环移动.
 * 通过 TandemStore 访问 KvStore (collection='knowledge_nodes'), 不直接依赖 DB 实现.
 *
 * 替代原 lib/store/knowledge.ts 的纯前端 zustand-persist (localStorage):
 * 数据落库后跨设备/跨浏览器不再丢失.
 */

import { getStore, generateId } from '../storage/repository';
import type { KnowledgeNode, KnowledgeOwnership } from '../types/knowledge';

export interface CreateNodeInput {
  ownerId: string;
  tenantId: string;
  name: string;
  type: 'folder' | 'file';
  parentId?: string | null;
  content?: string;
  ownership?: KnowledgeOwnership;
}

export interface UpdateNodeInput {
  name?: string;
  content?: string;
  parentId?: string | null;
  /** 显式传 null 清除 ownership ('未分级') */
  ownership?: KnowledgeOwnership | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 列出某用户的全部知识节点 (排除软删墓碑). */
export async function listNodes(ownerId: string): Promise<KnowledgeNode[]> {
  const store = getStore();
  const all = await store.knowledgeNodes.list({ ownerId } as Partial<KnowledgeNode>);
  return all
    .filter((n) => !n.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getNode(ownerId: string, id: string): Promise<KnowledgeNode | null> {
  const store = getStore();
  const node = await store.knowledgeNodes.get(id);
  if (!node || node.ownerId !== ownerId || node.deletedAt) return null;
  return node;
}

export async function createNode(input: CreateNodeInput): Promise<KnowledgeNode> {
  const store = getStore();
  const ts = nowIso();
  return store.knowledgeNodes.create({
    id: generateId('kn'),
    ownerId: input.ownerId,
    tenantId: input.tenantId,
    name: input.name.trim() || (input.type === 'folder' ? '新建文件夹' : '未命名文件'),
    type: input.type,
    parentId: input.parentId ?? 'root',
    content: input.type === 'file' ? (input.content ?? '') : undefined,
    ownership: input.ownership,
    createdAt: ts,
    updatedAt: ts,
  });
}

/** 更新节点 — 仅 owner 可改. 返回 null 表示不存在或无权. */
export async function updateNode(
  ownerId: string,
  id: string,
  patch: UpdateNodeInput,
): Promise<KnowledgeNode | null> {
  const existing = await getNode(ownerId, id);
  if (!existing) return null;
  const store = getStore();
  const clean: Partial<KnowledgeNode> = { updatedAt: nowIso() };
  if (patch.name !== undefined) clean.name = patch.name.trim() || existing.name;
  if (patch.content !== undefined) clean.content = patch.content;
  if (patch.parentId !== undefined) clean.parentId = patch.parentId;
  // ownership: 传 null 清除 (未分级), 传值则设置
  if ('ownership' in patch) clean.ownership = patch.ownership ?? undefined;
  return store.knowledgeNodes.update(id, clean);
}

/**
 * 递归删除 (软删): 删文件夹时连带其下所有后代节点一并打墓碑.
 * 只在该 owner 的节点集合内收集后代, 不跨用户.
 */
export async function deleteNode(ownerId: string, id: string): Promise<number> {
  const store = getStore();
  const all = await listNodes(ownerId);
  const target = all.find((n) => n.id === id);
  if (!target) return 0;

  const toDelete = new Set<string>([id]);
  let added = true;
  while (added) {
    added = false;
    for (const n of all) {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        added = true;
      }
    }
  }

  const ts = nowIso();
  await Promise.all(
    Array.from(toDelete).map((nid) =>
      store.knowledgeNodes.update(nid, { deletedAt: ts, updatedAt: ts }),
    ),
  );
  return toDelete.size;
}

/**
 * 移动节点到目标文件夹 (防环: 不能移到自身或自身后代下).
 * 返回更新后的节点, 非法移动返回 null.
 */
export async function moveNode(
  ownerId: string,
  id: string,
  targetParentId: string,
): Promise<KnowledgeNode | null> {
  if (id === targetParentId) return null;
  const all = await listNodes(ownerId);
  const node = all.find((n) => n.id === id);
  if (!node) return null;

  // targetParentId 若为某个真实节点, 校验它不是 node 的后代 (防环)
  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    let cur = all.find((n) => n.id === candidateId);
    while (cur?.parentId) {
      if (cur.parentId === ancestorId) return true;
      cur = all.find((n) => n.id === cur!.parentId);
    }
    return false;
  };
  if (targetParentId !== 'root' && isDescendant(id, targetParentId)) return null;

  const store = getStore();
  return store.knowledgeNodes.update(id, { parentId: targetParentId, updatedAt: nowIso() });
}
