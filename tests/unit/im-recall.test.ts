import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createChannel, getChannelMessages, listMyChannels, recallMessage, sendMessage } from '@/lib/im/service';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';

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

  it('shows the recall placeholder and removes the recalled message from unread state', async () => {
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
      body: '这里选不了月 @[读者](reader-1:consult)',
    });

    let readerChannels = await listMyChannels('reader-1', 'tenant-1');
    expect(readerChannels[0].unread).toBe(1);
    expect(readerChannels[0].lastMessagePreview).toContain('这里选不了月');

    await recallMessage(message.id, 'sender-1');

    const messages = await getChannelMessages(channel.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: message.id,
      body: '',
    });
    expect(messages[0].deletedAt).toBeDefined();

    readerChannels = await listMyChannels('reader-1', 'tenant-1');
    expect(readerChannels[0].unread).toBe(0);
    expect(readerChannels[0].membership.hasUnreadMention).toBe(false);
    expect(readerChannels[0].lastMessagePreview).toBe('一条消息已撤回');
    expect(readerChannels[0].lastMessagePreview).not.toContain('这里选不了月');
  });

  it('keeps channel listing read-only and repairs stale recall state through the mutation path', async () => {
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
      body: '123 @[读者](reader-1:consult)',
    });
    const store = getStore();
    await store.imMessages.update(message.id, {
      deletedAt: new Date().toISOString(),
      body: '',
    });

    const channelUpdate = vi.spyOn(store.imChannels, 'update');
    const membershipUpdate = vi.spyOn(store.imMemberships, 'update');
    const messageList = vi.spyOn(store.imMessages, 'list');
    let readerChannels = await listMyChannels('reader-1', 'tenant-1');
    expect(readerChannels[0].unread).toBe(1);
    expect(readerChannels[0].membership.hasUnreadMention).toBe(true);
    expect(readerChannels[0].lastMessagePreview).toContain('123');
    expect(channelUpdate).not.toHaveBeenCalled();
    expect(membershipUpdate).not.toHaveBeenCalled();
    expect(messageList).not.toHaveBeenCalled();

    // An explicit recall mutation is the repair boundary for legacy stale rows.
    await recallMessage(message.id, 'sender-1');
    readerChannels = await listMyChannels('reader-1', 'tenant-1');
    expect(readerChannels[0].unread).toBe(0);
    expect(readerChannels[0].membership.hasUnreadMention).toBe(false);
    expect(readerChannels[0].lastMessagePreview).toBe('一条消息已撤回');
    expect(readerChannels[0].lastMessagePreview).not.toContain('123');

    const repairedChannel = await store.imChannels.get(channel.id);
    const repairedMembership = await store.imMemberships.get(`${channel.id}:reader-1`);
    expect(repairedChannel?.lastMessagePreview).toBe('一条消息已撤回');
    expect(repairedMembership?.unreadCount).toBe(0);
    expect(repairedMembership?.hasUnreadMention).toBe(false);
  });
});
