import type { CalendarReminderRepository } from './calendar-reminder-repo';
import type { CalendarReminderTask } from '@/lib/types/calendar-management';

let nextId = 0;

export class InMemoryCalendarReminderRepository implements CalendarReminderRepository {
  private data = new Map<string, CalendarReminderTask>();

  async create(draft: Omit<CalendarReminderTask, 'id'> & { id?: string }): Promise<CalendarReminderTask> {
    const task = { ...draft, id: draft.id ?? `calendar_reminder_${++nextId}` };
    this.data.set(task.id, task);
    return task;
  }

  async list(filter?: { eventId?: string; userId?: string; tenantId?: string; status?: CalendarReminderTask['status'] }): Promise<CalendarReminderTask[]> {
    return Array.from(this.data.values()).filter((task) => (
      (!filter?.eventId || task.eventId === filter.eventId) &&
      (!filter?.userId || task.userId === filter.userId) &&
      (!filter?.tenantId || task.tenantId === filter.tenantId) &&
      (!filter?.status || task.status === filter.status)
    ));
  }

  async cancelByEventIds(eventIds: string[]): Promise<void> {
    const ids = new Set(eventIds);
    for (const task of Array.from(this.data.values())) {
      if (ids.has(task.eventId) && task.status === 'pending') {
        task.status = 'cancelled';
        task.updatedAt = new Date().toISOString();
      }
    }
  }

  async cancelByEventIdsForUser(eventIds: string[], userId: string): Promise<void> {
    const ids = new Set(eventIds);
    for (const task of Array.from(this.data.values())) {
      if (ids.has(task.eventId) && task.userId === userId && task.status === 'pending') {
        task.status = 'cancelled';
        task.updatedAt = new Date().toISOString();
      }
    }
  }

  async markFired(id: string, firedAt: string): Promise<CalendarReminderTask> {
    const task = this.data.get(id);
    if (!task) throw new Error(`CalendarReminder ${id} not found`);
    task.status = 'fired';
    task.firedAt = firedAt;
    task.updatedAt = firedAt;
    return task;
  }
}
