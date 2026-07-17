import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/domain/errors';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import type { CalendarSubscription } from '@/lib/types/calendar-management';
import { recordCalendarActivity } from '@/lib/calendar/activity-log';

interface CalendarSubscriptionDependencies {
  now?: () => Date;
}

type CalendarSubscriptionContext = Pick<ApplicationContext, 'calendarSubscriptionRepo' | 'notificationRepo'>;

export class CalendarSubscriptionService {
  constructor(
    private ctx: CalendarSubscriptionContext,
    private deps: CalendarSubscriptionDependencies = {},
  ) {}

  async subscribe(
    subscriberId: string,
    targetUserId: string,
    tenantId: string,
    requestDetails: boolean,
  ): Promise<CalendarSubscription> {
    if (subscriberId === targetUserId) throw new ValidationError('cannot subscribe to your own calendar');
    const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
    const existing = await this.ctx.calendarSubscriptionRepo.findByUsers(subscriberId, targetUserId, tenantId);
    const detailPermission = requestDetails ? 'pending' : 'not_requested';
    const subscription = existing
      ? await this.ctx.calendarSubscriptionRepo.update(existing.id, {
          status: 'subscribed',
          detailPermission,
          updatedAt: nowIso,
        })
      : await this.ctx.calendarSubscriptionRepo.create({
          subscriberId,
          targetUserId,
          status: 'subscribed',
          detailPermission,
          tenantId,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

    if (requestDetails) {
      await this.ctx.notificationRepo.create({
        userId: targetUserId,
        type: 'approval',
        title: '日程详情查看申请',
        body: '有人申请查看你的完整日程详情',
        data: { subscriptionId: subscription.id, subscriberId, url: '/calendar' },
        priority: 'normal',
        channel: 'in-app',
        sourceId: subscription.id,
        sourceType: 'calendar_subscription',
        tenantId,
        createdAt: nowIso,
      });
    }
    await recordCalendarActivity({
      tenantId,
      actorId: subscriberId,
      action: 'subscription.created',
      targetType: 'subscription',
      targetId: subscription.id,
      subscriberId,
      targetUserId,
      detailPermission,
      status: subscription.status,
    });
    return subscription;
  }

  async respond(
    id: string,
    actorId: string,
    action: 'approve' | 'reject' | 'revoke',
  ): Promise<CalendarSubscription> {
    const subscription = await this.requireSubscription(id);
    if (subscription.targetUserId !== actorId) throw new ForbiddenError('only the calendar owner can respond');
    if (action !== 'revoke' && subscription.detailPermission !== 'pending') {
      throw new ValidationError('detail request is not pending');
    }
    if (action === 'revoke' && subscription.detailPermission !== 'approved') {
      throw new ValidationError('detail access is not approved');
    }
    const detailPermission = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revoked';
    const nowIso = (this.deps.now?.() ?? new Date()).toISOString();
    const updated = await this.ctx.calendarSubscriptionRepo.update(id, { detailPermission, updatedAt: nowIso });
    await this.ctx.notificationRepo.create({
      userId: subscription.subscriberId,
      type: 'system',
      title: action === 'approve' ? '日程详情申请已同意' : action === 'reject' ? '日程详情申请已拒绝' : '日程详情权限已撤销',
      body: action === 'approve' ? '你现在可以查看完整日程详情' : '你仍可查看忙闲状态',
      data: { subscriptionId: id, targetUserId: subscription.targetUserId, url: '/calendar' },
      priority: 'normal',
      channel: 'in-app',
      sourceId: id,
      sourceType: 'calendar_subscription',
      tenantId: subscription.tenantId,
      createdAt: nowIso,
    });
    await recordCalendarActivity({
      tenantId: subscription.tenantId,
      actorId,
      action: action === 'approve'
        ? 'subscription.approved'
        : action === 'reject'
          ? 'subscription.rejected'
          : 'subscription.revoked',
      targetType: 'subscription',
      targetId: id,
      subscriberId: subscription.subscriberId,
      targetUserId: subscription.targetUserId,
      detailPermission,
      status: updated.status,
    });
    return updated;
  }

  async cancel(id: string, actorId: string): Promise<CalendarSubscription> {
    const subscription = await this.requireSubscription(id);
    if (subscription.subscriberId !== actorId) throw new ForbiddenError('only the subscriber can cancel');
    const updated = await this.ctx.calendarSubscriptionRepo.update(id, {
      status: 'cancelled',
      updatedAt: (this.deps.now?.() ?? new Date()).toISOString(),
    });
    await recordCalendarActivity({
      tenantId: subscription.tenantId,
      actorId,
      action: 'subscription.cancelled',
      targetType: 'subscription',
      targetId: id,
      subscriberId: subscription.subscriberId,
      targetUserId: subscription.targetUserId,
      detailPermission: subscription.detailPermission,
      status: updated.status,
    });
    return updated;
  }

  async listForUser(userId: string, tenantId: string): Promise<CalendarSubscription[]> {
    const [outgoing, incoming] = await Promise.all([
      this.ctx.calendarSubscriptionRepo.list({ subscriberId: userId, tenantId }),
      this.ctx.calendarSubscriptionRepo.list({ targetUserId: userId, tenantId }),
    ]);
    return [...outgoing, ...incoming.filter((item) => item.subscriberId !== userId)];
  }

  private async requireSubscription(id: string): Promise<CalendarSubscription> {
    const subscription = await this.ctx.calendarSubscriptionRepo.findById(id);
    if (!subscription) throw new NotFoundError('CalendarSubscription', id);
    return subscription;
  }
}
