import type { CalendarSubscription } from '@/lib/types/calendar-management';

export interface CalendarSubscriptionRepository {
  findById(id: string): Promise<CalendarSubscription | null>;
  findByUsers(subscriberId: string, targetUserId: string, tenantId: string): Promise<CalendarSubscription | null>;
  create(draft: Omit<CalendarSubscription, 'id'> & { id?: string }): Promise<CalendarSubscription>;
  update(id: string, patch: Partial<CalendarSubscription>): Promise<CalendarSubscription>;
  list(filter?: { subscriberId?: string; targetUserId?: string; tenantId?: string }): Promise<CalendarSubscription[]>;
}

