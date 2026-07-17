import type { CalendarSubscriptionRepository } from './calendar-subscription-repo';
import type { CalendarSubscription } from '@/lib/types/calendar-management';

let nextId = 0;

export class InMemoryCalendarSubscriptionRepository implements CalendarSubscriptionRepository {
  private data = new Map<string, CalendarSubscription>();

  async findById(id: string): Promise<CalendarSubscription | null> {
    return this.data.get(id) ?? null;
  }

  async findByUsers(subscriberId: string, targetUserId: string, tenantId: string): Promise<CalendarSubscription | null> {
    return Array.from(this.data.values()).find((item) => (
      item.subscriberId === subscriberId && item.targetUserId === targetUserId && item.tenantId === tenantId
    )) ?? null;
  }

  async create(draft: Omit<CalendarSubscription, 'id'> & { id?: string }): Promise<CalendarSubscription> {
    const item = { ...draft, id: draft.id ?? `calendar_subscription_${++nextId}` };
    this.data.set(item.id, item);
    return item;
  }

  async update(id: string, patch: Partial<CalendarSubscription>): Promise<CalendarSubscription> {
    const item = this.data.get(id);
    if (!item) throw new Error(`CalendarSubscription ${id} not found`);
    Object.assign(item, patch);
    return item;
  }

  async list(filter?: { subscriberId?: string; targetUserId?: string; tenantId?: string }): Promise<CalendarSubscription[]> {
    return Array.from(this.data.values()).filter((item) => (
      (!filter?.subscriberId || item.subscriberId === filter.subscriberId) &&
      (!filter?.targetUserId || item.targetUserId === filter.targetUserId) &&
      (!filter?.tenantId || item.tenantId === filter.tenantId)
    ));
  }
}

