/**
 * IM 转发 / 合并转发 + typing 广播测试 (§Sprint2 Megaplan)
 *
 * 覆盖:
 *   - 逐条转发: 保留原文, 以 operator 身份发到目标频道
 *   - 合并转发: 单条 forward 附件, 打包源消息快照
 *   - 越权目标频道 (operator 非成员) → 拒绝
 *   - 源消息不可见 (operator 非源频道成员) → 拒绝
 *   - 已撤回源消息 → not found
 *   - typing 事件不落库 (无新消息), 且携带正确 userId
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  createChannel,
  sendMessage,
  recallMessage,
  forwardMessages,
  emitTyping,
  subscribeIm,
  getChannelMessages,
  type ImBusEvent,
} from '@/lib/im/service';

beforeEach(() => {
  setStore(createInMemoryStore());
});

/** c1: u1+u2 (u1 owner); c2: u2+u3 (u3 owner, u1 无权). */
async function seed() {
  const c1 = await createChannel({ type: 'group', name: '目标群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
  const c2 = await createChannel({ type: 'group', name: '他群', memberIds: ['u2', 'u3'], createdBy: 'u3' });
  return { c1, c2 };
}

describe('forwardMessages', () => {
  it('逐条转发: 保留原文, operator 身份发到目标频道', async () => {
    const { c1 } = await seed();
    const src1 = await sendMessage({ channelId: c1.id, senderId: 'u2', body: '原文一' });
    const src2 = await sendMessage({ channelId: c1.id, senderId: 'u2', body: '原文二' });

    const out = await forwardMessages({
      fromMessageIds: [src1.id, src2.id],
      toChannelId: c1.id,
      operatorId: 'u1',
    });
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.body)).toEqual(['原文一', '原文二']);
    expect(out.every((m) => m.senderId === 'u1')).toBe(true);
  });

  it('合并转发: 单条 forward 附件打包快照', async () => {
    const { c1 } = await seed();
    const src1 = await sendMessage({ channelId: c1.id, senderId: 'u2', body: 'a' });
    const src2 = await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'b' });

    const out = await forwardMessages({
      fromMessageIds: [src1.id, src2.id],
      toChannelId: c1.id,
      operatorId: 'u1',
      merge: true,
    });
    expect(out).toHaveLength(1);
    const att = out[0].attachments?.[0];
    expect(att?.kind).toBe('forward');
    expect(att?.forwardedItems).toHaveLength(2);
    expect(att?.forwardedItems?.map((i) => i.body)).toEqual(['a', 'b']);
  });

  it('越权目标频道 (operator 非成员) → 拒绝', async () => {
    const { c1, c2 } = await seed();
    const src = await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'x' });
    // u1 不是 c2 成员 → 转发到 c2 应被拒
    await expect(
      forwardMessages({ fromMessageIds: [src.id], toChannelId: c2.id, operatorId: 'u1' }),
    ).rejects.toThrow(/forbidden/);
  });

  it('源消息不可见 (operator 非源频道成员) → 拒绝', async () => {
    const { c1, c2 } = await seed();
    const srcInC2 = await sendMessage({ channelId: c2.id, senderId: 'u3', body: 'secret' });
    // u1 是 c1 成员, 但 srcInC2 在 c2 (u1 无权) → 拒绝
    await expect(
      forwardMessages({ fromMessageIds: [srcInC2.id], toChannelId: c1.id, operatorId: 'u1' }),
    ).rejects.toThrow(/forbidden/);
  });

  it('已撤回源消息 → not found', async () => {
    const { c1 } = await seed();
    const src = await sendMessage({ channelId: c1.id, senderId: 'u1', body: 'gone' });
    await recallMessage(src.id, 'u1');
    await expect(
      forwardMessages({ fromMessageIds: [src.id], toChannelId: c1.id, operatorId: 'u1' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('emitTyping', () => {
  it('typing 事件不落库, 携带正确 userId/channelId', async () => {
    const { c1 } = await seed();
    const events: ImBusEvent[] = [];
    const unsub = subscribeIm((e) => events.push(e));

    emitTyping(c1.id, 'u2');
    unsub();

    const typing = events.find((e) => e.type === 'typing');
    expect(typing).toBeTruthy();
    expect(typing).toMatchObject({ type: 'typing', channelId: c1.id, userId: 'u2' });

    // 不产生任何消息
    const msgs = await getChannelMessages(c1.id);
    expect(msgs).toHaveLength(0);
    void getStore;
  });
});
