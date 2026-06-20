/**
 * 搭字手抄 · 语义检索 (searchNotesForAsk) 验证
 *
 * 测试环境未配置 embedding → 自动回退 Jaccard 关键词. 这里验证回退路径正确:
 *   - 相关笔记被召回并按相关度排序
 *   - 全无命中时回落最近笔记 (保证宽泛提问也有上下文)
 *   - 软删/归档笔记被排除
 *   - ownerId 隔离
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createNote, searchNotesForAsk, updateNote, deleteNote } from '@/lib/shouchao/service';

const OWNER = 'user_a';
const OTHER = 'user_b';
const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('searchNotesForAsk (Jaccard 回退路径)', () => {
  it('召回相关笔记, 不相关的排后或不出现', async () => {
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '年假申请流程', content: '提前三天在系统提交年假申请', tags: ['HR'] });
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '报销指南', content: '发票贴单后交财务', tags: ['财务'] });

    const hits = await searchNotesForAsk(OWNER, '年假怎么申请');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].note.title).toBe('年假申请流程');
  });

  it('全无命中时回落最近笔记 (宽泛提问也有上下文)', async () => {
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '随手记', content: '今天天气不错' });
    const hits = await searchNotesForAsk(OWNER, 'xyzzy无关词条');
    // 回落分支: 返回最近笔记, score=0
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].score).toBe(0);
  });

  it('排除软删/归档笔记', async () => {
    const n1 = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '会议纪要A', content: '项目排期讨论' });
    const n2 = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '会议纪要B', content: '项目排期讨论' });
    await deleteNote(OWNER, n1.id);
    await updateNote(OWNER, n2.id, { archived: true });

    const hits = await searchNotesForAsk(OWNER, '项目排期');
    expect(hits.every((h) => h.note.id !== n1.id && h.note.id !== n2.id)).toBe(true);
  });

  it('ownerId 隔离: 不返回他人笔记', async () => {
    await createNote({ ownerId: OTHER, tenantId: TENANT, title: '别人的年假笔记', content: '年假流程' });
    const hits = await searchNotesForAsk(OWNER, '年假');
    expect(hits.every((h) => h.note.ownerId !== OTHER)).toBe(true);
  });

  it('空笔记库返回空', async () => {
    expect(await searchNotesForAsk(OWNER, '任何问题')).toEqual([]);
  });
});
