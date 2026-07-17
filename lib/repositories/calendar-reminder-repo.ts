import type { CalendarReminderTask } from '@/lib/types/calendar-management';

export interface CalendarReminderRepository {
  create(draft: Omit<CalendarReminderTask, 'id'> & { id?: string }): Promise<CalendarReminderTask>;
  list(filter?: { eventId?: string; userId?: string; tenantId?: string; status?: CalendarReminderTask['status'] }): Promise<CalendarReminderTask[]>;
  cancelByEventIds(eventIds: string[]): Promise<void>;
  markFired(id: string, firedAt: string): Promise<CalendarReminderTask>;
}

