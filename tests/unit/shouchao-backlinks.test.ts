/**
 * 搭字手抄 · 双向链接 (extractWikiLinks / getOutgoingLinks / getBacklinks)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  createNote,
  deleteNote,
  extractWikiLinks,
  getOutgoingLinks,
  getBacklinks,
} from '@/lib/shouchao/service';

const OWNER = 'user_a';
const OTHER = 'user_b';
const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('extractWikiLinks', () => {
  it('抽取 [[标题]], 去重保序', () => {
    expect(extractWikiLinks('见 [[年假]] 和 [[报销]], 再说 [[年假]]')).toEqual(['年假', '报销']);
  });
  it('支持 [[标题|显示名]] 取标题部分', () => {
    expect(extractWikiLinks('参考 [[OKR制度|公司目标]]')).toEqual(['OKR制度']);
  });
  it('无链接返回空', () => {
    expect(extractWikiLinks('普通文本没有链接')).toEqual([]);
  });
});

describe('getOutgoingLinks', () => {
  it('解析命中存在的笔记, 未命中标 unresolved', async () => {
    const target = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '年假流程', content: '提前申请' });
    const src = await createNote({ ownerId: OWNER, tenantId: TENANT, title: 'HR手册', content: '详见 [[年假流程]] 和 [[未建笔记]]' });

    const links = await getOutgoingLinks(OWNER, src.id);
    expect(links).toHaveLength(2);
    const resolved = links.find((l) => l.title === '年假流程');
    expect(resolved?.id).toBe(target.id);
    expect(resolved?.unresolved).toBe(false);
    const unresolved = links.find((l) => l.title === '未建笔记');
    expect(unresolved?.id).toBeNull();
    expect(unresolved?.unresolved).toBe(true);
  });
});

describe('getBacklinks', () => {
  it('找出所有引用本笔记的其它笔记', async () => {
    const target = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '核心价值观', content: '...' });
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '入职指南', content: '请阅读 [[核心价值观]]' });
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '晋升标准', content: '对齐 [[核心价值观]]' });
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '无关笔记', content: '没有链接' });

    const back = await getBacklinks(OWNER, target.id);
    expect(back).toHaveLength(2);
    expect(back.map((n) => n.title).sort()).toEqual(['入职指南', '晋升标准']);
  });

  it('大小写不敏感匹配', async () => {
    const target = await createNote({ ownerId: OWNER, tenantId: TENANT, title: 'Roadmap', content: '...' });
    await createNote({ ownerId: OWNER, tenantId: TENANT, title: '计划', content: '见 [[roadmap]]' });
    const back = await getBacklinks(OWNER, target.id);
    expect(back).toHaveLength(1);
  });

  it('排除软删笔记', async () => {
    const target = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '主题', content: '...' });
    const ref = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '引用页', content: '[[主题]]' });
    await deleteNote(OWNER, ref.id);
    expect(await getBacklinks(OWNER, target.id)).toHaveLength(0);
  });

  it('ownerId 隔离: 不跨用户连边', async () => {
    const target = await createNote({ ownerId: OWNER, tenantId: TENANT, title: '我的笔记', content: '...' });
    await createNote({ ownerId: OTHER, tenantId: TENANT, title: '别人页', content: '[[我的笔记]]' });
    expect(await getBacklinks(OWNER, target.id)).toHaveLength(0);
  });
});
