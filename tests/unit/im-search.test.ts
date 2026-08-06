/**
 * IM 搜索 · 正文词面检索测试 (§Sprint1 Megaplan)
 *
 * 覆盖 (memory-store; 不走语义向量搜索):
 *   - 跨频道关键词搜索只返回【当前用户可见频道】的消息 (权限边界)
 *   - channelId 过滤: 指定越权频道 → 空结果 (不泄露存在性)
 *   - 无匹配关键词 → 空
 *   - 撤回 (软删) 后不再被召回
 *   - 大小写不敏感子串匹配
 *   - 搜成员名/ID 不返回正文未命中的聊天记录
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createChannel, sendMessage, recallMessage } from '@/lib/im/service';
import { searchMessages } from '@/lib/im/search';

beforeEach(() => {
  setStore(createInMemoryStore());
});

/** u1 在 c1(与 u2); u3 在 c2(与 u2). u1 对 c2 无权。 */
async function seedChannels(userIds: { me?: string; other?: string; outsider?: string } = {}) {
  const u1 = userIds.me ?? 'u1';
  const u2 = userIds.other ?? 'u2';
  const u3 = userIds.outsider ?? 'u3';
  const c1 = await createChannel({
    type: 'group',
    name: '产品群',
    memberIds: [u1, u2],
    createdBy: u1,
  });
  const c2 = await createChannel({
    type: 'group',
    name: '财务群',
    memberIds: [u2, u3],
    createdBy: u3,
  });
  return { c1, c2 };
}

describe('searchMessages', () => {
  it('跨频道搜索只返回当前用户可见频道的消息', async () => {
    const { c1, c2 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'quarterly roadmap 讨论' });
    await sendMessage({ channelId: c2.id, senderId: 'u3', body: 'quarterly budget 讨论' });

    const results = await searchMessages({ userId: 'u1', tenantId: 'default', query: 'quarterly' });
    expect(results).toHaveLength(1);
    expect(results[0].channelId).toBe(c1.id);
    expect(results[0].channelName).toBe('产品群');
    expect(results[0].preview).toContain('quarterly');
  });

  it('指定越权频道 channelId → 空结果', async () => {
    const { c1, c2 } = await seedChannels();
    await sendMessage({ channelId: c2.id, senderId: 'u3', body: 'secret budget number' });
    void c1;

    const results = await searchMessages({
      userId: 'u1',
      tenantId: 'default',
      query: 'budget',
      channelId: c2.id,
    });
    expect(results).toEqual([]);
  });

  it('指定本人可见频道 channelId → 限定该频道', async () => {
    const { c1 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'roadmap alpha' });

    const results = await searchMessages({
      userId: 'u1',
      tenantId: 'default',
      query: 'roadmap',
      channelId: c1.id,
    });
    expect(results).toHaveLength(1);
    expect(results[0].channelId).toBe(c1.id);
  });

  it('无匹配关键词 → 空', async () => {
    const { c1 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'hello world' });
    const results = await searchMessages({ userId: 'u1', tenantId: 'default', query: 'zzz不存在' });
    expect(results).toEqual([]);
  });

  it('空 query → 空', async () => {
    await seedChannels();
    const results = await searchMessages({ userId: 'u1', tenantId: 'default', query: '   ' });
    expect(results).toEqual([]);
  });

  it('撤回后不再被召回', async () => {
    const { c1 } = await seedChannels();
    const msg = await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'temporary secret token' });
    let results = await searchMessages({ userId: 'u1', tenantId: 'default', query: 'token' });
    expect(results).toHaveLength(1);

    await recallMessage(msg.id, 'u1');
    results = await searchMessages({ userId: 'u1', tenantId: 'default', query: 'token' });
    expect(results).toEqual([]);
  });

  it('大小写不敏感子串匹配', async () => {
    const { c1 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'Deploy PIPELINE ready' });
    const results = await searchMessages({ userId: 'u1', tenantId: 'default', query: 'pipeline' });
    expect(results).toHaveLength(1);
  });

  it('搜成员名时不返回正文未命中的聊天记录', async () => {
    const { c1 } = await seedChannels();
    await sendMessage({ channelId: c1.id, senderId: 'u1', body: '这里也没有搜索词' });

    const results = await searchMessages({
      userId: 'u1',
      tenantId: 'default',
      query: '李煜涛',
    });
    expect(results).toEqual([]);
  });
});
