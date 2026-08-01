import { beforeEach, describe, expect, it } from 'vitest';
import { createChannel, recallMessage, sendMessage } from '@/lib/im/service';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore } from '@/lib/storage/repository';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('IM recall', () => {
  it('is idempotent after a message has already been recalled', async () => {
    const channel = await createChannel({
      type: 'group',
      name: '项目群',
      memberIds: ['sender-1', 'reader-1'],
      createdBy: 'sender-1',
      tenantId: 'tenant-1',
    });
    const message = await sendMessage({
      channelId: channel.id,
      senderId: 'sender-1',
      body: '需要撤回的消息',
    });

    const first = await recallMessage(message.id, 'sender-1');
    const second = await recallMessage(message.id, 'sender-1');

    expect(first.deletedAt).toBeDefined();
    expect(first.body).toBe('');
    expect(second.id).toBe(first.id);
    expect(second.deletedAt).toBe(first.deletedAt);
    expect(second.body).toBe('');
  });
});
