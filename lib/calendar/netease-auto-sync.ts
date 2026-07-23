import { syncCalendarFromEmailReminders } from '@/lib/calendar/email-reminder-sync';
import { syncNeteaseCalDavCalendar } from '@/lib/calendar/netease-caldav-sync';
import { syncNeteaseCalendar } from '@/lib/calendar/netease-sync';
import { getStore } from '@/lib/storage/repository';
import type {
  CalendarSyncResultSummary,
  CalendarSyncState,
  CalendarSyncStatus,
} from '@/lib/calendar/sync-state';
import { neteaseCalendarSyncStateId } from '@/lib/calendar/sync-state';

const AUTO_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

export type NeteaseSyncMode = 'manual' | 'auto';

export type NeteaseCalendarSyncResult = {
  ok: true;
  source: string;
  from: string;
  to: string;
  total?: number;
  created: number;
  updated: number;
  skipped: number;
  cancelled?: number;
  warnings: string[];
};

export interface RunNeteaseCalendarSyncCommand {
  userId: string;
  tenantId: string;
  email: string;
  from?: Date;
  to?: Date;
  verifyCode?: string;
}

export interface RunNeteaseCalendarSyncForUserCommand extends RunNeteaseCalendarSyncCommand {
  mode: NeteaseSyncMode;
}

interface RunNeteaseCalendarSyncDeps {
  syncCalendar?: (command: RunNeteaseCalendarSyncCommand) => Promise<NeteaseCalendarSyncResult>;
  now?: () => Date;
}

export async function getNeteaseCalendarSyncStatus(userId: string): Promise<{
  configured: boolean;
  account: string | null;
  state: CalendarSyncState | null;
}> {
  const [credentials, state] = await Promise.all([
    getStore().userEmailCredentials.get(userId),
    getStore().calendarSyncStates.get(neteaseCalendarSyncStateId(userId)),
  ]);
  return {
    configured: hasUsableEmailCredentials(credentials),
    account: typeof credentials?.smtpUser === 'string' ? credentials.smtpUser : null,
    state,
  };
}

export async function runNeteaseCalendarSyncForUser(
  command: RunNeteaseCalendarSyncForUserCommand,
  deps: RunNeteaseCalendarSyncDeps = {},
): Promise<NeteaseCalendarSyncResult> {
  const credentialStatus = await getNeteaseCalendarSyncStatus(command.userId);
  if (!credentialStatus.configured) {
    if (credentialStatus.state?.autoEnabled) {
      await updateNeteaseSyncState(command, {
        autoEnabled: false,
        status: 'idle',
        lastError: '邮箱配置已删除或不完整，已停止网易日程自动同步。',
      }, deps.now?.() ?? new Date());
    }
    throw new Error('未绑定公司邮箱，请先在邮箱设置里输入邮箱地址和密码。');
  }

  const now = deps.now?.() ?? new Date();
  await updateNeteaseSyncState(command, {
    status: 'running',
    lastAttemptAt: now.toISOString(),
    lastError: undefined,
  }, now);

  try {
    const result = await (deps.syncCalendar ?? runNeteaseCalendarSync)(command);
    await recordNeteaseSyncSuccess(command, result, deps.now?.() ?? new Date());
    return result;
  } catch (error) {
    await recordNeteaseSyncFailure(command, error, deps.now?.() ?? new Date());
    throw error;
  }
}

