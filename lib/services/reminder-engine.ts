import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { DeliveredReminder, ReminderChannel, ReminderTask } from '@/lib/types/reminder';
import { NotificationService } from './notification-service';

export interface ScheduleReminderCommand {
  tenantId?: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  dedupeKey?: string;
  title: string;
  body?: string;
  url?: string | null;
  remindAt: string | Date;
  channels?: ReminderChannel[];
  priority?: ReminderTask['priority'];
}

export interface ProcessReminderResult {
  processed: number;
  sent: number;
  failed: number;
  delivered: DeliveredReminder[];
}

const MAX_RETRY_COUNT = 3;

export class ReminderEngine {
  constructor(
    private ctx: Pick<ApplicationContext, 'notificationRepo' | 'reminderTaskRepo'>,
    private deps: { now?: () => Date } = {},
  ) {}

  async schedule(cmd: ScheduleReminderCommand): Promise<ReminderTask> {
    const nowIso = this.now().toISOString();
    const tenantId = cmd.tenantId ?? 'default';
    const remindAt = toIso(cmd.remindAt);
    if (!cmd.userId) throw new Error('userId is required');
    if (!cmd.sourceType) throw new Error('sourceType is required');
    if (!cmd.sourceId) throw new Error('sourceId is required');
    if (!cmd.title.trim()) throw new Error('title is required');
    const dedupeKey = cmd.dedupeKey ?? `${cmd.sourceType}:${cmd.sourceId}:${cmd.userId}`;
    const existing = await this.ctx.reminderTaskRepo.findByDedupeKey(tenantId, dedupeKey);
    const draft = {
      tenantId,
      userId: cmd.userId,
      sourceType: cmd.sourceType,
      sourceId: cmd.sourceId,
      dedupeKey,
      title: cmd.title.trim(),
      body: cmd.body?.trim() ?? '',
      url: cmd.url ?? null,
      remindAt,
      channels: cmd.channels?.length ? cmd.channels : ['in_app', 'toast', 'web_push'] as ReminderChannel[],
      priority: cmd.priority ?? 'high' as const,
      status: 'pending' as const,
      retryCount: 0,
      lastError: null,
      processingAt: null,
      sentAt: null,
      updatedAt: nowIso,
    };

    if (existing && existing.status !== 'sent') {
      return this.ctx.reminderTaskRepo.update(existing.id, draft);
    }
    if (existing && existing.status === 'sent') {
      return this.ctx.reminderTaskRepo.create({
        ...draft,
        dedupeKey: `${dedupeKey}:${Date.now().toString(36)}`,
        createdAt: nowIso,
      });
    }
    return this.ctx.reminderTaskRepo.create({
      ...draft,
      createdAt: nowIso,
    });
  }

  async scheduleMany(commands: ScheduleReminderCommand[]): Promise<ReminderTask[]> {
    const tasks: ReminderTask[] = [];
    for (const command of commands) tasks.push(await this.schedule(command));
    return tasks;
  }

  async cancelBySource(tenantId: string, sourceType: string, sourceId: string): Promise<number> {
    return this.ctx.reminderTaskRepo.cancelBySource(tenantId, sourceType, sourceId);
  }

  async processDue(filter: { tenantId?: string; userId?: string; limit?: number } = {}): Promise<ProcessReminderResult> {
    const nowIso = this.now().toISOString();
    const due = await this.ctx.reminderTaskRepo.claimDue(nowIso, { limit: 100, maxRetryCount: MAX_RETRY_COUNT, ...filter });
    const delivered: DeliveredReminder[] = [];
    let sent = 0;
    let failed = 0;
    const notificationService = new NotificationService(this.ctx);

    for (const task of due) {
      try {
        const notification = await notificationService.create({
          userId: task.userId,
          type: 'reminder',
          title: task.title,
          body: task.body,
          data: { url: task.url ?? undefined, sourceType: task.sourceType, sourceId: task.sourceId, reminderTaskId: task.id },
          priority: task.priority,
          channel: 'in-app',
          sourceId: task.sourceId,
          sourceType: task.sourceType,
          tenantId: task.tenantId,
        });
        const sentAt = this.now().toISOString();
        const updated = await this.ctx.reminderTaskRepo.update(task.id, {
          status: 'sent',
          sentAt,
          processingAt: null,
          lastError: null,
          updatedAt: sentAt,
        });
        delivered.push({ task: updated, notificationId: notification.id });
        sent += 1;
      } catch (error) {
        failed += 1;
        await this.ctx.reminderTaskRepo.update(task.id, {
          status: 'failed',
          retryCount: task.retryCount + 1,
          processingAt: null,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: this.now().toISOString(),
        }).catch(() => undefined);
      }
    }

    return { processed: sent + failed, sent, failed, delivered };
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }
}

function toIso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('remindAt is invalid');
  return date.toISOString();
}

export function createReminderEngine(ctx: Pick<ApplicationContext, 'notificationRepo' | 'reminderTaskRepo'>, deps?: { now?: () => Date }): ReminderEngine {
  return new ReminderEngine(ctx, deps);
}
