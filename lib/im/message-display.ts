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

/**
 * §B4 日期分割线文案: 今天 / 昨天 / M月D日 / YYYY年M月D日 (跨年)。
 */
export function formatImDateDivider(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (!isValidDate(date)) return '';
  if (isSameLocalDate(date, now)) return '今天';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDate(date, yesterday)) return '昨天';

  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * §B4 是否在当前消息上方插入日期分割线: 无 prev (首条) 或跨本地自然日。
 */
export function shouldShowImDateDivider(
  prevIso: string | null | undefined,
  currentIso: string,
): boolean {
  const current = new Date(currentIso);
  if (!isValidDate(current)) return false;
  if (!prevIso) return true;
  const prev = new Date(prevIso);
  if (!isValidDate(prev)) return true;
  return !isSameLocalDate(prev, current);
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
