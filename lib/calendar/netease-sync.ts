import { ValidationError } from '@/lib/domain/errors';
import { decrypt } from '@/lib/infra/crypto';
import { NeteaseCalendarClient, type NeteaseCalendarClientLike, type NeteaseCalendarEvent } from '@/lib/integrations/netease-calendar';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import type { CalendarEventRepository } from '@/lib/repositories/calendar-repo';
import { getStore } from '@/lib/storage/repository';
import type { CalendarUser } from '@/lib/types/calendar-management';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

export interface SyncNeteaseCalendarCommand {
  userId: string;
  tenantId: string;
  email: string;
  from?: Date;
  to?: Date;
  verifyCode?: string;
}

export interface SyncNeteaseCalendarResult {
  ok: true;
  source: 'netease';
  from: string;
  to: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  cancelled: number;
  warnings: string[];
}

interface NeteaseCalendarSyncDependencies {
  calendarRepo?: CalendarEventRepository;
  listUsers?: (tenantId: string) => Promise<CalendarUser[]>;
  getCredentials?: (userId: string) => Promise<{ account: string; password: string } | null>;
  createClient?: (credentials: { account: string; password: string; verifyCode?: string }) => NeteaseCalendarClientLike;
  now?: () => Date;
}

export async function syncNeteaseCalendar(
  command: SyncNeteaseCalendarCommand,
  deps: NeteaseCalendarSyncDependencies = {},
): Promise<SyncNeteaseCalendarResult> {
  const now = deps.now?.() ?? new Date();
  const from = command.from ?? startOfMonth(now);
  const to = command.to ?? startOfNextMonth(now);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new ValidationError('同步时间范围不合法');
  }

  const credentials = await (deps.getCredentials ?? getPersonalEmailCredentials)(command.userId);
  if (!credentials) {
    throw new ValidationError('未绑定公司邮箱，请先在邮箱设置里输入邮箱地址和密码。');
  }

  const client = (deps.createClient ?? ((creds) => new NeteaseCalendarClient(creds)))({
    ...credentials,
    verifyCode: command.verifyCode,
  });
  const incoming = await client.listEvents({ from, to });

  const calendarRepo = deps.calendarRepo ?? createAppContext().calendarRepo;
  const users = await (deps.listUsers ?? listTenantUsers)(command.tenantId);
  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
  const existing = await calendarRepo.list({ ownerId: command.userId, tenantId: command.tenantId });
  const existingByExternalId = new Map(
    existing
      .filter((event) => event.calendarSource === 'netease' && event.externalId)
      .map((event) => [event.externalId!, event]),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let cancelled = 0;
  const warnings: string[] = [];
  const nowIso = now.toISOString();
  const ownerEmail = normalizeEmail(command.email);

  for (const item of incoming) {
    const draft = toCalendarDraft(item, {
      ownerId: command.userId,
      ownerEmail,
      tenantId: command.tenantId,
      usersByEmail,
      nowIso,
    });
    if (!draft) {
      skipped += 1;
      continue;
    }

    const found = existingByExternalId.get(draft.externalId!);
    if (found) {
      const patch = diffCalendarEvent(found, draft);
      if (Object.keys(patch).length === 0) {
        skipped += 1;
      } else {
        await calendarRepo.update(found.id, patch);
        updated += 1;
      }
    } else {
      await calendarRepo.create(draft);
      created += 1;
    }
    if (draft.status === 'cancelled') cancelled += 1;
  }

  return {
    ok: true,
    source: 'netease',
    from: from.toISOString(),
    to: to.toISOString(),
    total: incoming.length,
    created,
    updated,
    skipped,
    cancelled,
    warnings,
  };
}

function toCalendarDraft(
  item: NeteaseCalendarEvent,
  ctx: {
    ownerId: string;
    ownerEmail: string;
    tenantId: string;
    usersByEmail: Map<string, CalendarUser>;
    nowIso: string;
  },
): Omit<CalendarEvent, 'id'> | null {
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  if (!item.externalId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;

  const attendeeEmails = uniqueEmails(item.attendeeEmails).filter((email) => email !== ctx.ownerEmail);
  const internalAttendees = attendeeEmails
    .map((email) => ctx.usersByEmail.get(email))
    .filter((user): user is CalendarUser => user !== undefined && user.id !== ctx.ownerId);
  const internalEmailSet = new Set(internalAttendees.map((user) => normalizeEmail(user.email)));

  return {
    title: item.title.trim() || '未命名日程',
    description: item.description?.trim() || null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timezone: item.timezone || 'Asia/Shanghai',
    allDay: item.allDay,
    recurringRule: null,
    ownerId: ctx.ownerId,
    attendees: internalAttendees.map((user) => user.id),
    attendeeEmails,
    externalAttendeeEmails: attendeeEmails.filter((email) => !internalEmailSet.has(email)),
    reminderMinutes: null,
    seriesId: null,
    recurrenceIndex: null,
    location: item.location?.trim() || null,
    meetingUrl: item.meetingUrl?.trim() || null,
    calendarSource: 'netease',
    externalId: item.externalId,
    status: item.status,
    tenantId: ctx.tenantId,
    createdAt: ctx.nowIso,
    updatedAt: ctx.nowIso,
  };
}

function diffCalendarEvent(
  current: CalendarEvent,
  next: Omit<CalendarEvent, 'id'>,
): Partial<CalendarEvent> {
  const patch: Partial<CalendarEvent> = {};
  for (const key of [
    'title',
    'description',
    'startAt',
    'endAt',
    'timezone',
    'allDay',
    'ownerId',
    'location',
    'meetingUrl',
    'status',
    'tenantId',
  ] as const) {
    if (current[key] !== next[key]) patch[key] = next[key] as never;
  }
  for (const key of ['attendees', 'attendeeEmails', 'externalAttendeeEmails'] as const) {
    if (!sameStringArray(current[key] ?? [], next[key] ?? [])) patch[key] = next[key] as never;
  }
  if (Object.keys(patch).length > 0) patch.updatedAt = next.updatedAt;
  return patch;
}

async function getPersonalEmailCredentials(userId: string): Promise<{ account: string; password: string } | null> {
  const credentials = await getStore().userEmailCredentials.get(userId);
  if (!credentials?.smtpPassEncrypted) return null;
  return {
    account: credentials.smtpUser,
    password: decrypt(credentials.smtpPassEncrypted),
  };
}

async function listTenantUsers(tenantId: string): Promise<CalendarUser[]> {
  return (await getStore().auth.users.list({ tenantId }))
    .filter((user) => !user.disabled)
    .map((user) => ({ id: user.id, email: user.email, name: user.name }));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function uniqueEmails(emails: string[]): string[] {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Array.from(new Set(emails.map(normalizeEmail).filter((email) => pattern.test(email))));
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}
