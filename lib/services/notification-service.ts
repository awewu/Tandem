import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { Notification } from '@/lib/types/feishu-catchup';
import { cacheDel } from '@/lib/infra/cache';
import { sendPushTo } from '@/lib/infra/web-push';

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
    // 字段白名单: 显式构造, 防 body 注入 id/read/dismissedAt 等系统字段 (P2-B).
    const n = await this.ctx.notificationRepo.create({
      userId: cmd.userId,
      type: cmd.type,
      title: cmd.title,
      body: cmd.body ?? '',
      data: cmd.data ?? {},
      priority: cmd.priority ?? 'normal',
      channel: cmd.channel ?? 'in-app',
      sourceId: cmd.sourceId,
      sourceType: cmd.sourceType,
      tenantId: cmd.tenantId ?? 'default',
      createdAt: new Date().toISOString(),
    } as any);
    await cacheDel(`badge:${cmd.userId}`);

    // Web Push 同步推送 (fire-and-forget, fail-soft) — 低优先级不推, 避免噪音
    if ((cmd.priority ?? 'normal') !== 'low') {
      const url = typeof cmd.data?.url === 'string' ? cmd.data.url : undefined;
      void sendPushTo(cmd.userId, {
        title: cmd.title,
        body: cmd.body ?? '',
        url,
      }).catch(() => undefined);
    }

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
