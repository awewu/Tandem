import { describe, expect, it } from 'vitest';
import { chooseImPopupDirection, formatImMessageTimestamp, getImReadReceiptSummary } from '@/lib/im/message-display';
import type { ImMembership } from '@/lib/types/im';

function member(userId: string, lastReadAt?: string): ImMembership {
  return {
    id: `ch-1:${userId}`,
    channelId: 'ch-1',
    userId,
    role: 'member',
    joinedAt: '2026-07-01T00:00:00.000Z',
    lastReadAt,
    unreadCount: 0,
    muted: false,
  };
}

describe('IM message display helpers', () => {
  it('shows only time for messages sent today', () => {
    const now = new Date(2026, 6, 31, 20, 6);
    const sentAt = new Date(2026, 6, 31, 19, 31).toISOString();

    expect(formatImMessageTimestamp(sentAt, now)).toBe('19:31');
  });

  it('shows date and time for older messages in the same year', () => {
    const now = new Date(2026, 6, 31, 20, 6);
    const sentAt = new Date(2026, 6, 30, 19, 31).toISOString();

    expect(formatImMessageTimestamp(sentAt, now)).toBe('7月30日 19:31');
  });

  it('shows year, date and time for messages from another year', () => {
    const now = new Date(2026, 6, 31, 20, 6);
    const sentAt = new Date(2025, 11, 30, 9, 5).toISOString();

    expect(formatImMessageTimestamp(sentAt, now)).toBe('2025年12月30日 09:05');
  });

  it('splits channel members into read and unread people for a message', () => {
    const summary = getImReadReceiptSummary(
      { senderId: 'sender-1', createdAt: '2026-07-30T11:31:00.000Z' },
      [
        member('sender-1', '2026-07-30T11:31:10.000Z'),
        member('reader-1', '2026-07-30T11:31:00.000Z'),
        member('reader-2', '2026-07-30T11:31:01.000Z'),
        member('unread-1'),
        member('unread-2', '2026-07-30T11:30:59.000Z'),
      ],
    );

    expect(summary.totalReaders).toBe(4);
    expect(summary.readerCount).toBe(2);
    expect(summary.readers.map((m) => m.userId)).toEqual(['reader-1', 'reader-2']);
    expect(summary.unreadMembers.map((m) => m.userId)).toEqual(['unread-1', 'unread-2']);
  });

  it('opens the read receipt popup downward when there is not enough room above', () => {
    expect(chooseImPopupDirection({
      triggerTop: 48,
      triggerBottom: 68,
      viewportHeight: 900,
      panelHeight: 184,
    })).toBe('down');
  });

  it('keeps the read receipt popup upward when there is enough room above', () => {
    expect(chooseImPopupDirection({
      triggerTop: 500,
      triggerBottom: 520,
      viewportHeight: 900,
      panelHeight: 184,
    })).toBe('up');
  });
});
