/**
 * Application Context Factory
 * §T1 宪章: 根据环境选择 Repository 实现
 *   - DATABASE_URL 存在 → Prisma + PostgreSQL
 *   - 否则 → InMemory (dev / e2e)
 */

import type { ApplicationContext } from './app-context';
import { InMemoryDocumentRepository } from './memory-document-repo';
import { InMemoryCalendarEventRepository } from './memory-calendar-repo';
import { InMemoryDriveFileRepository } from './memory-drive-repo';
import { InMemoryNotificationRepository } from './memory-notification-repo';
import { DrizzleDocumentRepository } from './drizzle-document-repo';
import { DrizzleCalendarEventRepository } from './drizzle-calendar-repo';
import { DrizzleDriveFileRepository } from './drizzle-drive-repo';
import { DrizzleNotificationRepository } from './drizzle-notification-repo';
import { InMemoryLaunchpadRepository } from './memory-launchpad-repo';
import { DrizzleLaunchpadRepository } from './drizzle-launchpad-repo';
import { isDatabaseMode } from '@/lib/infra/storage-mode';
import { InMemoryCalendarReminderRepository } from './memory-calendar-reminder-repo';
import { InMemoryCalendarSubscriptionRepository } from './memory-calendar-subscription-repo';
import { DrizzleCalendarReminderRepository } from './drizzle-calendar-reminder-repo';
import { DrizzleCalendarSubscriptionRepository } from './drizzle-calendar-subscription-repo';
import { InMemoryReminderTaskRepository } from './memory-reminder-task-repo';
import { DrizzleReminderTaskRepository } from './drizzle-reminder-task-repo';

const USE_DB = isDatabaseMode();

// 模块级单例 — seed 和 API 请求共享同一数据存储
const _memDocumentRepo = new InMemoryDocumentRepository();
const _memCalendarRepo = new InMemoryCalendarEventRepository();
const _memDriveRepo = new InMemoryDriveFileRepository();
const _memNotificationRepo = new InMemoryNotificationRepository();
const _memLaunchpadRepo = new InMemoryLaunchpadRepository();
const _memCalendarReminderRepo = new InMemoryCalendarReminderRepository();
const _memCalendarSubscriptionRepo = new InMemoryCalendarSubscriptionRepository();
const _memReminderTaskRepo = new InMemoryReminderTaskRepository();

const _pgDocumentRepo = USE_DB ? new DrizzleDocumentRepository() : null;
const _pgCalendarRepo = USE_DB ? new DrizzleCalendarEventRepository() : null;
const _pgDriveRepo = USE_DB ? new DrizzleDriveFileRepository() : null;
const _pgNotificationRepo = USE_DB ? new DrizzleNotificationRepository() : null;
const _pgLaunchpadRepo = USE_DB ? new DrizzleLaunchpadRepository() : null;
const _pgCalendarReminderRepo = USE_DB ? new DrizzleCalendarReminderRepository() : null;
const _pgCalendarSubscriptionRepo = USE_DB ? new DrizzleCalendarSubscriptionRepository() : null;
const _pgReminderTaskRepo = USE_DB ? new DrizzleReminderTaskRepository() : null;

export function createAppContext(): ApplicationContext {
  if (USE_DB) {
    return {
      documentRepo: _pgDocumentRepo!,
      calendarRepo: _pgCalendarRepo!,
      driveRepo: _pgDriveRepo!,
      notificationRepo: _pgNotificationRepo!,
      launchpadRepo: _pgLaunchpadRepo!,
      calendarReminderRepo: _pgCalendarReminderRepo!,
      calendarSubscriptionRepo: _pgCalendarSubscriptionRepo!,
      reminderTaskRepo: _pgReminderTaskRepo!,
    };
  }

  return {
    documentRepo: _memDocumentRepo,
    calendarRepo: _memCalendarRepo,
    driveRepo: _memDriveRepo,
    notificationRepo: _memNotificationRepo,
    launchpadRepo: _memLaunchpadRepo,
    calendarReminderRepo: _memCalendarReminderRepo,
    calendarSubscriptionRepo: _memCalendarSubscriptionRepo,
    reminderTaskRepo: _memReminderTaskRepo,
  };
}

// Internal: expose memory store so seed.ts can populate fixtures
export function _getMemoryLaunchpadRepo(): InMemoryLaunchpadRepository {
  return _memLaunchpadRepo;
}
