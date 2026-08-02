/**
 * IM · imMessages.listByChannel 热路径查询测试 (热表性能收口, 2026-08)
 *
 * 覆盖 (memory-store 实现, 与 drizzle 语义对齐):
 *   - 按 createdAt 升序返回
 *   - 排除软删 (deletedAt)
 *   - 只返回频道内消息 (channelId 过滤)
 *   - limit 取"最新" N 条 (升序返回)
 *   - before 游标 (排他, 向上翻页)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { ImMessage } from '@/lib/types/im';

beforeEach(() => {
  setStore(createInMemoryStore());
});

async function seed(partial: Partial<ImMessage> & { id: string; channelId: string; createdAt: string }) {
  return getStore().imMessages.create({
    senderId: 'u1',
    senderKind: 'user',
    body: partial.id,
    ...partial,
  } as Omit<ImMessage, 'id'> & { id?: string });
}

describe('imMessages.listByChannel', () => {
  it('按 createdAt 升序返回, 只含目标频道', async () => {
    await seed({ id: 'm2', channelId: 'c1', createdAt: '2026-01-02T00:00:00.000Z' });
    await seed({ id: 'm1', channelId: 'c1', createdAt: '2026-01-01T00:00:00.000Z' });
    await seed({ id: 'x1', channelId: 'c2', createdAt: '2026-01-01T12:00:00.000Z' });
    await seed({ id: 'm3', channelId: 'c1', createdAt: '2026-01-03T00:00:00.000Z' });

    const rows = await getStore().imMessages.listByChannel('c1');
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('排除软删消息', async () => {
    await seed({ id: 'm1', channelId: 'c1', createdAt: '2026-01-01T00:00:00.000Z' });
    await seed({ id: 'm2', channelId: 'c1', createdAt: '2026-01-02T00:00:00.000Z', deletedAt: '2026-01-02T01:00:00.000Z' });
    await seed({ id: 'm3', channelId: 'c1', createdAt: '2026-01-03T00:00:00.000Z' });

    const rows = await getStore().imMessages.listByChannel('c1');
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm3']);
  });

  it('limit 取最新 N 条 (仍升序返回)', async () => {
    for (let i = 1; i <= 5; i++) {
      await seed({ id: `m${i}`, channelId: 'c1', createdAt: `2026-01-0${i}T00:00:00.000Z` });
    }
    const rows = await getStore().imMessages.listByChannel('c1', { limit: 2 });
    expect(rows.map((r) => r.id)).toEqual(['m4', 'm5']); // 最新两条, 升序
  });

  it('before 游标: 只返回早于游标的消息 (向上翻页)', async () => {
    for (let i = 1; i <= 5; i++) {
      await seed({ id: `m${i}`, channelId: 'c1', createdAt: `2026-01-0${i}T00:00:00.000Z` });
    }
    const rows = await getStore().imMessages.listByChannel('c1', {
      before: '2026-01-03T00:00:00.000Z',
      limit: 10,
    });
    expect(rows.map((r) => r.id)).toEqual(['m1', 'm2']); // m3(=游标)排他, m4/m5 更晚被排除
  });

  it('空频道返回空数组', async () => {
    const rows = await getStore().imMessages.listByChannel('nope');
    expect(rows).toEqual([]);
  });
});
