/**
 * 搭子手抄 · 知识库 (Notebook) CRUD + 笔记按知识库过滤 测试
 *
 * 覆盖: 创建 / 列出(含笔记数) / 重命名 / 删除(软删+笔记回未分组) / 笔记按 notebookId 过滤.
 * 不调真实 LLM/DB, 用内存 store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  createNote,
  listNotes,
  createNotebook,
  listNotebooks,
  updateNotebook,
  deleteNotebook,
} from '@/lib/shouchao/service';

const OWNER = 'user_alice';
const OTHER = 'user_bob';
const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('知识库 CRUD', () => {
  it('创建后出现在列表中', async () => {
    const nb = await createNotebook(OWNER, TENANT, '产品笔记');
    expect(nb.name).toBe('产品笔记');
    expect(nb.ownerId).toBe(OWNER);

    const list = await listNotebooks(OWNER);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(nb.id);
    expect(list[0].noteCount).toBe(0);
  });

  it('列表按创建时间升序, 附带笔记数', async () => {
    const a = await createNotebook(OWNER, TENANT, 'A');
    await new Promise((res) => setTimeout(res, 2));
    const b = await createNotebook(OWNER, TENANT, 'B');

    await createNote({ ownerId: OWNER, tenantId: TENANT, content: 'n1', notebookId: a.id });
    await createNote({ ownerId: OWNER, tenantId: TENANT, content: 'n2', notebookId: a.id });
    await createNote({ ownerId: OWNER, tenantId: TENANT, content: 'n3', notebookId: b.id });

    const list = await listNotebooks(OWNER);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(a.id);
    expect(list[0].noteCount).toBe(2);
    expect(list[1].id).toBe(b.id);
    expect(list[1].noteCount).toBe(1);
  });

  it('重命名和改图标', async () => {
    const nb = await createNotebook(OWNER, TENANT, '旧名');
    const updated = await updateNotebook(OWNER, nb.id, { name: '新名', icon: '📘' });
    expect(updated?.name).toBe('新名');
    expect(updated?.icon).toBe('📘');
  });

  it('非本人不能重命名 (返回 null)', async () => {
    const nb = await createNotebook(OWNER, TENANT, 'alice 的');
    expect(await updateNotebook(OTHER, nb.id, { name: 'hacked' })).toBeNull();
  });

  it('删除 = 软删 + 其下笔记 notebookId 清空回未分组', async () => {
    const nb = await createNotebook(OWNER, TENANT, '待删');
    const n = await createNote({ ownerId: OWNER, tenantId: TENANT, content: '在知识库里', notebookId: nb.id });

    expect(await deleteNotebook(OWNER, nb.id)).toBe(true);

    // 知识库从列表消失
    expect(await listNotebooks(OWNER)).toHaveLength(0);

    // 笔记仍在, 但 notebookId 被清空
    const notes = await listNotes(OWNER);
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(n.id);
    expect(notes[0].notebookId).toBeUndefined();
  });

  it('非本人不能删 (返回 false)', async () => {
    const nb = await createNotebook(OWNER, TENANT, 'alice 的');
    expect(await deleteNotebook(OTHER, nb.id)).toBe(false);
  });

  it('空名自动 fallback 为未命名知识库', async () => {
    const nb = await createNotebook(OWNER, TENANT, '   ');
    expect(nb.name).toBe('未命名知识库');
  });
});

describe('笔记按知识库过滤', () => {
  it('listNotes 支持 notebookId 过滤', async () => {
    const nb = await createNotebook(OWNER, TENANT, '工作');
    await createNote({ ownerId: OWNER, tenantId: TENANT, content: '在知识库', notebookId: nb.id });
    await createNote({ ownerId: OWNER, tenantId: TENANT, content: '未分组' });

    const inNotebook = await listNotes(OWNER, { notebookId: nb.id });
    expect(inNotebook).toHaveLength(1);
    expect(inNotebook[0].content).toBe('在知识库');

    const ungrouped = await listNotes(OWNER, { notebookId: 'unfiled' });
    expect(ungrouped).toHaveLength(1);
    expect(ungrouped[0].content).toBe('未分组');

    const all = await listNotes(OWNER);
    expect(all).toHaveLength(2);
  });

  it('删除的笔记不计入知识库笔记数', async () => {
    const nb = await createNotebook(OWNER, TENANT, '工作');
    const n = await createNote({ ownerId: OWNER, tenantId: TENANT, content: '会删', notebookId: nb.id });
    await createNote({ ownerId: OWNER, tenantId: TENANT, content: '保留', notebookId: nb.id });

    const { deleteNote } = await import('@/lib/shouchao/service');
    await deleteNote(OWNER, n.id);

    const list = await listNotebooks(OWNER);
    expect(list[0].noteCount).toBe(1);
  });
});