export async function runNeteaseCalendarSync(command: RunNeteaseCalendarSyncCommand): Promise<NeteaseCalendarSyncResult> {
  let calDavMessage = '';
  try {
    return await syncNeteaseCalDavCalendar(command);
  } catch (calDavError) {
    calDavMessage = calDavError instanceof Error ? sanitizeSyncError(calDavError.message) : '网易邮箱 CalDAV 同步失败';
  }

  try {
    const result = await syncNeteaseCalendar(command);
    return {
      ...result,
      warnings: [
        `CalDAV 同步失败：${calDavMessage}；已改用网易网页日历接口同步。`,
        ...result.warnings,
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? sanitizeSyncError(error.message) : '网易邮箱日程同步失败';
    try {
      const fallback = await syncCalendarFromEmailReminders(command);
      return {
        ...fallback,
        warnings: [
          `CalDAV 同步失败：${calDavMessage}；${message}；已改从邮箱“日程提醒”邮件导入。提醒邮件只覆盖已经送达邮箱的日程，未收到提醒邮件的未来日程可能暂时不会出现。`,
          ...fallback.warnings,
        ],
      };
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? sanitizeSyncError(fallbackError.message) : '';
      const finalMessage = fallbackMessage && fallbackMessage !== message
        ? `CalDAV 同步失败：${calDavMessage}；${message}；邮箱提醒邮件导入也失败：${fallbackMessage}`
        : `CalDAV 同步失败：${calDavMessage}；${message}`;
      throw new Error(finalMessage);
    }
  }
}

export async function runNeteaseCalendarAutoSync(deps: RunNeteaseCalendarSyncDeps = {}): Promise<{
  scanned: number;
  synced: number;
  skipped: number;
  failed: number;
}> {
  const now = deps.now?.() ?? new Date();
  const states = await getStore().calendarSyncStates.list({ provider: 'netease', autoEnabled: true });
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const state of states) {
    if (!shouldAutoSync(state, now)) {
      skipped += 1;
      continue;
    }

    try {
      await runNeteaseCalendarSyncForUser({
        userId: state.userId,
        tenantId: state.tenantId,
        email: state.email,
        mode: 'auto',
        from: startOfMonth(now),
        to: addMonths(startOfMonth(now), 3),
      }, deps);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned: states.length, synced, skipped, failed };
}

function shouldAutoSync(state: CalendarSyncState, now: Date): boolean {
  if (state.status === 'running') return false;
  if (!state.lastAttemptAt) return true;
  const lastAttemptMs = new Date(state.lastAttemptAt).getTime();
  if (Number.isNaN(lastAttemptMs)) return true;
  return now.getTime() - lastAttemptMs >= AUTO_SYNC_MIN_INTERVAL_MS;
}

async function recordNeteaseSyncSuccess(
  command: RunNeteaseCalendarSyncForUserCommand,
  result: NeteaseCalendarSyncResult,
  now: Date,
): Promise<void> {
  const nowIso = now.toISOString();
  const existing = await getStore().calendarSyncStates.get(neteaseCalendarSyncStateId(command.userId));
  await updateNeteaseSyncState(command, {
    autoEnabled: true,
    status: 'succeeded',
    firstManualSyncAt: existing?.firstManualSyncAt ?? (command.mode === 'manual' ? nowIso : undefined),
    lastManualSyncAt: command.mode === 'manual' ? nowIso : existing?.lastManualSyncAt,
    lastAttemptAt: nowIso,
    lastSyncAt: nowIso,
    lastError: undefined,
    lastResult: summarizeResult(result),
  }, now);
}

async function recordNeteaseSyncFailure(
  command: RunNeteaseCalendarSyncForUserCommand,
  error: unknown,
  now: Date,
): Promise<void> {
  await updateNeteaseSyncState(command, {
    status: 'failed',
    lastAttemptAt: now.toISOString(),
    lastError: error instanceof Error ? sanitizeSyncError(error.message) : '网易邮箱日程同步失败',
  }, now);
}

async function updateNeteaseSyncState(
  command: Pick<RunNeteaseCalendarSyncForUserCommand, 'userId' | 'tenantId' | 'email'>,
  patch: Partial<CalendarSyncState>,
  now: Date,
): Promise<CalendarSyncState> {
  const repo = getStore().calendarSyncStates;
  const id = neteaseCalendarSyncStateId(command.userId);
  const nowIso = now.toISOString();
  const existing = await repo.get(id);
  const base: CalendarSyncState = existing ?? {
    id,
    provider: 'netease',
    userId: command.userId,
    tenantId: command.tenantId,
    email: command.email,
    autoEnabled: false,
    status: 'idle',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const next: CalendarSyncState = {
    ...base,
    tenantId: command.tenantId,
    email: command.email,
    ...patch,
    updatedAt: nowIso,
  };
  return existing ? repo.update(id, next) : repo.create(next);
}

function summarizeResult(result: NeteaseCalendarSyncResult): CalendarSyncResultSummary {
  return {
    source: result.source,
    total: result.total,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    cancelled: result.cancelled,
  };
}

function hasUsableEmailCredentials(credentials: unknown): boolean {
  if (!credentials || typeof credentials !== 'object') return false;
  const item = credentials as { smtpUser?: unknown; smtpPassEncrypted?: unknown; imapPassEncrypted?: unknown };
  return typeof item.smtpUser === 'string'
    && item.smtpUser.trim().length > 0
    && (typeof item.imapPassEncrypted === 'string' || typeof item.smtpPassEncrypted === 'string');
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function sanitizeSyncError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return '网易邮箱日程同步失败';
  if (/password|cookie|sid|token|authorization/i.test(trimmed)) return '网易邮箱日程同步失败，请检查邮箱配置或稍后重试。';
  if (/fetch failed|ssl|certificate|network|econn|timeout|enotfound|tls/i.test(trimmed)) {
    return '服务端暂时无法连接网易企业邮箱日历接口，请检查服务器网络/证书/代理配置后重试。';
  }
  return trimmed;
}
