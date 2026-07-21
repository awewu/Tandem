import type { NotificationRepository } from './notification-repo';
import type { Notification } from '@/lib/types/feishu-catchup';

let _id = 0;
const genId = () => `ntf_${++_id}_${Date.now()}`;

export class InMemoryNotificationRepository implements NotificationRepository {
  private data = new Map<string, Notification>();

  async findById(id: string): Promise<Notification | null> { return this.data.get(id) ?? null; }
  async findByUser(userId: string, opts?: { unreadOnly?: boolean; includeDismissed?: boolean; limit?: number; offset?: number; tenantId?: string }): Promise<Notification[]> {
    let arr = Array.from(this.data.values()).filter(n => n.userId === userId);
    if (opts?.tenantId) arr = arr.filter(n => n.tenantId === opts.tenantId);
    if (!opts?.includeDismissed) arr = arr.filter(n => !n.dismissedAt);
    if (opts?.unreadOnly) arr = arr.filter(n => !n.readAt);
    arr = arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const offset = opts?.offset ?? 0;
    if (opts?.limit) arr = arr.slice(offset, offset + opts.limit);
    else if (offset > 0) arr = arr.slice(offset);
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
  async countUnread(userId: string, opts?: { tenantId?: string; includeDismissed?: boolean }): Promise<number> {
    return this.countByUser(userId, { ...opts, unreadOnly: true });
  }
  async countByUser(userId: string, opts?: { unreadOnly?: boolean; includeDismissed?: boolean; tenantId?: string }): Promise<number> {
    return Array.from(this.data.values()).filter(n => (
      n.userId === userId &&
      (!opts?.tenantId || n.tenantId === opts.tenantId) &&
      (opts?.includeDismissed || !n.dismissedAt) &&
      (!opts?.unreadOnly || !n.readAt)
    )).length;
  }
  async list(): Promise<Notification[]> { return Array.from(this.data.values()); }
}
