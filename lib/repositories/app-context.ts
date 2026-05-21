/**
 * Application Context · 请求级 DI 容器
 * §T2 宪章: 每个请求创建新 context，不依赖 globalThis
 */

import type { DocumentRepository } from './document-repo';
import type { CalendarEventRepository } from './calendar-repo';
import type { DriveFileRepository } from './drive-repo';
import type { NotificationRepository } from './notification-repo';
import type { LaunchpadRepository } from './launchpad-repo';

export interface ApplicationContext {
  documentRepo: DocumentRepository;
  calendarRepo: CalendarEventRepository;
  driveRepo: DriveFileRepository;
  notificationRepo: NotificationRepository;
  launchpadRepo: LaunchpadRepository;
}
