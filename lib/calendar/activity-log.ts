import { getStore } from '@/lib/storage/repository';

export type CalendarActivityAction =
  | 'event.created'
  | 'event.updated'
  | 'event.cancelled'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.approved'
  | 'subscription.rejected'
  | 'subscription.revoked';

export interface CalendarActivityLog {
  id: string;
  tenantId: string;
  actorId: string;
  actorEmail?: string;
  actorName?: string;
  action: CalendarActivityAction;
  targetType: 'event' | 'subscription';
  targetId: string;
  eventId?: string;
  eventTitle?: string;
  scope?: 'single' | 'future' | 'series';
  attendeeEmails?: string[];
  targetUserId?: string;
  subscriberId?: string;
  detailPermission?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export async function recordCalendarActivity(input: Omit<CalendarActivityLog, 'id' | 'occurredAt'> & {
  id?: string;
  occurredAt?: string;
}): Promise<CalendarActivityLog | null> {
  const log: CalendarActivityLog = {
    ...input,
    id: input.id ?? `calact_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
  try {
    const repo = getStore().calendarActivityLogs;
    if (!repo) {
      console.warn('[calendar-activity] repository unavailable, skip activity log');
      return null;
    }
    return await repo.create(log);
  } catch (error) {
    console.warn('[calendar-activity] write failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function listCalendarActivities(input: {
  tenantId: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: CalendarActivityLog[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 20)));
  const repo = getStore().calendarActivityLogs;
  if (!repo) {
    return { items: [], total: 0, page, pageSize };
  }
  const all = await repo.list({ tenantId: input.tenantId });
  const sorted = all.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const offset = (page - 1) * pageSize;
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
  };
}
