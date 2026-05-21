import type { NotificationRepository } from './notification-repo';
import type { Notification } from '@/lib/types/feishu-catchup';

let _id = 0;
const genId = () => `ntf_${++_id}_${Date.now()}`;

export class InMemoryNotificationRepository implements NotificationRepository {
  private data = new Map<string, Notification>();

  async findById(id: string): Promise<Notification | null> { return this.data.get(id) ?? null; }
  async findByUser(userId: string, opts?: { unreadOnly?: boolean; limit?: number; tenantId?: string }): Promise<Notification[]> {
    let arr = Array.from(this.data.values()).filter(n => n.userId === userId);
    if (opts?.tenantId) arr = arr.filter(n => n.tenantId === opts.tenantId);
    if (opts?.unreadOnly) arr = arr.filter(n => !n.readAt);
    if (opts?.limit) arr = arr.slice(0, opts.limit);
    return arr;
  }
  async create(draft: Omit<Notification, 'id'> & { id?: string }): Promise<Notification> {
    const n = { ...(draft as Notification), id: draft.id ?? genId() };
    this.data.set(n.id, n); return n;
  }
  async markRead(id: string): Promise<Notification> {
    const n = this.data.get(id); if (!n) throw new Error('not found');
    n.readAt = new Date().toISOString(); return n;
  }
  async markDismissed(id: string): Promise<Notification> {
    const n = this.data.get(id); if (!n) throw new Error('not found');
    n.dismissedAt = new Date().toISOString(); return n;
  }
  async countUnread(userId: string): Promise<number> {
    return Array.from(this.data.values()).filter(n => n.userId === userId && !n.readAt).length;
  }
  async list(): Promise<Notification[]> { return Array.from(this.data.values()); }
}
