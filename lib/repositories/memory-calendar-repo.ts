import type { CalendarEventRepository } from './calendar-repo';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

let _id = 0;
const genId = () => `evt_${++_id}_${Date.now()}`;

export class InMemoryCalendarEventRepository implements CalendarEventRepository {
  private data = new Map<string, CalendarEvent>();

  async findById(id: string): Promise<CalendarEvent | null> { return this.data.get(id) ?? null; }
  async findByOwner(ownerId: string): Promise<CalendarEvent[]> { return Array.from(this.data.values()).filter(e => e.ownerId === ownerId); }
  async findByAttendee(userId: string): Promise<CalendarEvent[]> { return Array.from(this.data.values()).filter(e => e.attendees?.includes(userId)); }
  async create(draft: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<CalendarEvent> {
    const ev = { ...(draft as CalendarEvent), id: draft.id ?? genId() };
    this.data.set(ev.id, ev); return ev;
  }
  async update(id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const event = this.data.get(id); if (!event) throw new Error('not found');
    Object.assign(event, patch);
    return event;
  }
  async removeAttendeeFromEvents(eventIds: string[], userId: string, attendeeEmail?: string): Promise<CalendarEvent[]> {
    const ids = new Set(eventIds);
    const email = attendeeEmail?.trim().toLowerCase();
    const updated: CalendarEvent[] = [];
    for (const event of Array.from(this.data.values())) {
      if (!ids.has(event.id)) continue;
      const next = {
        ...event,
        attendees: (event.attendees ?? []).filter((attendeeId) => attendeeId !== userId),
        attendeeEmails: email
          ? (event.attendeeEmails ?? []).filter((value) => value.trim().toLowerCase() !== email)
          : event.attendeeEmails ?? [],
        externalAttendeeEmails: email
          ? (event.externalAttendeeEmails ?? []).filter((value) => value.trim().toLowerCase() !== email)
          : event.externalAttendeeEmails ?? [],
        updatedAt: new Date().toISOString(),
      };
      this.data.set(event.id, next);
      updated.push(next);
    }
    return updated.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  async findBySeries(seriesId: string): Promise<CalendarEvent[]> {
    return Array.from(this.data.values())
      .filter((event) => event.seriesId === seriesId)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  async updateTime(id: string, startAt: string, endAt: string): Promise<CalendarEvent> {
    const e = this.data.get(id); if (!e) throw new Error('not found');
    e.startAt = startAt; e.endAt = endAt; e.updatedAt = new Date().toISOString(); return e;
  }
  async addAttendees(id: string, userIds: string[]): Promise<CalendarEvent> {
    const e = this.data.get(id); if (!e) throw new Error('not found');
    e.attendees = Array.from(new Set([...(e.attendees ?? []), ...userIds])); return e;
  }
  async removeAttendees(id: string, userIds: string[]): Promise<CalendarEvent> {
    const e = this.data.get(id); if (!e) throw new Error('not found');
    e.attendees = (e.attendees ?? []).filter(a => !userIds.includes(a)); return e;
  }
  async cancel(id: string): Promise<CalendarEvent> {
    const e = this.data.get(id); if (!e) throw new Error('not found');
    e.status = 'cancelled'; return e;
  }
  async list(filter?: { ownerId?: string; tenantId?: string }): Promise<CalendarEvent[]> {
    let arr = Array.from(this.data.values());
    if (filter?.ownerId) arr = arr.filter(e => e.ownerId === filter.ownerId);
    if (filter?.tenantId) arr = arr.filter(e => (e.tenantId ?? 'default') === filter.tenantId);
    return arr;
  }
}
