import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChannel, listMyChannels, markChannelRead, sendMessage } from '@/lib/im/service';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';

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

    const membershipList = vi.spyOn(getStore().imMemberships, 'list');
    await sendMessage({
      channelId: channel.id,
      senderId: 'sender-1',
      body: '请看一下 @[读者](reader-1:consult)',
    });
    expect(membershipList).toHaveBeenCalledWith({ channelId: channel.id });

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

    const update = vi.spyOn(getStore().imMemberships, 'update');
    await markChannelRead(channel.id, 'reader-1');
    expect(update).not.toHaveBeenCalled();
  });

  it('advances lastReadAt for a newer self-authored message without unread state', async () => {
    const channel = await createChannel({
      type: 'group',
      name: '项目群',
      memberIds: ['reader-1'],
      createdBy: 'reader-1',
      tenantId: 'tenant-1',
    });
    const store = getStore();
    await store.imMemberships.update(`${channel.id}:reader-1`, {
      lastReadAt: '2026-01-01T00:00:00.000Z',
    });
    await store.imChannels.update(channel.id, {
      lastMessageAt: '2026-01-02T00:00:00.000Z',
    });
    const update = vi.spyOn(store.imMemberships, 'update');

    await markChannelRead(channel.id, 'reader-1');

    expect(update).toHaveBeenCalledWith(`${channel.id}:reader-1`, expect.objectContaining({
      unreadCount: 0,
      hasUnreadMention: false,
    }));
  });

  it('bounds concurrent channel lookups for users with many memberships', async () => {
    const store = getStore();
    for (let index = 0; index < 24; index++) {
      await createChannel({
        type: 'group',
        name: `channel-${index}`,
        memberIds: ['reader-many'],
        createdBy: `owner-${index}`,
        tenantId: 'tenant-1',
      });
    }

    const originalGet = store.imChannels.get.bind(store.imChannels);
    let active = 0;
    let maxActive = 0;
    vi.spyOn(store.imChannels, 'get').mockImplementation(async (id) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      try {
        return await originalGet(id);
      } finally {
        active -= 1;
      }
    });

    const channels = await listMyChannels('reader-many', 'tenant-1');

    expect(channels).toHaveLength(24);
    expect(maxActive).toBeLessThanOrEqual(16);
  });

  it('bounds concurrent unread updates for large groups', async () => {
    const recipients = Array.from({ length: 24 }, (_, index) => `reader-${index}`);
    const channel = await createChannel({
      type: 'group',
      name: 'large-group',
      memberIds: recipients,
      createdBy: 'sender-large',
      tenantId: 'tenant-1',
    });
    const store = getStore();
    const originalUpdate = store.imMemberships.update.bind(store.imMemberships);
    let active = 0;
    let maxActive = 0;
    const update = vi.spyOn(store.imMemberships, 'update').mockImplementation(async (id, patch) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      try {
        return await originalUpdate(id, patch);
      } finally {
        active -= 1;
      }
    });

    await sendMessage({
      channelId: channel.id,
      senderId: 'sender-large',
      body: 'bounded fanout',
    });

    expect(update).toHaveBeenCalledTimes(recipients.length);
    expect(maxActive).toBeLessThanOrEqual(16);
  });
});
