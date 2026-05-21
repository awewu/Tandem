import type { Notification } from '@/lib/types/feishu-catchup';

export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findByUser(userId: string, opts?: { unreadOnly?: boolean; limit?: number; tenantId?: string }): Promise<Notification[]>;
  create(draft: Omit<Notification, 'id'> & { id?: string }): Promise<Notification>;
  markRead(id: string): Promise<Notification>;
  markDismissed(id: string): Promise<Notification>;
  countUnread(userId: string): Promise<number>;
  list(filter?: { userId?: string }): Promise<Notification[]>;
}
