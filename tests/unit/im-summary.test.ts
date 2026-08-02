/**
 * IM 群总结测试 (§Sprint3 Megaplan · 对标企业微信「群总结」)
 *
 * 覆盖 (确定性, 不打网络 LLM):
 *   - 权限: 非成员 summarizeChannel → throw 'not found'
 *   - too_few: 少于 2 条可总结消息 → aiGenerated=false, reason='too_few' (不调 LLM)
 *   - selectSummarizableMessages: 排除软删/空 body; scope='unread' 按 lastReadAt 时间窗裁剪
 *   - buildTranscript: 说话人姓名映射 + @mention token 还原为 @name
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createChannel, sendMessage } from '@/lib/im/service';
import {
  summarizeChannel,
  selectSummarizableMessages,
  buildTranscript,
  resolveTodoOwnerId,
} from '@/lib/im/summary';
import type { ImMessage } from '@/lib/types/im';

beforeEach(() => {
  setStore(createInMemoryStore());
});

function msg(partial: Partial<ImMessage>): ImMessage {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    channelId: 'c1',
    senderId: partial.senderId ?? 'u1',
    senderKind: partial.senderKind ?? 'user',
    body: partial.body ?? 'hi',
    mentions: [],
    createdAt: partial.createdAt ?? new Date().toISOString(),
    deletedAt: partial.deletedAt,
  };
}

describe('summarizeChannel · 权限 & too_few', () => {
  it('非成员 → throw not found', async () => {
    const c = await createChannel({ type: 'group', name: '群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
    await expect(
      summarizeChannel({ channelId: c.id, userId: 'stranger' }),
    ).rejects.toThrow(/not found/);
  });

  it('少于 2 条可总结消息 → aiGenerated=false, reason=too_few (不调 LLM)', async () => {
    const c = await createChannel({ type: 'group', name: '群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
    await sendMessage({ channelId: c.id, senderId: 'u1', body: '只有一条' });

    const out = await summarizeChannel({ channelId: c.id, userId: 'u1' });
    expect(out.ok).toBe(true);
    expect(out.aiGenerated).toBe(false);
    expect(out.reason).toBe('too_few');
    expect(out.messageCount).toBe(1);
    expect(out.summary.overview).toBeTruthy();
  });

  it('空频道 → too_few, messageCount=0', async () => {
    const c = await createChannel({ type: 'group', name: '群', memberIds: ['u1'], createdBy: 'u1' });
    const out = await summarizeChannel({ channelId: c.id, userId: 'u1' });
    expect(out.messageCount).toBe(0);
    expect(out.reason).toBe('too_few');
  });
});

describe('selectSummarizableMessages', () => {
  it('排除软删与空 body', () => {
    const messages = [
      msg({ body: 'a' }),
      msg({ body: '', }),
      msg({ body: '   ' }),
      msg({ body: 'b', deletedAt: new Date().toISOString() }),
      msg({ body: 'c' }),
    ];
    const out = selectSummarizableMessages(messages, 'recent');
    expect(out.map((m) => m.body)).toEqual(['a', 'c']);
  });

  it("scope='unread' 只保留 lastReadAt 之后的消息", () => {
    const t0 = '2026-01-01T00:00:00.000Z';
    const t1 = '2026-01-01T01:00:00.000Z';
    const t2 = '2026-01-01T02:00:00.000Z';
    const messages = [
      msg({ body: 'old', createdAt: t0 }),
      msg({ body: 'boundary', createdAt: t1 }),
      msg({ body: 'new', createdAt: t2 }),
    ];
    const out = selectSummarizableMessages(messages, 'unread', t1);
    // 严格大于 lastReadAt → 只剩 t2
    expect(out.map((m) => m.body)).toEqual(['new']);
  });

  it("scope='recent' 无 lastReadAt 时保留全部", () => {
    const messages = [msg({ body: 'a' }), msg({ body: 'b' })];
    expect(selectSummarizableMessages(messages, 'recent')).toHaveLength(2);
  });
});

describe('resolveTodoOwnerId · 派发闭环', () => {
  const members = [
    { id: 'u1', name: '张三' },
    { id: 'u2', name: '李四' },
  ];

  it('精确匹配成员姓名 → 返回 userId', () => {
    expect(resolveTodoOwnerId('张三', members)).toBe('u1');
    expect(resolveTodoOwnerId('  李四 ', members)).toBe('u2');
  });

  it('"待认领" / 空 → undefined (不可派发)', () => {
    expect(resolveTodoOwnerId('待认领', members)).toBeUndefined();
    expect(resolveTodoOwnerId('  ', members)).toBeUndefined();
  });

  it('匹配不到成员 → undefined', () => {
    expect(resolveTodoOwnerId('王五', members)).toBeUndefined();
  });

  it('LLM 直接写 userId 时退化匹配', () => {
    expect(resolveTodoOwnerId('u2', members)).toBe('u2');
  });
});

describe('buildTranscript', () => {
  it('映射说话人姓名并还原 @mention token', () => {
    const nameOf = (id: string) => ({ u1: '张三', u2: '李四' }[id] ?? id);
    const messages = [
      msg({ senderId: 'u1', body: '@[李四](u2:assign) 你来跟进', createdAt: '2026-01-01T09:05:00.000Z' }),
      msg({ senderId: 'u2', body: '收到', createdAt: '2026-01-01T09:06:00.000Z' }),
    ];
    const transcript = buildTranscript(messages, nameOf);
    expect(transcript).toContain('张三: @李四 你来跟进');
    expect(transcript).toContain('李四: 收到');
    expect(transcript).not.toContain('](u2');
  });

  it('非 user 消息标注 系统 / AI', () => {
    const nameOf = (id: string) => id;
    const messages = [
      msg({ senderId: 'persona', senderKind: 'persona', body: '我是分身' }),
      msg({ senderId: 'sys', senderKind: 'system', body: '系统提示' }),
    ];
    const transcript = buildTranscript(messages, nameOf);
    expect(transcript).toContain('(AI):');
    expect(transcript).toContain('系统:');
  });
});
