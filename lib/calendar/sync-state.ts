export type CalendarSyncProvider = 'netease';
export type CalendarSyncStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export interface CalendarSyncResultSummary {
  source: string;
  total?: number;
  created: number;
  updated: number;
  skipped: number;
  cancelled?: number;
}

export interface CalendarSyncState {
  id: string;
  provider: CalendarSyncProvider;
  userId: string;
  tenantId: string;
  email: string;
  autoEnabled: boolean;
  status: CalendarSyncStatus;
  firstManualSyncAt?: string;
  lastManualSyncAt?: string;
  lastAttemptAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  lastResult?: CalendarSyncResultSummary;
  createdAt: string;
  updatedAt: string;
}

export function neteaseCalendarSyncStateId(userId: string): string {
  return `netease:${userId}`;
}
