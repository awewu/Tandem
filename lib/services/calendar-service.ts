import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/domain/errors';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';
import type { CalendarMutationScope, CalendarRecurrenceRule, CalendarUser } from '@/lib/types/calendar-management';
import type { CalendarJob, CalendarJobResult } from '@/lib/calendar/job-store';
import { getCalendarJobStore } from '@/lib/calendar/job-store';
import { recordCalendarActivity } from '@/lib/calendar/activity-log';
import { getStore } from '@/lib/storage/repository';
import { transferChannelOwnerForSystem } from '@/lib/im/service';
import { membershipKey } from '@/lib/types/im';
import { CALENDAR_IM_TOPIC_PREFIX, eventIdFromTopic } from '@/lib/services/calendar-im-reminder-service';
import { ReminderEngine } from './reminder-engine';

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

export interface CreateManagedEventCommand extends Omit<CreateEventCommand, 'attendees'> {
  ownerEmail: string;
  ownerName?: string;
  attendeeEmails?: string[];
  reminderMinutes?: number | null;
  recurrence?: CalendarRecurrenceRule | null;
}

export interface CalendarEmailMessage {
  to: string[];
  subject: string;
  text: string;
  senderUserId?: string;
  senderEmail?: string;
}

export interface CalendarServiceDependencies {
  now?: () => Date;
  listUsers?: (tenantId: string) => Promise<CalendarUser[]>;
  checkEmailSender?: (message: CalendarEmailMessage) => Promise<{ ok: boolean; error?: string }>;
  sendEmail?: (message: CalendarEmailMessage) => Promise<{ ok: boolean; error?: string; warning?: string }>;
}

export type CalendarJobStep = 'validating' | 'creating_events' | 'creating_reminders' | 'sending_emails' | 'finalizing';

export interface CalendarProgressReporter {
  onStep(step: CalendarJobStep, status: 'pending' | 'in_progress' | 'done' | 'failed', detail?: string): void;
  addPersistedEventId(eventId: string): void;
  markEmailSent(): void;
  getPersistedEventIds(): string[];
  isEmailSent(): boolean;
}

export interface UpdateManagedEventCommand {
  ownerEmail?: string;
  title?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  location?: string | null;
  meetingUrl?: string | null;
  attendeeEmails?: string[];
  reminderMinutes?: number | null;
  recurrence?: CalendarRecurrenceRule | null;
}

export interface CalendarViewEvent extends CalendarEvent {
  hasConflict: boolean;
  organizer?: CalendarUser;
  attendeeUsers?: CalendarUser[];
}

export interface SubscribedCalendarViewEvent extends CalendarViewEvent {
  visibility: 'busy' | 'full';
}

type CalendarApplicationContext = Pick<
  ApplicationContext,
  'calendarRepo' | 'notificationRepo' | 'calendarReminderRepo' | 'calendarSubscriptionRepo' | 'reminderTaskRepo'
>;

export class CalendarService {
  private readonly deliveryWarnings: string[] = [];

  constructor(
    private ctx: CalendarApplicationContext,
    private deps: CalendarServiceDependencies = {},
  ) {}

  getDeliveryWarnings(): string[] {
    return [...this.deliveryWarnings];
  }

  private addDeliveryWarning(message: string): void {
    if (!this.deliveryWarnings.includes(message)) this.deliveryWarnings.push(message);
  }

