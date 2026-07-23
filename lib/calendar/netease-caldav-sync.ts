import { ValidationError } from '@/lib/domain/errors';
import { decrypt } from '@/lib/infra/crypto';
import {
  NeteaseCalDavClient,
  type NeteaseCalDavClientLike,
  type NeteaseCalDavSyncStats,
} from '@/lib/integrations/netease-caldav';
import type { NeteaseCalendarEvent } from '@/lib/integrations/netease-calendar';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import type { CalendarEventRepository } from '@/lib/repositories/calendar-repo';
import { getStore } from '@/lib/storage/repository';
import type { CalendarUser } from '@/lib/types/calendar-management';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

export interface SyncNeteaseCalDavCalendarCommand {
  userId: string;
  tenantId: string;
  email: string;
  from?: Date;
  to?: Date;
}

export interface SyncNeteaseCalDavCalendarResult {
  ok: true;
  source: 'netease_caldav';
  from: string;
  to: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  cancelled: number;
  warnings: string[];
}

interface NeteaseCalDavCalendarSyncDependencies {
  calendarRepo?: CalendarEventRepository;
  listUsers?: (tenantId: string) => Promise<CalendarUser[]>;
  getCredentials?: (userId: string) => Promise<{ account: string; password: string } | null>;
  createClient?: (credentials: { account: string; password: string }) => NeteaseCalDavClientLike;
  now?: () => Date;
}

type NeteaseCalDavClientWithStats = NeteaseCalDavClientLike & {
  getLastStats?: () => NeteaseCalDavSyncStats | null;
};

export async function syncNeteaseCalDavCalendar(
  command: SyncNeteaseCalDavCalendarCommand,
  deps: NeteaseCalDavCalendarSyncDependencies = {},
): Promise<SyncNeteaseCalDavCalendarResult> {
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

  const client: NeteaseCalDavClientWithStats = (deps.createClient ?? ((creds) => new NeteaseCalDavClient(creds)))(credentials);
  const incoming = await client.listEvents({ from, to });
  const stats = client.getLastStats?.() ?? null;

  const calendarRepo = deps.calendarRepo ?? createAppContext().calendarRepo;
  const users = await (deps.listUsers ?? listTenantUsers)(command.tenantId);
  const usersByEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
  const existing = await calendarRepo.list({ ownerId: command.userId, tenantId: command.tenantId });
  const existingByExternalId = new Map(
    existing
      .filter((event) => event.calendarSource === 'netease' && event.externalId)
      .map((event) => [event.externalId!, event]),
  );
  const existingBySignature = groupExistingNeteaseEventsBySignature(existing);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let cancelled = 0;
  const warnings: string[] = [];
  if (stats) warnings.push(formatCalDavStats(stats));
  if (incoming.length === 0) {
    warnings.push('CalDAV 已连接成功，但当前同步范围内没有解析到日程；如果网页/手机有日程，请检查这些日程是否来自订阅日历，或服务端是否需要用 calendar-multiget/展开 recurring event。');
  }
  const nowIso = now.toISOString();
  const ownerEmail = normalizeEmail(command.email);
  const incomingExternalIds = new Set<string>();

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
    incomingExternalIds.add(draft.externalId!);

    const signature = calendarEventSignature(draft);
    const signatureMatches = existingBySignature.get(signature) ?? [];
    const found = existingByExternalId.get(draft.externalId!) ?? signatureMatches[0];
    if (found) {
      const patch = diffCalendarEvent(found, draft);
      if (Object.keys(patch).length === 0) {
        skipped += 1;
      } else {
        await calendarRepo.update(found.id, patch);
        updated += 1;
      }
      for (const duplicate of signatureMatches) {
        if (duplicate.id === found.id || duplicate.status === 'cancelled') continue;
        await calendarRepo.update(duplicate.id, { status: 'cancelled', updatedAt: nowIso });
        cancelled += 1;
      }
    } else {
      const createdEvent = await calendarRepo.create(draft);
      existingByExternalId.set(createdEvent.externalId!, createdEvent);
      const nextMatches = existingBySignature.get(signature) ?? [];
      nextMatches.push(createdEvent);
      existingBySignature.set(signature, nextMatches);
      created += 1;
    }
    if (draft.status === 'cancelled') cancelled += 1;
  }
  cancelled += await cancelMissingCalDavEvents({
    calendarRepo,
    existing,
    incomingExternalIds,
    from,
    to,
    nowIso,
    shouldRun: shouldCancelMissingCalDavEvents(incoming, stats),
  });

  return {
    ok: true,
    source: 'netease_caldav',
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

  const sourceCalendarName = getSourceCalendarName(item);
  const sourceCalendarIsSubscription = isSubscribedSourceCalendar(sourceCalendarName);
  return {
    title: formatNeteaseCalendarTitle(item.title.trim() || '未命名日程', sourceCalendarName),
    description: formatNeteaseDescription(item.description, sourceCalendarIsSubscription ? sourceCalendarName : null),
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

function diffCalendarEvent(current: CalendarEvent, next: Omit<CalendarEvent, 'id'>): Partial<CalendarEvent> {
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
    'externalId',
  ] as const) {
    if (current[key] !== next[key]) patch[key] = next[key] as never;
  }
  for (const key of ['attendees', 'attendeeEmails', 'externalAttendeeEmails'] as const) {
    if (!sameStringArray(current[key] ?? [], next[key] ?? [])) patch[key] = next[key] as never;
  }
  if (Object.keys(patch).length > 0) patch.updatedAt = next.updatedAt;
  return patch;
}

