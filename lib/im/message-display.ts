import type { ImMembership, ImMessage } from '@/lib/types/im';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatImMessageTimestamp(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (!isValidDate(date)) return '';

  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (isSameLocalDate(date, now)) return time;

  const sameYear = date.getFullYear() === now.getFullYear();
  const dateLabel = sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  return `${dateLabel} ${time}`;
}

export interface ImReadReceiptSummary {
  readers: ImMembership[];
  unreadMembers: ImMembership[];
  readerCount: number;
  totalReaders: number;
}

export function getImReadReceiptSummary(
  message: Pick<ImMessage, 'senderId' | 'createdAt'>,
  members: readonly ImMembership[],
): ImReadReceiptSummary {
  const sentAt = new Date(message.createdAt);
  const participants = members.filter((m) => m.userId !== message.senderId);

  if (!isValidDate(sentAt)) {
    return {
      readers: [],
      unreadMembers: participants,
      readerCount: 0,
      totalReaders: participants.length,
    };
  }

  const readers = participants.filter((m) => {
    if (!m.lastReadAt) return false;
    const readAt = new Date(m.lastReadAt);
    return isValidDate(readAt) && readAt >= sentAt;
  });
  const readerIds = new Set(readers.map((m) => m.userId));

  return {
    readers,
    unreadMembers: participants.filter((m) => !readerIds.has(m.userId)),
    readerCount: readers.length,
    totalReaders: participants.length,
  };
}

export type ImPopupDirection = 'up' | 'down';

export function chooseImPopupDirection(input: {
  triggerTop: number;
  triggerBottom: number;
  viewportHeight: number;
  panelHeight: number;
  gap?: number;
}): ImPopupDirection {
  const gap = input.gap ?? 8;
  const spaceAbove = input.triggerTop - gap;
  const spaceBelow = input.viewportHeight - input.triggerBottom - gap;

  if (spaceAbove < input.panelHeight && spaceBelow > spaceAbove) {
    return 'down';
  }
  return 'up';
}