  async list(opts?: { ownerId?: string; from?: Date; to?: Date; tenantId?: string }): Promise<CalendarEvent[]> {
    const events = opts?.ownerId
      ? await this.ctx.calendarRepo.findByOwner(opts.ownerId, opts.from && opts.to ? { from: opts.from, to: opts.to } : undefined)
      : await this.ctx.calendarRepo.list({ tenantId: opts?.tenantId });
    // 租户隔离: findByOwner 路径无 tenant 列下推 (owner 已隐含单租户), 防御性再过滤一次.
    return opts?.tenantId ? events.filter((e) => (e.tenantId ?? 'default') === opts.tenantId) : events;
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
    const timezone = cmd.timezone ?? 'Asia/Shanghai';
    const now = this.deps.now?.() ?? new Date();
    if (calendarDateKey(start, timezone) < calendarDateKey(now, timezone)) {
      throw new ValidationError('cannot create an event on a past date');
    }

    return this.ctx.calendarRepo.create({
      title: cmd.title.trim(),
      description: cmd.description ?? null,
      startAt: cmd.startAt,
      endAt: cmd.endAt,
      timezone,
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

  async createManaged(cmd: CreateManagedEventCommand): Promise<CalendarEvent[]> {
    this.deliveryWarnings.length = 0;
    validateEventInput(cmd, this.deps.now?.() ?? new Date());
    validateAttendeeEmails(cmd.attendeeEmails);
    validateReminderMinutes(cmd.reminderMinutes);
    validateRecurrence(cmd.recurrence);

    const tenantId = cmd.tenantId ?? 'default';
    const users = await this.deps.listUsers?.(tenantId) ?? [];
    const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
    const attendeeEmails = uniqueEmails(cmd.attendeeEmails ?? []).filter((email) => email !== normalizeEmail(cmd.ownerEmail));
    const internalAttendees = attendeeEmails
      .map((email) => usersByEmail.get(email))
      .filter((user): user is CalendarUser => user !== undefined && user.id !== cmd.ownerId);
    const externalAttendeeEmails = attendeeEmails.filter((email) => !usersByEmail.has(email));
    const starts = materializeRecurrence(new Date(cmd.startAt), cmd.recurrence);
    const durationMs = new Date(cmd.endAt).getTime() - new Date(cmd.startAt).getTime();
    const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
    const seriesId = cmd.recurrence ? crypto.randomUUID() : null;
    const events: CalendarEvent[] = [];

    for (let index = 0; index < starts.length; index += 1) {
      const start = starts[index];
      const event = await this.ctx.calendarRepo.create({
        title: cmd.title.trim(),
        description: cmd.description?.trim() || null,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + durationMs).toISOString(),
        timezone: cmd.timezone ?? 'Asia/Shanghai',
        allDay: false,
        recurringRule: (cmd.recurrence ?? null) as unknown as Record<string, unknown> | null,
        ownerId: cmd.ownerId,
        attendees: internalAttendees.map((user) => user.id),
        attendeeEmails,
        externalAttendeeEmails,
        reminderMinutes: cmd.reminderMinutes ?? null,
        seriesId,
        recurrenceIndex: cmd.recurrence ? index : null,
        location: cmd.location?.trim() || null,
        meetingUrl: cmd.meetingUrl?.trim() || null,
        calendarSource: 'manual',
        externalId: null,
        status: 'confirmed',
        tenantId,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      events.push(event);

      await this.createReminderTasks(event, nowIso);
    }

    if (events[0]) {
      await recordCalendarActivity({
        tenantId,
        actorId: cmd.ownerId,
        actorEmail: cmd.ownerEmail,
        actorName: cmd.ownerName,
        action: 'event.created',
        targetType: 'event',
        targetId: events[0].id,
        eventId: events[0].id,
        eventTitle: events[0].title,
        attendeeEmails,
        metadata: {
          eventIds: events.map((event) => event.id),
          recurrenceCount: events.length,
          emailDelivery: 'awaited',
        },
      });
    }

    const recipients = attendeeEmails.filter((email) => email !== normalizeEmail(cmd.ownerEmail));
    if (recipients.length > 0 && events[0]) {
      await this.deliverEmail({
        to: recipients,
        subject: `【日程通知】${events[0].title}`,
        text: buildCalendarEmail('created', events[0], formatPerson(cmd.ownerName, cmd.ownerEmail), users),
        senderUserId: cmd.ownerId,
        senderEmail: cmd.ownerEmail,
      });
    }

    return events;
  }

  /**
   * Resumable async creation with per-step progress.
   * Each step checkpoints state into the job store so a crash or timeout
   * does not lose work: events already persisted are skipped on resume.
   */
  async createManagedAsync(job: CalendarJob): Promise<void> {
    this.deliveryWarnings.length = 0;
    const store = getCalendarJobStore();
    const jobId = job.id;
    try {
      await store.update(jobId, { status: 'running' });
      const cmd = job.input;

      // Step 1: validate (no IO, instant)
      if ((await store.get(jobId))?.steps.find((s) => s.key === 'validating')?.status !== 'done') {
        await store.markStep(jobId, 'validating', 'in_progress');
        const validateCmd = {
          ...cmd,
          description: cmd.description ?? undefined,
          location: cmd.location ?? undefined,
          meetingUrl: cmd.meetingUrl ?? undefined,
        };
        validateEventInput(validateCmd, this.deps.now?.() ?? new Date());
        validateAttendeeEmails(cmd.attendeeEmails);
        validateReminderMinutes(cmd.reminderMinutes);
        validateRecurrence(cmd.recurrence);
        await store.markStep(jobId, 'validating', 'done');
      }

      // Step 2: create events (resume-safe — skip already persisted indices)
      const createStep = (await store.get(jobId))?.steps.find((s) => s.key === 'creating_events');
      if (createStep?.status !== 'done') {
        await store.markStep(jobId, 'creating_events', 'in_progress');
        const tenantId = cmd.tenantId ?? 'default';
        const users = await this.deps.listUsers?.(tenantId) ?? [];
        await store.update(jobId, { input: { ...cmd, attendeeUsers: users } });
        const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
        const attendeeEmails = uniqueEmails(cmd.attendeeEmails ?? []).filter((email) => email !== normalizeEmail(cmd.ownerEmail));
        const internalAttendees = attendeeEmails
          .map((email) => usersByEmail.get(email))
          .filter((user): user is CalendarUser => user !== undefined && user.id !== cmd.ownerId);
        const externalAttendeeEmails = attendeeEmails.filter((email) => !usersByEmail.has(email));
        const starts = materializeRecurrence(new Date(cmd.startAt), cmd.recurrence);
        const durationMs = new Date(cmd.endAt).getTime() - new Date(cmd.startAt).getTime();
        const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
        const seriesId = cmd.recurrence ? crypto.randomUUID() : null;

        // resume: skip indices we already persisted
        const alreadyPersisted = (await store.get(jobId))?.persistedEventIds.length ?? 0;
        for (let index = alreadyPersisted; index < starts.length; index += 1) {
          const start = starts[index];
          const event = await this.ctx.calendarRepo.create({
            title: cmd.title.trim(),
            description: cmd.description?.trim() || null,
            startAt: start.toISOString(),
            endAt: new Date(start.getTime() + durationMs).toISOString(),
            timezone: cmd.timezone ?? 'Asia/Shanghai',
            allDay: false,
            recurringRule: (cmd.recurrence ?? null) as unknown as Record<string, unknown> | null,
            ownerId: cmd.ownerId,
            attendees: internalAttendees.map((user) => user.id),
            attendeeEmails,
            externalAttendeeEmails,
            reminderMinutes: cmd.reminderMinutes ?? null,
            seriesId,
            recurrenceIndex: cmd.recurrence ? index : null,
            location: cmd.location?.trim() || null,
            meetingUrl: cmd.meetingUrl?.trim() || null,
            calendarSource: 'manual',
            externalId: null,
            status: 'confirmed',
            tenantId,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          await store.addPersistedEventId(jobId, event.id);
          await store.markStep(jobId, 'creating_events', 'in_progress', `已写入 ${index + 1}/${starts.length} 个日程实例`);
        }
        await store.markStep(jobId, 'creating_events', 'done', `已创建 ${starts.length} 个日程实例`);
      }

      // Step 3: create reminder tasks
      const creatingStep = (await store.get(jobId))?.steps.find((s) => s.key === 'creating_reminders');
      if (creatingStep?.status !== 'done') {
        await store.markStep(jobId, 'creating_reminders', 'in_progress');
        const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
        const currentJob = await store.get(jobId);
        const eventIds = currentJob?.persistedEventIds ?? [];
        let reminderCount = 0;
        for (const eventId of eventIds) {
          const event = await this.ctx.calendarRepo.findById(eventId);
          if (event) {
            await this.createReminderTasks(event, nowIso);
            reminderCount += 1;
          }
        }
        await store.markStep(jobId, 'creating_reminders', 'done', `已为 ${reminderCount} 个日程生成提醒`);
      }

      // Step 4: enqueue one batched email delivery in the background.
      // Calendar creation should not wait for SMTP/IMAP latency.
      const emailJob = await store.get(jobId);
      const emailStep = emailJob?.steps.find((s) => s.key === 'sending_emails');
      let shouldDeliverEmailInBackground = false;
      if (emailStep?.status !== 'done' && !emailJob?.emailSent) {
        const recipientEmails = uniqueEmails(emailJob?.input.attendeeEmails ?? [])
          .filter((email) => email !== normalizeEmail(emailJob?.input.ownerEmail ?? ''));
        if (recipientEmails.length === 0) {
          await store.markStep(jobId, 'sending_emails', 'done', '无收件人，跳过邮件');
        } else if (await this.checkEmailSender({
          to: recipientEmails,
          subject: `【日程通知】${emailJob?.input.title ?? ''}`,
          text: '',
          senderUserId: emailJob?.input.ownerId,
          senderEmail: emailJob?.input.ownerEmail,
        })) {
          await store.markStep(jobId, 'sending_emails', 'done', '已移交后台投递，不影响日程创建');
          shouldDeliverEmailInBackground = true;
        } else {
          await store.markStep(jobId, 'sending_emails', 'failed', this.deliveryWarnings.at(-1) ?? 'email delivery failed');
        }
      } else if (emailJob?.emailSent && emailStep?.status !== 'done') {
        await store.markStep(jobId, 'sending_emails', 'done', '邮件已发送');
      }

      // Step 5: finalize
      await store.markStep(jobId, 'finalizing', 'in_progress');
      const finalJob = await store.get(jobId);
      const finalEvents: CalendarEvent[] = [];
      for (const eventId of finalJob?.persistedEventIds ?? []) {
        const ev = await this.ctx.calendarRepo.findById(eventId);
        if (ev) finalEvents.push(ev);
      }
      if (finalEvents[0]) {
        await recordCalendarActivity({
          id: `calact_create_${jobId}`,
          tenantId: cmd.tenantId,
          actorId: cmd.ownerId,
          actorEmail: cmd.ownerEmail,
          actorName: cmd.ownerName,
          action: 'event.created',
          targetType: 'event',
          targetId: finalEvents[0].id,
          eventId: finalEvents[0].id,
          eventTitle: finalEvents[0].title,
          attendeeEmails: finalEvents[0].attendeeEmails ?? [],
          metadata: {
            jobId,
            eventIds: finalEvents.map((event) => event.id),
            recurrenceCount: finalEvents.length,
            emailDelivery: shouldDeliverEmailInBackground ? 'background' : 'skipped_or_completed',
          },
        });
      }
      const latestJob = await store.get(jobId);
      const result: CalendarJobResult = {
        events: finalEvents,
        warnings: this.getDeliveryWarnings(),
      };
      await store.markStep(jobId, 'finalizing', 'done');
      await store.update(jobId, { status: 'completed', result });
      if (shouldDeliverEmailInBackground) {
        void this.sendCreateJobEmail(jobId).catch((error) => {
          // sendCreateJobEmail records the failure on the job; this catch only
          // prevents an unhandled rejection if the store itself errors.
          // eslint-disable-next-line no-console
          console.error('[calendar-job] background email failed:', error);
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failedStep = (await store.get(jobId))?.steps.find((s) => s.status === 'in_progress');
      if (failedStep) await store.markStep(jobId, failedStep.key, 'failed', message);
      const current = await store.get(jobId);
      const hasProgress = (current?.persistedEventIds.length ?? 0) > 0 || (current?.emailSent ?? false);
      await store.update(jobId, { status: hasProgress ? 'partial' : 'failed', error: message });
    }
  }

  /** Re-run a job from its last checkpoint. */
  async resumeCreateJob(jobId: string): Promise<void> {
    const store = getCalendarJobStore();
    const job = await store.get(jobId);
    if (!job) throw new NotFoundError('CalendarJob', jobId);
    if (job.status === 'running') return;
    // Mark failed steps as pending so they retry
    const resetSteps = job.steps.map((s) =>
      s.status === 'failed'
        ? { ...s, status: 'pending' as const, detail: undefined, startedAt: undefined, finishedAt: undefined }
        : s
    );
    await store.update(jobId, { status: 'running', steps: resetSteps, error: undefined });
    const updated = await store.get(jobId);
    if (updated) await this.createManagedAsync(updated);
  }

  private async sendCreateJobEmail(jobId: string): Promise<void> {
    const store = getCalendarJobStore();
    const currentJob = await store.get(jobId);
    if (!currentJob || currentJob.emailSent) return;
    const eventIds = currentJob.persistedEventIds ?? [];
    const firstEvent = eventIds[0] ? await this.ctx.calendarRepo.findById(eventIds[0]) : null;
    if (!firstEvent) return;

    const recipientEmails = uniqueEmails(currentJob.input.attendeeEmails ?? [])
      .filter((email) => email !== normalizeEmail(currentJob.input.ownerEmail));

    try {
      if (recipientEmails.length > 0) {
        const users = currentJob.input.attendeeUsers ?? [];
        const emailOk = await this.deliverEmail({
          to: recipientEmails,
          subject: `【日程通知】${firstEvent.title}`,
          text: buildCalendarEmail('created', firstEvent, formatPerson(currentJob.input.ownerName, currentJob.input.ownerEmail), users),
          senderUserId: currentJob.input.ownerId,
          senderEmail: currentJob.input.ownerEmail,
        });
        if (!emailOk) {
          throw new Error(this.deliveryWarnings.at(-1) ?? 'email delivery failed');
        }
      }

      await store.markStep(
        jobId,
        'sending_emails',
        'done',
        recipientEmails.length > 0 ? `已批量发送给 ${recipientEmails.length} 个收件人` : '无收件人，跳过邮件',
      );
      await store.markEmailSent(jobId);
      const latest = await store.get(jobId);
      if (latest?.result) {
        await store.update(jobId, {
          result: {
            ...latest.result,
            warnings: latest.result.warnings,
          },
          error: undefined,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'email delivery failed';
      await store.markStep(jobId, 'sending_emails', 'failed', message);
      const latest = await store.get(jobId);
      if (latest?.result) {
        await store.update(jobId, {
          result: {
            ...latest.result,
            warnings: Array.from(new Set([
              ...latest.result.warnings,
              message,
            ])),
          },
          error: message,
        });
      } else {
        await store.update(jobId, { error: message });
      }
    }
  }

  async updateManaged(
    id: string,
    actorId: string,
    scope: CalendarMutationScope,
    patch: UpdateManagedEventCommand,
    options: { notify?: 'await' | 'background' } = {},
  ): Promise<CalendarEvent[]> {
    this.deliveryWarnings.length = 0;
    const anchor = await this.requireOwnedEvent(id, actorId);
    validateAttendeeEmails(patch.attendeeEmails);
    validateReminderMinutes(patch.reminderMinutes);
    if (patch.recurrence !== undefined) validateRecurrence(patch.recurrence);
    const targets = await this.selectMutationTargets(anchor, scope);
    const now = this.deps.now?.() ?? new Date();
    const newAnchorStart = patch.startAt ? new Date(patch.startAt) : new Date(anchor.startAt);
    const newAnchorEnd = patch.endAt ? new Date(patch.endAt) : new Date(anchor.endAt);
    if (Number.isNaN(newAnchorStart.getTime()) || Number.isNaN(newAnchorEnd.getTime()) || newAnchorEnd <= newAnchorStart) {
      throw new ValidationError('endAt must be after startAt');
    }
    if (calendarDateKey(newAnchorStart, anchor.timezone) < calendarDateKey(now, anchor.timezone)) {
      throw new ValidationError('cannot move an event to a past date');
    }

    const tenantUsers = await this.deps.listUsers?.(anchor.tenantId) ?? [];
    const usersByEmail = new Map(tenantUsers.map((user) => [normalizeEmail(user.email), user]));
    const attendeeEmails = patch.attendeeEmails === undefined
      ? (anchor.attendeeEmails ?? [])
      : uniqueEmails(patch.attendeeEmails).filter((email) => email !== normalizeEmail(tenantUsers.find((user) => user.id === anchor.ownerId)?.email ?? ''));
    const attendees = patch.attendeeEmails === undefined
      ? anchor.attendees
      : attendeeEmails
          .map((email) => usersByEmail.get(email))
          .filter((user): user is CalendarUser => user !== undefined && user.id !== anchor.ownerId)
          .map((user) => user.id);
    const externalAttendeeEmails = patch.attendeeEmails === undefined
      ? (anchor.externalAttendeeEmails ?? [])
      : attendeeEmails.filter((email) => !usersByEmail.has(email));
    const startDelta = newAnchorStart.getTime() - new Date(anchor.startAt).getTime();
    const endDelta = newAnchorEnd.getTime() - new Date(anchor.endAt).getTime();
    const updated: CalendarEvent[] = [];
    const shouldRescheduleReminders = patch.startAt !== undefined || patch.endAt !== undefined ||
      patch.reminderMinutes !== undefined || patch.attendeeEmails !== undefined || patch.recurrence !== undefined;
    const notifyUpdated = async (after?: CalendarEvent) => {
      if (!after) return;
      await this.sendMutationEmail('updated', anchor, after, tenantUsers, patch.ownerEmail);
    };
    const scheduleUpdatedNotification = async (after?: CalendarEvent) => {
      if (options.notify === 'background') {
        void notifyUpdated(after).catch((error) => {
          this.deliveryWarnings.push(error instanceof Error ? error.message : 'email delivery failed');
        });
        return;
      }
      await notifyUpdated(after);
    };

    if (shouldRescheduleReminders) {
      await this.ctx.calendarReminderRepo.cancelByEventIds(targets.map((event) => event.id));
      await this.cancelReminderTasksForEvents(targets);
    }
    if (patch.recurrence !== undefined && (scope !== 'single' || !anchor.seriesId)) {
      const materializationStart = scope === 'series' && targets[0]
        ? new Date(new Date(targets[0].startAt).getTime() + startDelta)
        : newAnchorStart;
      const starts = materializeRecurrence(materializationStart, patch.recurrence);
      const durationMs = newAnchorEnd.getTime() - newAnchorStart.getTime();
      const nextSeriesId = patch.recurrence ? (anchor.seriesId ?? crypto.randomUUID()) : null;
      const activeTargets: CalendarEvent[] = [];
      for (let index = 0; index < starts.length; index += 1) {
        const existing = targets[index];
        const start = starts[index];
        const common = {
          title: patch.title?.trim() || anchor.title,
          description: patch.description === undefined ? anchor.description : (patch.description?.trim() || null),
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + durationMs).toISOString(),
          recurringRule: (patch.recurrence ?? null) as unknown as Record<string, unknown> | null,
          seriesId: nextSeriesId,
          recurrenceIndex: patch.recurrence ? (anchor.recurrenceIndex ?? 0) + index : null,
          location: patch.location === undefined ? anchor.location : (patch.location?.trim() || null),
          meetingUrl: patch.meetingUrl === undefined ? anchor.meetingUrl : (patch.meetingUrl?.trim() || null),
          attendeeEmails,
          attendees,
          externalAttendeeEmails,
          reminderMinutes: patch.reminderMinutes === undefined ? anchor.reminderMinutes : patch.reminderMinutes,
          status: 'confirmed' as const,
          updatedAt: now.toISOString(),
        };
        const next = existing
          ? await this.ctx.calendarRepo.update(existing.id, common)
          : await this.ctx.calendarRepo.create({
              ...common,
              timezone: anchor.timezone,
              allDay: anchor.allDay,
              ownerId: anchor.ownerId,
              calendarSource: anchor.calendarSource,
              externalId: null,
              tenantId: anchor.tenantId,
              createdAt: now.toISOString(),
            });
        activeTargets.push(next);
        await this.createReminderTasks(next, now.toISOString(), true);
      }
      updated.push(...activeTargets);
      for (const extra of targets.slice(starts.length)) {
        updated.push(await this.ctx.calendarRepo.update(extra.id, { status: 'cancelled', updatedAt: now.toISOString() }));
      }
      await recordCalendarActivity({
        tenantId: anchor.tenantId,
        actorId,
        actorEmail: patch.ownerEmail,
        action: 'event.updated',
        targetType: 'event',
        targetId: activeTargets[0]?.id ?? anchor.id,
        eventId: activeTargets[0]?.id ?? anchor.id,
        eventTitle: activeTargets[0]?.title ?? anchor.title,
        scope,
        attendeeEmails,
        metadata: {
          eventIds: updated.map((event) => event.id),
          recurrenceRematerialized: true,
        },
      });
      await scheduleUpdatedNotification(activeTargets[0]);
      return updated;
    }

    for (const event of targets) {
      const next = await this.ctx.calendarRepo.update(event.id, {
        title: patch.title?.trim() || event.title,
        description: patch.description === undefined ? event.description : (patch.description?.trim() || null),
        startAt: new Date(new Date(event.startAt).getTime() + startDelta).toISOString(),
        endAt: new Date(new Date(event.endAt).getTime() + endDelta).toISOString(),
        location: patch.location === undefined ? event.location : (patch.location?.trim() || null),
        meetingUrl: patch.meetingUrl === undefined ? event.meetingUrl : (patch.meetingUrl?.trim() || null),
        attendeeEmails,
        attendees,
        externalAttendeeEmails,
        reminderMinutes: patch.reminderMinutes === undefined ? event.reminderMinutes : patch.reminderMinutes,
        recurringRule: patch.recurrence === undefined
          ? event.recurringRule
          : (patch.recurrence as unknown as Record<string, unknown> | null),
        updatedAt: now.toISOString(),
      });
      updated.push(next);
      if (shouldRescheduleReminders) await this.createReminderTasks(next, now.toISOString(), true);
    }

    await recordCalendarActivity({
      tenantId: anchor.tenantId,
      actorId,
      actorEmail: patch.ownerEmail,
      action: 'event.updated',
      targetType: 'event',
      targetId: updated[0]?.id ?? anchor.id,
      eventId: updated[0]?.id ?? anchor.id,
      eventTitle: updated[0]?.title ?? anchor.title,
      scope,
      attendeeEmails,
      metadata: {
        eventIds: updated.map((event) => event.id),
      },
    });
    await scheduleUpdatedNotification(updated[0]);
    return updated;
  }

  async cancelManaged(
    id: string,
    actorId: string,
    scope: CalendarMutationScope,
    ownerEmail?: string,
    options: { notify?: 'await' | 'background' } = {},
  ): Promise<CalendarEvent[]> {
    this.deliveryWarnings.length = 0;
    const anchor = await this.requireOwnedEvent(id, actorId);
    const targets = await this.selectMutationTargets(anchor, scope);
    const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
    const cancelled: CalendarEvent[] = [];
    for (const event of targets) {
      cancelled.push(await this.ctx.calendarRepo.update(event.id, { status: 'cancelled', updatedAt: nowIso }));
    }
    await this.ctx.calendarReminderRepo.cancelByEventIds(targets.map((event) => event.id));
    await this.cancelReminderTasksForEvents(targets);
    await recordCalendarActivity({
      tenantId: anchor.tenantId,
      actorId,
      actorEmail: ownerEmail,
      action: 'event.cancelled',
      targetType: 'event',
      targetId: cancelled[0]?.id ?? anchor.id,
      eventId: cancelled[0]?.id ?? anchor.id,
      eventTitle: cancelled[0]?.title ?? anchor.title,
      scope,
      attendeeEmails: anchor.attendeeEmails ?? [],
      metadata: {
        eventIds: cancelled.map((event) => event.id),
      },
    });
    const sendCancelEmail = async () => {
      const users = await this.deps.listUsers?.(anchor.tenantId) ?? [];
      await this.sendMutationEmail('cancelled', anchor, cancelled[0], users, ownerEmail);
    };
    if (options.notify === 'background') {
      void sendCancelEmail().catch((error) => {
        this.deliveryWarnings.push(error instanceof Error ? error.message : 'email delivery failed');
      });
    } else {
      await sendCancelEmail();
    }
    return cancelled;
  }

  async transferOwnerManaged(
    id: string,
    actorId: string,
    newOwnerId: string,
    scope: CalendarMutationScope,
    actorEmail?: string,
  ): Promise<CalendarEvent[]> {
    this.deliveryWarnings.length = 0;
    if (!newOwnerId || newOwnerId === actorId) {
      throw new ValidationError('newOwnerId must be another meeting attendee');
    }
    const anchor = await this.requireOwnedEvent(id, actorId);
    const tenantUsers = await this.deps.listUsers?.(anchor.tenantId) ?? [];
    const usersById = new Map(tenantUsers.map((user) => [user.id, user]));
    const nextOwner = usersById.get(newOwnerId);
    if (!nextOwner) throw new ValidationError('new owner must be an active tenant user');
    if (!isEventParticipant(anchor, nextOwner)) {
      throw new ValidationError('new owner must be a meeting attendee');
    }

    const targets = await this.selectMutationTargets(anchor, scope);
    const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
    await this.ctx.calendarReminderRepo.cancelByEventIds(targets.map((event) => event.id));
    await this.cancelReminderTasksForEvents(targets);

    const actorUser = usersById.get(actorId);
    const actorAttendeeEmail = normalizeEmail(actorUser?.email ?? actorEmail ?? '');
    const nextOwnerEmail = normalizeEmail(nextOwner.email);
    const updated: CalendarEvent[] = [];

    for (const event of targets) {
      const attendees = uniqueIds([
        ...event.attendees.filter((userId) => userId !== newOwnerId),
        actorId,
      ]);
      const attendeeEmails = uniqueEmails([
        ...(event.attendeeEmails ?? []),
        actorAttendeeEmail,
      ]).filter((email) => email !== nextOwnerEmail);
      const externalAttendeeEmails = uniqueEmails(event.externalAttendeeEmails ?? [])
        .filter((email) => email !== nextOwnerEmail && email !== actorAttendeeEmail);
      const next = await this.ctx.calendarRepo.update(event.id, {
        ownerId: newOwnerId,
        attendees,
        attendeeEmails,
        externalAttendeeEmails,
        updatedAt: nowIso,
      });
      updated.push(next);
      await this.createReminderTasks(next, nowIso, true);
    }

    await recordCalendarActivity({
      tenantId: anchor.tenantId,
      actorId,
      actorEmail,
      action: 'event.updated',
      targetType: 'event',
      targetId: updated[0]?.id ?? anchor.id,
      eventId: updated[0]?.id ?? anchor.id,
      eventTitle: updated[0]?.title ?? anchor.title,
      scope,
      targetUserId: newOwnerId,
      attendeeEmails: updated[0]?.attendeeEmails ?? anchor.attendeeEmails ?? [],
      metadata: {
        eventIds: updated.map((event) => event.id),
        ownerTransferredFrom: actorId,
        ownerTransferredTo: newOwnerId,
      },
    });
    await this.transferLinkedMeetingGroupOwners(updated, actorId, newOwnerId, anchor.tenantId);
    return updated;
  }

  async leaveManaged(
    id: string,
    actorId: string,
    scope: CalendarMutationScope,
    actorEmail?: string,
    options: { sideEffects?: 'await' | 'background' } = {},
  ): Promise<CalendarEvent[]> {
    this.deliveryWarnings.length = 0;
    const anchor = await this.ctx.calendarRepo.findById(id);
    if (!anchor) throw new NotFoundError('CalendarEvent', id);
    if (anchor.ownerId === actorId) throw new ForbiddenError('Organizer cannot leave own event');

    const normalizedActorEmail = normalizeEmail(actorEmail ?? '');
    const isAttendee = anchor.attendees.includes(actorId) ||
      (!!normalizedActorEmail && (anchor.attendeeEmails ?? []).some((email) => normalizeEmail(email) === normalizedActorEmail));
    if (!isAttendee) throw new ForbiddenError('Only attendees can leave this event');

    const targets = await this.selectLeaveTargets(anchor, scope);
    const eventIds = targets.map((event) => event.id);
    const updated = await this.ctx.calendarRepo.removeAttendeeFromEvents(eventIds, actorId, normalizedActorEmail || undefined);

    const runSideEffects = async () => {
      await this.ctx.calendarReminderRepo.cancelByEventIdsForUser(eventIds, actorId);
      await this.ctx.reminderTaskRepo.cancelBySourceIdsForUser(anchor.tenantId, 'calendar_event', eventIds, actorId);
      await recordCalendarActivity({
        tenantId: anchor.tenantId,
        actorId,
        actorEmail,
        action: 'event.left',
        targetType: 'event',
        targetId: updated[0]?.id ?? anchor.id,
        eventId: updated[0]?.id ?? anchor.id,
        eventTitle: updated[0]?.title ?? anchor.title,
        scope,
        targetUserId: anchor.ownerId,
        attendeeEmails: uniqueEmails([actorEmail ?? '', ...(anchor.attendeeEmails ?? [])]),
        metadata: {
          eventIds,
          leftUserId: actorId,
          leftUserEmail: normalizedActorEmail || undefined,
        },
      });
    };
    if (options.sideEffects === 'background') {
      void runSideEffects().catch((error) => {
        this.deliveryWarnings.push(error instanceof Error ? error.message : 'calendar leave cleanup failed');
      });
    } else {
      await runSideEffects();
    }

    return updated;
  }

  async listForUser(userId: string, tenantId: string, range?: { from: Date; to: Date }): Promise<CalendarViewEvent[]> {
    const all = await this.ctx.calendarRepo.list({ tenantId });
    const users = await this.deps.listUsers?.(tenantId) ?? [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
    const visible = all
      .filter((event) => (event.ownerId === userId || event.attendees.includes(userId)))
      .filter((event) => !range || (new Date(event.startAt) < range.to && new Date(event.endAt) > range.from))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    return visible.map((event) => ({
      ...event,
      organizer: usersById.get(event.ownerId),
      attendeeUsers: uniqueEmails(event.attendeeEmails ?? [])
        .map((email) => usersByEmail.get(email))
        .filter((user): user is CalendarUser => user !== undefined),
      hasConflict: event.status !== 'cancelled' && visible.some((other) => (
        other.id !== event.id &&
        other.status !== 'cancelled' &&
        new Date(event.startAt) < new Date(other.endAt) &&
        new Date(event.endAt) > new Date(other.startAt)
      )),
    }));
  }

  async listSubscribedCalendar(
    viewerId: string,
    targetUserId: string,
    tenantId: string,
    range?: { from: Date; to: Date },
  ): Promise<SubscribedCalendarViewEvent[]> {
    const subscription = await this.ctx.calendarSubscriptionRepo.findByUsers(viewerId, targetUserId, tenantId);
    if (!subscription || subscription.status !== 'subscribed') {
      throw new ForbiddenError('calendar is not subscribed');
    }
    const events = await this.listForUser(targetUserId, tenantId, range);
    if (subscription.detailPermission === 'approved') {
      return events.map((event) => ({ ...event, visibility: 'full' }));
    }
    return events.map((event) => ({
      ...event,
      title: '忙碌',
      description: null,
      ownerId: '',
      attendees: [],
      attendeeEmails: [],
      externalAttendeeEmails: [],
      attendeeUsers: [],
      location: null,
      meetingUrl: null,
      reminderMinutes: null,
      recurringRule: null,
      organizer: undefined,
      visibility: 'busy',
    }));
  }

  async processDueReminders(userId: string, tenantId: string): Promise<CalendarEvent[]> {
    const result = await new ReminderEngine(this.ctx, this.deps).processDue({ userId, tenantId });
    const firedEvents: CalendarEvent[] = [];
    for (const delivered of result.delivered) {
      if (delivered.task.sourceType !== 'calendar_event') continue;
      const event = await this.ctx.calendarRepo.findById(delivered.task.sourceId);
      if (event) {
        const legacyTasks = await this.ctx.calendarReminderRepo.list({
          eventId: event.id,
          userId: delivered.task.userId,
          tenantId,
          status: 'pending',
        });
        for (const task of legacyTasks) {
          await this.ctx.calendarReminderRepo.markFired(task.id, delivered.task.sentAt ?? new Date().toISOString());
        }
        firedEvents.push(event);
      }
    }
    return firedEvents;
  }

  async cancel(id: string, actorId: string): Promise<CalendarEvent> {
    const ev = await this.ctx.calendarRepo.findById(id);
    if (!ev) throw new NotFoundError('CalendarEvent', id);
    if (ev.ownerId !== actorId) throw new ForbiddenError('Only owner can cancel');
    return this.ctx.calendarRepo.cancel(id);
  }

  private async requireOwnedEvent(id: string, actorId: string): Promise<CalendarEvent> {
    const event = await this.ctx.calendarRepo.findById(id);
    if (!event) throw new NotFoundError('CalendarEvent', id);
    if (event.ownerId !== actorId) throw new ForbiddenError('Only owner can change this event');
    return event;
  }

  private async selectMutationTargets(anchor: CalendarEvent, scope: CalendarMutationScope): Promise<CalendarEvent[]> {
    if (scope === 'single' || !anchor.seriesId) return [anchor];
    const series = (await this.ctx.calendarRepo.findBySeries(anchor.seriesId)).filter((event) => event.status !== 'cancelled');
    if (scope === 'future') return series.filter((event) => event.startAt >= anchor.startAt);
    const now = this.deps.now?.() ?? new Date();
    return series.filter((event) => new Date(event.endAt) >= now);
  }

  private async selectLeaveTargets(anchor: CalendarEvent, scope: CalendarMutationScope): Promise<CalendarEvent[]> {
    if (scope === 'single' || !anchor.seriesId) return [anchor];
    const series = (await this.ctx.calendarRepo.findBySeries(anchor.seriesId)).filter((event) => event.status !== 'cancelled');
    return scope === 'future'
      ? series.filter((event) => event.startAt >= anchor.startAt)
      : series;
  }

  private async createReminderTasks(event: CalendarEvent, nowIso: string, preserveFired = false): Promise<void> {
    if (event.reminderMinutes === null || event.reminderMinutes === undefined || event.status === 'cancelled') return;
    try {
      const remindAt = new Date(new Date(event.startAt).getTime() - event.reminderMinutes * 60_000).toISOString();
      const firedUsers = preserveFired
        ? new Set((await this.ctx.calendarReminderRepo.list({ eventId: event.id, status: 'fired' })).map((task) => task.userId))
        : new Set<string>();
      const reminderEngine = new ReminderEngine(this.ctx, this.deps);
      for (const userId of [event.ownerId, ...event.attendees]) {
        if (firedUsers.has(userId)) continue;
        await this.ctx.calendarReminderRepo.create({
          eventId: event.id,
          userId,
          remindAt,
          status: 'pending',
          tenantId: event.tenantId,
          firedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        await reminderEngine.schedule({
          tenantId: event.tenantId,
          userId,
          sourceType: 'calendar_event',
          sourceId: event.id,
          dedupeKey: `calendar_event:${event.id}:${userId}`,
          title: `日程提醒: ${event.title}`,
          body: `${new Date(event.startAt).toLocaleString('zh-CN')} 开始${event.location ? ` · ${event.location}` : ''}`,
          url: '/calendar',
          remindAt,
          channels: ['in_app', 'toast', 'web_push'],
          priority: 'high',
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.addDeliveryWarning(`提醒任务暂未生成，日程已保存；请稍后重试或联系管理员检查提醒中心配置。${detail}`);
    }
  }

  private async cancelReminderTasksForEvents(events: CalendarEvent[]): Promise<void> {
    const engine = new ReminderEngine(this.ctx, this.deps);
    for (const event of events) {
      try {
        await engine.cancelBySource(event.tenantId, 'calendar_event', event.id);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.addDeliveryWarning(`提醒任务暂未同步取消，日程状态已更新；请稍后重试或联系管理员检查提醒中心配置。${detail}`);
      }
    }
  }

  private async transferLinkedMeetingGroupOwners(
    events: CalendarEvent[],
    currentOwnerId: string,
    newOwnerId: string,
    tenantId: string,
  ): Promise<void> {
    const eventIds = new Set(events.map((event) => event.id));
    const store = getStore();
    const channels = await store.imChannels.list({ tenantId });
    for (const channel of channels) {
      if (channel.archivedAt || channel.autoCreated !== true || !channel.topic?.startsWith(CALENDAR_IM_TOPIC_PREFIX)) {
        continue;
      }
      if (!eventIds.has(eventIdFromTopic(channel.topic))) continue;
      const currentOwnerMembership = await store.imMemberships.get(membershipKey(channel.id, currentOwnerId));
      const currentUserOwnsGroup = channel.createdBy === currentOwnerId || currentOwnerMembership?.role === 'owner';
      if (!currentUserOwnsGroup) continue;
      try {
        await transferChannelOwnerForSystem(channel.id, newOwnerId);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.addDeliveryWarning(`日程已转交，但关联 IM 群主转让失败：${detail}`);
      }
    }
  }

  private async sendMutationEmail(
    kind: 'updated' | 'cancelled',
    before: CalendarEvent,
    after: CalendarEvent,
    users: CalendarUser[],
    ownerEmail?: string,
  ): Promise<void> {
    const owner = users.find((user) => user.id === before.ownerId);
    const organizerEmail = normalizeEmail(owner?.email ?? ownerEmail ?? '');
    const recipients = uniqueEmails([...(before.attendeeEmails ?? []), ...(after.attendeeEmails ?? [])])
      .filter((email) => email !== organizerEmail);
    if (recipients.length === 0) return;
    await this.deliverEmail({
      to: recipients,
      subject: `${kind === 'updated' ? '【日程变更】' : '【日程取消】'}${after.title}`,
      text: buildCalendarEmail(kind, after, formatCalendarUser(owner, ownerEmail ?? before.ownerId), users),
      senderUserId: before.ownerId,
      senderEmail: organizerEmail || ownerEmail,
    });
  }

  private async deliverEmail(message: CalendarEmailMessage): Promise<boolean> {
    if (!this.deps.sendEmail) {
      this.addDeliveryWarning('email service is unavailable');
      return false;
    }
    if (!await this.checkEmailSender(message)) return false;
    const result = await this.deps.sendEmail(message);
    if (!result.ok) {
      this.addDeliveryWarning(result.error || 'email delivery failed');
      return false;
    }
    if (result.warning) this.addDeliveryWarning(result.warning);
    return true;
  }

  private async checkEmailSender(message: CalendarEmailMessage): Promise<boolean> {
    if (!this.deps.checkEmailSender) return true;
    const result = await this.deps.checkEmailSender(message);
    if (result.ok) return true;
    this.addDeliveryWarning(result.error || 'email delivery failed');
    return false;
  }
}

function calendarDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function validateEventInput(cmd: CreateEventCommand, now: Date): void {
  if (!cmd.title?.trim()) throw new ValidationError('title is required');
  const start = new Date(cmd.startAt);
  const end = new Date(cmd.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ValidationError('invalid datetime');
  if (end <= start) throw new ValidationError('endAt must be after startAt');
  const timezone = cmd.timezone ?? 'Asia/Shanghai';
  if (calendarDateKey(start, timezone) < calendarDateKey(now, timezone)) {
    throw new ValidationError('cannot create an event on a past date');
  }
}

function validateAttendeeEmails(value: unknown): asserts value is string[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((email) => typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim()))) {
    throw new ValidationError('attendeeEmails must be an array of valid email addresses');
  }
}

function validateReminderMinutes(value: unknown): asserts value is number | null | undefined {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ValidationError('reminderMinutes must be a non-negative integer');
  }
}

function validateRecurrence(rule: unknown): asserts rule is CalendarRecurrenceRule | null | undefined {
  if (!rule) return;
  if (typeof rule !== 'object' || Array.isArray(rule)) throw new ValidationError('invalid recurrence rule');
  const candidate = rule as Record<string, unknown>;
  if (!['daily', 'weekly', 'monthly', 'weekdays', 'custom'].includes(String(candidate.frequency))) {
    throw new ValidationError('invalid recurrence frequency');
  }
  if (typeof candidate.end !== 'object' || candidate.end === null || Array.isArray(candidate.end)) {
    throw new ValidationError('invalid recurrence end');
  }
  const end = candidate.end as Record<string, unknown>;
  if (!Number.isInteger(candidate.interval) || (candidate.interval as number) < 1) {
    throw new ValidationError('recurrence interval must be positive');
  }
  if (!['never', 'date', 'count'].includes(String(end.type))) throw new ValidationError('invalid recurrence end type');
  if (end.type === 'count' && (!Number.isInteger(end.count) || (end.count as number) < 1 || (end.count as number) > 366)) {
    throw new ValidationError('recurrence count must be between 1 and 366');
  }
  if (end.type === 'date' && (typeof end.date !== 'string' || !isCalendarDate(end.date))) {
    throw new ValidationError('recurrence end date must be a valid calendar date');
  }
  if (candidate.weekdays !== undefined && (
    !Array.isArray(candidate.weekdays) ||
    candidate.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )) {
    throw new ValidationError('recurrence weekdays must be between 0 and 6');
  }
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function materializeRecurrence(start: Date, rule?: CalendarRecurrenceRule | null): Date[] {
  if (!rule) return [start];
  const occurrences: Date[] = [];
  const maxCount = rule.end.type === 'count' ? rule.end.count : 366;
  const defaultEnd = new Date(start);
  defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
  const endAt = rule.end.type === 'date' ? new Date(`${rule.end.date}T23:59:59.999`).getTime() : defaultEnd.getTime();

  if (rule.frequency === 'monthly') {
    for (let index = 0; index < maxCount; index += 1) {
      const occurrence = monthlyOccurrence(start, index * rule.interval);
      if (occurrence.getTime() > endAt) break;
      occurrences.push(occurrence);
    }
    return occurrences;
  }

  let cursor = new Date(start);

  while (occurrences.length < maxCount && cursor.getTime() <= endAt) {
    if (matchesRecurrenceDay(cursor, start, rule)) occurrences.push(new Date(cursor));
    cursor = nextRecurrenceCandidate(cursor, rule);
  }
  return occurrences;
}

function matchesRecurrenceDay(date: Date, start: Date, rule: CalendarRecurrenceRule): boolean {
  if (rule.frequency === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5;
  if (rule.frequency === 'weekly' || rule.frequency === 'custom') {
    const weekdays = rule.weekdays?.length ? rule.weekdays : [start.getDay()];
    const startWeek = startOfLocalWeek(start);
    const candidateWeek = startOfLocalWeek(date);
    const weekDistance = Math.round((candidateWeek.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekDistance % rule.interval === 0 && weekdays.includes(date.getDay());
  }
  return true;
}

function startOfLocalWeek(value: Date): Date {
  const date = new Date(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextRecurrenceCandidate(date: Date, rule: CalendarRecurrenceRule): Date {
  const next = new Date(date);
  if (rule.frequency === 'weekly' || rule.frequency === 'custom' || rule.frequency === 'weekdays') next.setDate(next.getDate() + 1);
  else next.setDate(next.getDate() + rule.interval);
  return next;
}

function monthlyOccurrence(start: Date, monthOffset: number): Date {
  const occurrence = new Date(start);
  const dayOfMonth = start.getDate();
  occurrence.setDate(1);
  occurrence.setMonth(occurrence.getMonth() + monthOffset);
  const lastDayOfMonth = new Date(occurrence.getFullYear(), occurrence.getMonth() + 1, 0).getDate();
  occurrence.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return occurrence;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uniqueEmails(emails: string[]): string[] {
  return Array.from(new Set(emails.map(normalizeEmail).filter((email) => EMAIL_PATTERN.test(email))));
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function isEventParticipant(event: CalendarEvent, user: CalendarUser): boolean {
  const email = normalizeEmail(user.email);
  return event.attendees.includes(user.id) ||
    (event.attendeeEmails ?? []).some((attendeeEmail) => normalizeEmail(attendeeEmail) === email);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildCalendarEmail(kind: 'created' | 'updated' | 'cancelled', event: CalendarEvent, organizer: string, users: CalendarUser[] = []): string {
  const heading = kind === 'created' ? '你有一个新的日程安排。' : kind === 'updated' ? '以下日程发生变更。' : '以下日程已取消。';
  const lines = [
    heading,
    '',
    `日程标题: ${event.title}`,
    `发起人: ${organizer}`,
    `${kind === 'cancelled' ? '原开始时间' : '开始时间'}: ${new Date(event.startAt).toLocaleString('zh-CN')}`,
    `${kind === 'cancelled' ? '原结束时间' : '结束时间'}: ${new Date(event.endAt).toLocaleString('zh-CN')}`,
    event.location ? `地点/会议方式: ${event.location}` : '',
    event.reminderMinutes !== null && event.reminderMinutes !== undefined ? `提醒时间: 提前 ${event.reminderMinutes} 分钟` : '',
    event.recurringRule ? `重复规则: ${describeRecurrence(event.recurringRule as unknown as CalendarRecurrenceRule)}` : '',
    event.attendeeEmails?.length ? `参会人: ${formatAttendeeEmails(event.attendeeEmails, users)}` : '',
    event.description ? `\n日程说明:\n${event.description}` : '',
    '',
    kind === 'created' ? '该日程已自动加入系统内参会人的日程，无需确认。\n请按时参加。' : kind === 'updated' ? '请以最新日程信息为准。' : '该日程已取消，请知悉。',
  ];
  return lines.filter((line) => line !== '').join('\n');
}

function formatAttendeeEmails(emails: string[], users: CalendarUser[]): string {
  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
  return uniqueEmails(emails)
    .map((email) => formatCalendarUser(usersByEmail.get(email), email))
    .join(', ');
}

function formatCalendarUser(user: CalendarUser | undefined, fallback: string): string {
  if (!user) return fallback;
  return formatPerson(user.name, user.email);
}

function formatPerson(name: string | undefined, email: string): string {
  const trimmedName = name?.trim();
  const normalizedEmail = email.trim();
  return trimmedName && trimmedName !== normalizedEmail ? `${trimmedName} (${normalizedEmail})` : normalizedEmail;
}

function describeRecurrence(rule: CalendarRecurrenceRule): string {
  const frequency = { daily: '每天', weekly: '每周', monthly: '每月', weekdays: '工作日', custom: '自定义' }[rule.frequency];
  if (rule.end.type === 'count') return `${frequency}，共 ${rule.end.count} 次`;
  if (rule.end.type === 'date') return `${frequency}，至 ${rule.end.date}`;
  return `${frequency}，永不结束`;
}