async function cancelMissingCalDavEvents(input: {
  calendarRepo: CalendarEventRepository;
  existing: CalendarEvent[];
  incomingExternalIds: Set<string>;
  from: Date;
  to: Date;
  nowIso: string;
  shouldRun: boolean;
}): Promise<number> {
  if (!input.shouldRun) return 0;
  let cancelled = 0;
  for (const event of input.existing) {
    if (!isActiveCalDavEvent(event)) continue;
    if (!eventOverlapsRange(event, input.from, input.to)) continue;
    if (input.incomingExternalIds.has(event.externalId!)) continue;
    await input.calendarRepo.update(event.id, { status: 'cancelled', updatedAt: input.nowIso });
    cancelled += 1;
  }
  return cancelled;
}

function shouldCancelMissingCalDavEvents(
  incoming: NeteaseCalendarEvent[],
  stats: NeteaseCalDavSyncStats | null,
): boolean {
  if (incoming.length > 0) return true;
  if (!stats || stats.calendarCount === 0) return false;
  return !stats.calendars.some((calendar) => (
    calendar.resourceCount > 0
    && calendar.eventCount === 0
    && calendar.parseFailures.length > 0
  ));
}

async function getPersonalEmailCredentials(userId: string): Promise<{ account: string; password: string } | null> {
  const credentials = await getStore().userEmailCredentials.get(userId);
  if (!credentials?.smtpPassEncrypted) return null;
  return {
    account: credentials.smtpUser,
    password: credentials.imapPassEncrypted
      ? decrypt(credentials.imapPassEncrypted)
      : decrypt(credentials.smtpPassEncrypted),
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

function isActiveCalDavEvent(event: CalendarEvent): boolean {
  return event.calendarSource === 'netease'
    && event.status !== 'cancelled'
    && typeof event.externalId === 'string'
    && event.externalId.startsWith('netease-caldav:');
}

function eventOverlapsRange(event: CalendarEvent, from: Date, to: Date): boolean {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end > from && start < to;
}

function groupExistingNeteaseEventsBySignature(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const bySignature = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (event.calendarSource !== 'netease' || event.status === 'cancelled') continue;
    const signature = calendarEventSignature(event);
    const bucket = bySignature.get(signature) ?? [];
    bucket.push(event);
    bySignature.set(signature, bucket);
  }
  return bySignature;
}

function calendarEventSignature(event: Pick<CalendarEvent, 'title' | 'startAt' | 'endAt'>): string {
  return [
    normalizeEventTitle(event.title),
    new Date(event.startAt).toISOString(),
    new Date(event.endAt).toISOString(),
  ].join('|');
}

function normalizeEventTitle(title: string): string {
  return title
    .replace(/^[^,，]{1,24}[,，]\s*(忙碌|Busy)$/i, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getSourceCalendarName(item: NeteaseCalendarEvent): string | null {
  const value = item.raw?.calendarName;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isSubscribedSourceCalendar(calendarName: string | null): boolean {
  if (!calendarName) return false;
  return !/^(我的日历|个人日历|默认日历|网易日历)$/i.test(calendarName.trim());
}

function formatNeteaseCalendarTitle(title: string, calendarName: string | null): string {
  if (!isSubscribedSourceCalendar(calendarName)) return title;
  const ownerName = extractSubscribedCalendarOwner(calendarName!);
  if (!ownerName) return title;
  if (/^(忙碌|busy)$/i.test(title.trim())) return `${ownerName}，忙碌`;
  if (title.startsWith(`${ownerName}，`) || title.startsWith(`${ownerName},`)) return title;
  return `${ownerName}，${title}`;
}

function extractSubscribedCalendarOwner(calendarName: string): string {
  return calendarName
    .replace(/[（(].*?[）)]/g, '')
    .replace(/的(日历|日程)$/g, '')
    .trim();
}

function formatNeteaseDescription(description: string | null | undefined, calendarName: string | null): string | null {
  const lines = [description?.trim()].filter((line): line is string => Boolean(line));
  if (calendarName) lines.push(`来源日历：${calendarName}`);
  return lines.length ? lines.join('\n') : null;
}

function formatCalDavStats(stats: NeteaseCalDavSyncStats): string {
  const calendars = stats.calendars
    .slice(0, 5)
    .map((calendar) => {
      const failures = calendar.parseFailures.length ? `，未解析原因：${calendar.parseFailures.join('/')}` : '';
      return `${calendar.displayName || calendar.href}: 资源 ${calendar.resourceCount}，事件 ${calendar.eventCount}${failures}`;
    })
    .join('；');
  return `CalDAV 诊断：发现 ${stats.calendarCount} 个日历${calendars ? `（${calendars}）` : ''}`;
}
