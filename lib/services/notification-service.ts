import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { Notification } from '@/lib/types/feishu-catchup';
import { cacheDel } from '@/lib/infra/cache';

export interface CreateNotificationCommand {
  userId: string;
  type: 'mention' | 'system' | 'reminder' | 'approval';
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channel?: 'in-app' | 'email' | 'sms' | 'push';
  sourceId?: string;
  sourceType?: string;
  tenantId?: string;
}

export class NotificationService {
  constructor(private ctx: ApplicationContext) {}

  async list(userId: string, opts?: { unreadOnly?: boolean; tenantId?: string }): Promise<Notification[]> {
    return this.ctx.notificationRepo.findByUser(userId, opts);
  }

  async countUnread(userId: string): Promise<number> {
    return this.ctx.notificationRepo.countUnread(userId);
  }

  async create(cmd: CreateNotificationCommand): Promise<Notification> {
    const n = await this.ctx.notificationRepo.create({
      ...cmd,
      priority: cmd.priority ?? 'normal',
      channel: cmd.channel ?? 'in-app',
      tenantId: cmd.tenantId ?? 'default',
      createdAt: new Date().toISOString(),
    } as any);
    await cacheDel(`badge:${cmd.userId}`);
    return n;
  }

  async markRead(id: string): Promise<Notification> {
    const n = await this.ctx.notificationRepo.markRead(id);
    await cacheDel(`badge:${n.userId}`);
    return n;
  }

  async markDismissed(id: string): Promise<Notification> {
    const n = await this.ctx.notificationRepo.markDismissed(id);
    await cacheDel(`badge:${n.userId}`);
    return n;
  }
}
