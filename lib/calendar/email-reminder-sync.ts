import { createHash } from 'crypto';
import { ValidationError } from '@/lib/domain/errors';
import { decrypt } from '@/lib/infra/crypto';
import {
  fetchInbox,
  fetchMessageByUid,
  searchMessages,
  type EmailCredentials,
  type EmailListResult,
  type EmailMessage,
} from '@/lib/integrations/email-tier1';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import type { CalendarEventRepository } from '@/lib/repositories/calendar-repo';
import { getStore } from '@/lib/storage/repository';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

export interface ParsedEmailReminderEvent {
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  sourceText: string;
}

export interface SyncEmailReminderCalendarCommand {
  userId: string;
  tenantId: string;
  email: string;
  from?: Date;
  to?: Date;
}

export interface SyncEmailReminderCalendarResult {
  ok: true;
  source: 'email_reminder';
  from: string;
  to: string;
  total: number;
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  cancelled: number;
  warnings: string[];
}

interface EmailReminderSyncDependencies {
  calendarRepo?: CalendarEventRepository;
  getCredentials?: (userId: string) => Promise<EmailCredentials | null>;
  fetchInbox?: (cred: EmailCredentials, options: { limit?: number; page?: number; folder?: string }) => Promise<EmailListResult>;
  searchMessages?: (cred: EmailCredentials, options: { query: string; folder?: string; limit?: number }) => Promise<EmailMessage[]>;
  fetchMessageByUid?: (cred: EmailCredentials, uid: number, folder?: string) => Promise<EmailMessage | null>;
  now?: () => Date;
}

const SEARCH_TERMS = ['日程提醒', 'Notification: The schedule', 'schedule will start'];

export async function syncCalendarFromEmailReminders(
  command: SyncEmailReminderCalendarCommand,
  deps: EmailReminderSyncDependencies = {},
): Promise<SyncEmailReminderCalendarResult> {
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

  const candidates = await findCandidateMessages(credentials, deps);
  const calendarRepo = deps.calendarRepo ?? createAppContext().calendarRepo;
  const existing = await calendarRepo.list({ ownerId: command.userId, tenantId: command.tenantId });
  const existingByExternalId = new Map(
    existing
      .filter((event) => event.calendarSource === 'netease' && event.externalId)
      .map((event) => [event.externalId!, event]),
  );

  let parsed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const warnings: string[] = [];
  const nowIso = now.toISOString();

  for (const message of candidates) {
    const reminder = parseEmailReminderEvent(message);
    if (!reminder) {
      skipped += 1;
      continue;
    }
    parsed += 1;

    const start = new Date(reminder.startAt);
    const end = new Date(reminder.endAt);
    if (end <= from || start >= to) {
      skipped += 1;
      continue;
    }

    const draft = toCalendarDraft(reminder, {
      ownerId: command.userId,
      tenantId: command.tenantId,
      nowIso,
    });
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
      const createdEvent = await calendarRepo.create(draft);
      existingByExternalId.set(createdEvent.externalId!, createdEvent);
      created += 1;
    }
  }

  if (created + updated === 0 && parsed === 0) {
    warnings.push('没有在收件箱里找到可识别的“日程提醒”邮件。提醒邮件需要已经送达邮箱后才能被导入。');
  }

  return {
    ok: true,
    source: 'email_reminder',
    from: from.toISOString(),
    to: to.toISOString(),
    total: candidates.length,
    parsed,
    created,
    updated,
    skipped,
    cancelled: 0,
    warnings,
  };
}

export function parseEmailReminderEvent(message: Pick<EmailMessage, 'subject' | 'textBody' | 'htmlBody'>): ParsedEmailReminderEvent | null {
  const parts = [
    message.subject,
    message.textBody ?? '',
    stripHtml(message.htmlBody ?? ''),
  ].filter(Boolean);
  const text = normalizeText(parts.join(' '));
  return parseChineseReminder(text) ?? parseEnglishReminder(text);
}

async function findCandidateMessages(
  credentials: EmailCredentials,
  deps: EmailReminderSyncDependencies,
): Promise<EmailMessage[]> {
  const fetchList = deps.fetchInbox ?? fetchInbox;
  const search = deps.searchMessages ?? searchMessages;
  const fetchByUid = deps.fetchMessageByUid ?? fetchMessageByUid;
  const byUid = new Map<number, EmailMessage>();

  const inboxPages = await Promise.all([
    fetchList(credentials, { folder: 'INBOX', page: 1, limit: 50 }).catch(() => null),
    fetchList(credentials, { folder: 'INBOX', page: 2, limit: 50 }).catch(() => null),
  ]);
  for (const page of inboxPages) {
    for (const summary of page?.messages ?? []) {
      if (isLikelyReminderMessage(summary) || parseEmailReminderEvent(summary)) byUid.set(summary.uid, summary);
    }
  }

  for (const query of SEARCH_TERMS) {
    const summaries = await search(credentials, { query, folder: 'INBOX', limit: 50 }).catch(() => []);
    for (const summary of summaries) byUid.set(summary.uid, summary);
  }

  const detailed: EmailMessage[] = [];
  for (const summary of Array.from(byUid.values())) {
    const full = await fetchByUid(credentials, summary.uid, 'INBOX').catch(() => null);
    detailed.push(full ?? summary);
  }
  return detailed;
}

function isLikelyReminderMessage(message: Pick<EmailMessage, 'subject' | 'from'>): boolean {
  const subject = message.subject ?? '';
  const fromText = (message.from ?? [])
    .map((item) => `${item.name ?? ''} ${item.address ?? ''}`)
    .join(' ');
  return /日程提醒|Notification:\s*The schedule/i.test(subject)
    || (/日历服务|calendar/i.test(fromText) && /日程\d+\s*分钟后开始|schedule will start/i.test(subject));
}

