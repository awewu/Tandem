import { beforeEach, describe, expect, it } from 'vitest';
import {
  runNeteaseCalendarAutoSync,
  runNeteaseCalendarSyncForUser,
} from '@/lib/calendar/netease-auto-sync';
import { neteaseCalendarSyncStateId } from '@/lib/calendar/sync-state';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';
import type { PersonalEmailCredentials } from '@/lib/email/global-email-config';

const NOW = new Date('2026-07-23T09:00:00.000Z');

function credentials(userId: string): PersonalEmailCredentials {
  return {
    id: userId,
    smtpHost: 'smtphz.qiye.163.com',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: 'owner@example.com',
    smtpPassEncrypted: 'encrypted-smtp-password',
    imapHost: 'imaphz.qiye.163.com',
    imapPort: 993,
    imapSecure: true,
    imapUser: 'owner@example.com',
    imapPassEncrypted: 'encrypted-imap-password',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe('netease calendar auto sync state', () => {
  beforeEach(() => {
    setStore(createInMemoryStore());
  });

  it('enables background sync after a successful manual sync', async () => {
    await getStore().userEmailCredentials.create(credentials('user-1'));

    await runNeteaseCalendarSyncForUser({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      mode: 'manual',
    }, {
      now: () => NOW,
      syncCalendar: async () => ({
        ok: true,
        source: 'netease_caldav',
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
        total: 1,
        created: 1,
        updated: 0,
        skipped: 0,
        cancelled: 0,
        warnings: [],
      }),
    });

    const state = await getStore().calendarSyncStates.get(neteaseCalendarSyncStateId('user-1'));
    expect(state).toMatchObject({
      autoEnabled: true,
      status: 'succeeded',
      lastSyncAt: NOW.toISOString(),
      lastManualSyncAt: NOW.toISOString(),
      lastResult: { source: 'netease_caldav', created: 1 },
    });
  });

  it('does not auto-sync users whose mailbox credentials are missing', async () => {
    await getStore().calendarSyncStates.create({
      id: neteaseCalendarSyncStateId('user-1'),
      provider: 'netease',
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      autoEnabled: true,
      status: 'succeeded',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    let calls = 0;

    const result = await runNeteaseCalendarAutoSync({
      now: () => new Date(NOW.getTime() + 31 * 60 * 1000),
      syncCalendar: async () => {
        calls += 1;
        throw new Error('should not run');
      },
    });

    const state = await getStore().calendarSyncStates.get(neteaseCalendarSyncStateId('user-1'));
    expect(calls).toBe(0);
    expect(result).toMatchObject({ scanned: 1, synced: 0, failed: 1 });
    expect(state).toMatchObject({
      autoEnabled: false,
      status: 'idle',
      lastError: '邮箱配置已删除或不完整，已停止网易日程自动同步。',
    });
  });

  it('skips automatic sync when the previous attempt was recent', async () => {
    await getStore().userEmailCredentials.create(credentials('user-1'));
    await getStore().calendarSyncStates.create({
      id: neteaseCalendarSyncStateId('user-1'),
      provider: 'netease',
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      autoEnabled: true,
      status: 'succeeded',
      lastAttemptAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    let calls = 0;

    const result = await runNeteaseCalendarAutoSync({
      now: () => new Date(NOW.getTime() + 10 * 60 * 1000),
      syncCalendar: async () => {
        calls += 1;
        throw new Error('should not run');
      },
    });

    expect(calls).toBe(0);
    expect(result).toMatchObject({ scanned: 1, synced: 0, skipped: 1, failed: 0 });
  });
});
