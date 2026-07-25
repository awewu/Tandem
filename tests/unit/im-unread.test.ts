import { beforeEach, describe, expect, it } from 'vitest';
import { createChannel, listMyChannels, markChannelRead, sendMessage } from '@/lib/im/service';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { setStore } from '@/lib/storage/repository';

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('IM unread state', () => {
  it('increments unread for recipients and clears it when the channel is read', async () => {
    const channel = await createChannel({
      type: 'group',
      name: '项目群',
      memberIds: ['sender-1', 'reader-1'],
      createdBy: 'sender-1',
      tenantId: 'tenant-1',
    });

    await sendMessage({
      channelId: channel.id,
      senderId: 'sender-1',
      body: '请看一下 @[读者](reader-1:consult)',
    });

    const unreadChannels = await listMyChannels('reader-1', 'tenant-1');
    expect(unreadChannels[0]).toMatchObject({
      id: channel.id,
      unread: 1,
    });
    expect(unreadChannels[0].membership.hasUnreadMention).toBe(true);

    const senderChannels = await listMyChannels('sender-1', 'tenant-1');
    expect(senderChannels[0].unread).toBe(0);

    await markChannelRead(channel.id, 'reader-1');

    const readChannels = await listMyChannels('reader-1', 'tenant-1');
    expect(readChannels[0].unread).toBe(0);
    expect(readChannels[0].membership.hasUnreadMention).toBe(false);
    expect(readChannels[0].membership.lastReadAt).toBeDefined();
  });
});
