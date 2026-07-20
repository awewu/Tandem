import type { Notification } from '@/lib/types/feishu-catchup';

export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findByUser(userId: string, opts?: { unreadOnly?: boolean; includeDismissed?: boolean; limit?: number; offset?: number; tenantId?: string }): Promise<Notification[]>;
  create(draft: Omit<Notification, 'id'> & { id?: string }): Promise<Notification>;
  markRead(id: string): Promise<Notification>;
  markDismissed(id: string): Promise<Notification>;
  countUnread(userId: string, opts?: { tenantId?: string; includeDismissed?: boolean }): Promise<number>;
  countByUser(userId: string, opts?: { unreadOnly?: boolean; includeDismissed?: boolean; tenantId?: string }): Promise<number>;
  list(filter?: { userId?: string }): Promise<Notification[]>;
}
