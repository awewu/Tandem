export type ReminderChannel = 'in_app' | 'web_push' | 'toast';

export type ReminderTaskStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface ReminderTask {
  id: string;
  tenantId: string;
  userId: string;
  sourceType: string;
  sourceId: string;
  dedupeKey: string;
  title: string;
  body: string;
  url?: string | null;
  remindAt: string;
  channels: ReminderChannel[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: ReminderTaskStatus;
  retryCount: number;
  lastError?: string | null;
  processingAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveredReminder {
  task: ReminderTask;
  notificationId?: string;
}