function parseChineseReminder(text: string): ParsedEmailReminderEvent | null {
  const match = text.match(/(?:【日程提醒】)?\s*日程\d+\s*分钟后开始[，,]?\s*(?:请提前做好准备\s*)?(.+?)\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*\(GMT([+-]\d{2}:\d{2})\)/);
  if (!match) return null;
  const [, title, year, month, day, startTime, endTime, offset] = match;
  return buildParsedEvent({
    title,
    year: Number(year),
    month: Number(month),
    day: Number(day),
    startTime,
    endTime,
    offset,
    sourceText: match[0],
  });
}

function parseEnglishReminder(text: string): ParsedEmailReminderEvent | null {
  const match = text.match(/Notification:\s*The schedule will start in \d+\s*minutes\s+(.+?)\s+(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*\(GMT([+-]\d{2}:\d{2})\)/i);
  if (!match) return null;
  const [, title, day, monthName, year, startTime, endTime, offset] = match;
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return buildParsedEvent({
    title,
    year: Number(year),
    month,
    day: Number(day),
    startTime,
    endTime,
    offset,
    sourceText: match[0],
  });
}

function buildParsedEvent(input: {
  title: string;
  year: number;
  month: number;
  day: number;
  startTime: string;
  endTime: string;
  offset: string;
  sourceText: string;
}): ParsedEmailReminderEvent | null {
  const startAt = toUtcDate(input.year, input.month, input.day, input.startTime, input.offset);
  let endAt = toUtcDate(input.year, input.month, input.day, input.endTime, input.offset);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  if (endAt <= startAt) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

  const title = cleanTitle(input.title);
  if (!title || isSystemCalendarNoiseTitle(title)) return null;
  return {
    title,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    timezone: input.offset === '+08:00' ? 'Asia/Shanghai' : `GMT${input.offset}`,
    sourceText: input.sourceText,
  };
}

function toCalendarDraft(
  reminder: ParsedEmailReminderEvent,
  ctx: { ownerId: string; tenantId: string; nowIso: string },
): Omit<CalendarEvent, 'id'> {
  return {
    title: reminder.title,
    description: '从邮箱“日程提醒”邮件自动导入。',
    startAt: reminder.startAt,
    endAt: reminder.endAt,
    timezone: reminder.timezone,
    allDay: false,
    recurringRule: null,
    ownerId: ctx.ownerId,
    attendees: [],
    attendeeEmails: [],
    externalAttendeeEmails: [],
    reminderMinutes: null,
    seriesId: null,
    recurrenceIndex: null,
    location: null,
    meetingUrl: null,
    calendarSource: 'netease',
    externalId: buildExternalId(reminder),
    status: 'confirmed',
    tenantId: ctx.tenantId,
    createdAt: ctx.nowIso,
    updatedAt: ctx.nowIso,
  };
}

function diffCalendarEvent(current: CalendarEvent, next: Omit<CalendarEvent, 'id'>): Partial<CalendarEvent> {
  const patch: Partial<CalendarEvent> = {};
  for (const key of ['title', 'description', 'startAt', 'endAt', 'timezone', 'allDay', 'status', 'tenantId'] as const) {
    if (current[key] !== next[key]) patch[key] = next[key] as never;
  }
  if (Object.keys(patch).length > 0) patch.updatedAt = next.updatedAt;
  return patch;
}

function buildExternalId(reminder: ParsedEmailReminderEvent): string {
  const digest = createHash('sha1')
    .update(`${reminder.title}|${reminder.startAt}|${reminder.endAt}`)
    .digest('hex')
    .slice(0, 16);
  return `netease:mail-reminder:${digest}`;
}

async function getPersonalEmailCredentials(userId: string): Promise<EmailCredentials | null> {
  const credentials = await getStore().userEmailCredentials.get(userId);
  if (!credentials?.smtpPassEncrypted) return null;
  const smtpPass = decrypt(credentials.smtpPassEncrypted);
  return {
    userId,
    smtp: {
      host: credentials.smtpHost,
      port: credentials.smtpPort,
      secure: credentials.smtpSecure,
      auth: {
        user: credentials.smtpUser,
        pass: smtpPass,
      },
    },
    imap: {
      host: credentials.imapHost || inferImapHost(credentials.smtpHost),
      port: credentials.imapPort || 993,
      secure: credentials.imapSecure ?? true,
      auth: {
        user: credentials.imapUser || credentials.smtpUser,
        pass: credentials.imapPassEncrypted ? decrypt(credentials.imapPassEncrypted) : smtpPass,
      },
    },
  };
}

function toUtcDate(year: number, month: number, day: number, time: string, offset: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const offsetMinutes = parseOffsetMinutes(offset);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60 * 1000);
}

function parseOffsetMinutes(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function cleanTitle(title: string): string {
  return title
    .replace(/^[（(]+|[）)]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSystemCalendarNoiseTitle(title: string): boolean {
  return /^(O|KR)\s+Check-in$/i.test(title.trim());
}

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function inferImapHost(smtpHost: string): string {
  const map: Record<string, string> = {
    'smtp.qq.com': 'imap.qq.com',
    'smtp.163.com': 'imap.163.com',
    'smtp.126.com': 'imap.126.com',
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp.exmail.qq.com': 'imap.exmail.qq.com',
    'smtphz.qiye.163.com': 'imaphz.qiye.163.com',
  };
  return map[smtpHost] || smtpHost.replace('smtp', 'imap');
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};
