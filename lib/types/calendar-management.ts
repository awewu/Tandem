export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'custom';

export interface CalendarRecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: number[];
  end: { type: 'never' } | { type: 'date'; date: string } | { type: 'count'; count: number };
}

export type CalendarMutationScope = 'single' | 'future' | 'series';

export interface CalendarReminderTask {
  id: string;
  eventId: string;
  userId: string;
  remindAt: string;
  status: 'pending' | 'fired' | 'cancelled';
  tenantId: string;
  firedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CalendarSubscriptionStatus = 'subscribed' | 'cancelled';
export type CalendarDetailPermissionStatus = 'not_requested' | 'pending' | 'approved' | 'rejected' | 'revoked';

export interface CalendarSubscription {
  id: string;
  subscriberId: string;
  targetUserId: string;
  status: CalendarSubscriptionStatus;
  detailPermission: CalendarDetailPermissionStatus;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarUser {
  id: string;
  email: string;
  name: string;
}

