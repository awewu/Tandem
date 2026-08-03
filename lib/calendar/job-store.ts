/**
 * Calendar event creation async job store (in-process, resumable).
 *
 * Design: when createManaged is slow (SMTP, per-attendee reminder creation,
 * recurrence materialization), the POST /api/calendar route returns 202 with
 * a jobId immediately. The job runs in the background, writing progress + step
 * status. The client polls GET /api/calendar/jobs/[id] for a progress bar and
 * resumable retry.
 *
 * Resumability: each job records the last completed step. If the process dies
 * or the step fails, GET /status shows the failure and POST /resume continues
 * from the last checkpoint. Events already persisted are not re-created.
 */

import type { CalendarEvent } from '@/lib/types/feishu-catchup';
import type { CalendarRecurrenceRule, CalendarUser } from '@/lib/types/calendar-management';
import { getStore } from '@/lib/storage/repository';

export type CalendarJobStep =
  | 'validating'
  | 'creating_events'
  | 'creating_reminders'
  | 'sending_emails'
  | 'finalizing';

export interface CalendarJobProgressStep {
  key: CalendarJobStep;
  label: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface CalendarJobInput {
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  timezone?: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  attendeeEmails?: string[];
  location?: string | null;
  meetingUrl?: string | null;
  reminderMinutes?: number | null;
  recurrence?: CalendarRecurrenceRule | null;
  tenantId: string;
  attendeeUsers?: CalendarUser[];
}

export interface CalendarJobResult {
  events: CalendarEvent[];
  warnings: string[];
}

export interface CalendarJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  input: CalendarJobInput;
  steps: CalendarJobProgressStep[];
  totalSteps: number;
  completedSteps: number;
  /** Event ids already persisted (checkpoint for resume). */
  persistedEventIds: string[];
  /** Whether the email was already sent (checkpoint). */
  emailSent: boolean;
  result?: CalendarJobResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const STEP_LABELS: Record<CalendarJobStep, string> = {
  validating: '校验日程',
  creating_events: '写入日程到参会人',
  creating_reminders: '生成提醒任务',
  sending_emails: '发送邮件通知',
  finalizing: '完成',
};

const STEP_ORDER: CalendarJobStep[] = [
  'validating',
  'creating_events',
  'creating_reminders',
  'sending_emails',
  'finalizing',
];

function nowIso(): string {
  return new Date().toISOString();
}

class CalendarJobStore {
  async create(input: CalendarJobInput): Promise<CalendarJob> {
    const id = `caljob_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const job: CalendarJob = {
      id,
      status: 'pending',
      input,
      steps: STEP_ORDER.map((key) => ({ key, label: STEP_LABELS[key], status: 'pending' as const })),
      totalSteps: STEP_ORDER.length,
      completedSteps: 0,
      persistedEventIds: [],
      emailSent: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return getStore().calendarJobs.create(job);
  }

  async get(id: string): Promise<CalendarJob | null> {
    return getStore().calendarJobs.get(id);
  }

  async update(id: string, patch: Partial<CalendarJob>): Promise<CalendarJob | null> {
    const job = await this.get(id);
    if (!job) return null;
    const next = {
      ...job,
      ...patch,
      completedSteps: (patch.steps ?? job.steps).filter((s) => s.status === 'done').length,
      updatedAt: nowIso(),
    };
    return getStore().calendarJobs.update(id, next);
  }

  async markStep(id: string, step: CalendarJobStep, status: CalendarJobProgressStep['status'], detail?: string): Promise<void> {
    const job = await this.get(id);
    if (!job) return;
    const steps = job.steps.map((item) => {
      if (item.key !== step) return item;
      return {
        ...item,
        status,
        startedAt: status === 'in_progress' ? nowIso() : item.startedAt,
        finishedAt: status === 'done' || status === 'failed' ? nowIso() : item.finishedAt,
        detail: detail !== undefined ? detail : item.detail,
      };
    });
    await this.update(id, { steps });
  }

  async addPersistedEventId(id: string, eventId: string): Promise<void> {
    const job = await this.get(id);
    if (!job) return;
    const persistedEventIds = job.persistedEventIds.includes(eventId)
      ? job.persistedEventIds
      : [...job.persistedEventIds, eventId];
    await this.update(id, { persistedEventIds });
  }

  async markEmailSent(id: string): Promise<void> {
    await this.update(id, { emailSent: true });
  }

  async repairCompletedNotificationStep(id: string): Promise<CalendarJob | null> {
    const job = await this.get(id);
    if (job?.status !== 'completed') return job;
    const emailStep = job.steps.find((step) => step.key === 'sending_emails');
    if (emailStep?.status !== 'in_progress') return job;
    await this.markStep(id, 'sending_emails', 'done', '已移交后台投递，不影响日程创建');
    return this.get(id);
  }
}

// Singleton wrapper on globalThis to survive Next.js dev HMR. Data itself is
// persisted in the app Store (Drizzle KV in production).
type GlobalWithJobs = typeof globalThis & { __tandem_calendar_jobs__?: CalendarJobStore };

const _g = globalThis as GlobalWithJobs;

function store(): CalendarJobStore {
  if (!_g.__tandem_calendar_jobs__) {
    _g.__tandem_calendar_jobs__ = new CalendarJobStore();
  }
  return _g.__tandem_calendar_jobs__;
}

export function getCalendarJobStore(): CalendarJobStore {
  return store();
}
