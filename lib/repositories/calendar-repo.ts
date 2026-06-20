import type { CalendarEvent } from '@/lib/types/feishu-catchup';

export interface CalendarEventRepository {
  findById(id: string): Promise<CalendarEvent | null>;
  findByOwner(ownerId: string, range?: { from: Date; to: Date }): Promise<CalendarEvent[]>;
  findByAttendee(userId: string, range?: { from: Date; to: Date }): Promise<CalendarEvent[]>;
  create(draft: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<CalendarEvent>;
  updateTime(id: string, startAt: string, endAt: string): Promise<CalendarEvent>;
  addAttendees(id: string, userIds: string[]): Promise<CalendarEvent>;
  removeAttendees(id: string, userIds: string[]): Promise<CalendarEvent>;
  cancel(id: string): Promise<CalendarEvent>;
  list(filter?: { ownerId?: string; tenantId?: string }): Promise<CalendarEvent[]>;
}
