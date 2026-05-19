import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/domain/errors';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

export interface CreateEventCommand {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone?: string;
  ownerId: string;
  attendees?: string[];
  location?: string;
  meetingUrl?: string;
  tenantId?: string;
}

export class CalendarService {
  constructor(private ctx: ApplicationContext) {}

  async list(opts?: { ownerId?: string; from?: Date; to?: Date }): Promise<CalendarEvent[]> {
    if (opts?.ownerId) {
      return this.ctx.calendarRepo.findByOwner(opts.ownerId, opts.from && opts.to ? { from: opts.from, to: opts.to } : undefined);
    }
    return this.ctx.calendarRepo.list();
  }

  async getById(id: string): Promise<CalendarEvent | null> {
    return this.ctx.calendarRepo.findById(id);
  }

  async create(cmd: CreateEventCommand): Promise<CalendarEvent> {
    if (!cmd.title.trim()) throw new ValidationError('title is required');
    const start = new Date(cmd.startAt);
    const end = new Date(cmd.endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new ValidationError('invalid datetime');
    if (end <= start) throw new ValidationError('endAt must be after startAt');

    return this.ctx.calendarRepo.create({
      title: cmd.title.trim(),
      description: cmd.description ?? null,
      startAt: cmd.startAt,
      endAt: cmd.endAt,
      timezone: cmd.timezone ?? 'Asia/Shanghai',
      allDay: false,
      ownerId: cmd.ownerId,
      attendees: cmd.attendees ?? [cmd.ownerId],
      location: cmd.location ?? null,
      meetingUrl: cmd.meetingUrl ?? null,
      calendarSource: 'manual',
      status: 'confirmed',
      tenantId: cmd.tenantId ?? 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async invite(id: string, userIds: string[], inviterId: string): Promise<CalendarEvent> {
    const ev = await this.ctx.calendarRepo.findById(id);
    if (!ev) throw new NotFoundError('CalendarEvent', id);
    if (ev.ownerId !== inviterId) throw new ForbiddenError('Only owner can invite');

    const updated = await this.ctx.calendarRepo.addAttendees(id, userIds);

    for (const uid of userIds) {
      if (!ev.attendees?.includes(uid)) {
        await this.ctx.notificationRepo.create({
          userId: uid,
          type: 'reminder',
          title: `会议邀请: ${ev.title}`,
          body: `你被邀请参加 ${new Date(ev.startAt).toLocaleString()} 的会议`,
          data: { eventId: ev.id, inviter: inviterId },
          priority: 'normal',
          channel: 'in-app',
          tenantId: ev.tenantId,
          createdAt: new Date().toISOString(),
        } as any);
      }
    }

    return updated;
  }

  async cancel(id: string, actorId: string): Promise<CalendarEvent> {
    const ev = await this.ctx.calendarRepo.findById(id);
    if (!ev) throw new NotFoundError('CalendarEvent', id);
    if (ev.ownerId !== actorId) throw new ForbiddenError('Only owner can cancel');
    return this.ctx.calendarRepo.cancel(id);
  }
}
