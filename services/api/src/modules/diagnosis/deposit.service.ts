import { Injectable, ForbiddenException, ServiceUnavailableException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { EventBusService } from '../mdm/event-bus.service';
import { DiagnosisSessionEntity } from './diagnosis.entity';
import { DealerCollectionConfigEntity, DepositOrderEntity } from './deposit.entity';
import { hashShareToken } from './diagnosis-engine';
import {
  buildPaymentInstruction, defaultOfflineConfig, normalizeDepositAmount,
  resolveDepositTransition, type DealerCollectionConfig, type CollectionChannel, type DepositState,
} from './diagnosis-deposit';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';

/**
 * 定金服务（赋能经销商 · 不收款）：把定金路由到「线索所属经销商」各自的收款路径，
 * 跟踪可退定金状态，并发事件驱动派单/CRM。无在线渠道 → 线下兜底，零支付密钥可跑。
 */
@Injectable()
export class DepositService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  private rls(user: { tenantId: string; userId?: string; role?: string }): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId ?? undefined, role: user.role };
  }

  /** 公开入口租户上下文（同 DiagnosisService.resolvePublicScope 语义）。 */
  private resolvePublicScope(): { tenantId: string } | null {
    const tenantId = process.env.PUBLIC_DIAGNOSIS_TENANT_ID;
    if (tenantId) return { tenantId };
    if (process.env.NODE_ENV === 'production') return null;
    return { tenantId: '64f000000000000000000201' };
  }

  private toConfig(row: DealerCollectionConfigEntity | null, dealerId: string): DealerCollectionConfig {
    if (!row || row.active === false) return defaultOfflineConfig(dealerId);
    return {
      dealerId,
      channel: (row.channel as CollectionChannel) || 'offline',
      payUrl: row.payUrl, qrImageUrl: row.qrImageUrl, offlineNote: row.offlineNote,
      merchantRef: row.merchantRef,
      defaultDepositAmount: row.defaultDepositAmount != null ? Number(row.defaultDepositAmount) : null,
      active: row.active,
    };
  }

  // ── 经销商侧：维护自己的收款路径 ──────────────────────────────────────────
  async setDealerConfig(user: JwtPayload, dto: any = {}) {
    if (!user.dealerId) throw new ForbiddenException('仅经销商可配置收款路径');
    const channel = String(dto.channel || 'offline') as CollectionChannel;
    if (!['offline', 'qr', 'link', 'wechat_merchant', 'alipay_merchant'].includes(channel)) {
      throw new BadRequestException('非法收款渠道');
    }
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DealerCollectionConfigEntity);
      const existing = await repo.findOne({ where: { tenantId: user.tenantId, dealerId: user.dealerId! } });
      const saved = await repo.save(repo.create({
        ...(existing ?? {}),
        tenantId: user.tenantId, dealerId: user.dealerId!,
        channel,
        payUrl: dto.payUrl ?? null,
        qrImageUrl: dto.qrImageUrl ?? null,
        offlineNote: dto.offlineNote ?? null,
        merchantRef: dto.merchantRef ?? null,
        defaultDepositAmount: normalizeDepositAmount(dto.defaultDepositAmount),
        active: dto.active !== false,
      }));
      return { success: true, data: saved };
    }, this.rls(user));
  }

  async getDealerConfig(user: JwtPayload) {
    if (!user.dealerId) throw new ForbiddenException('仅经销商可读取收款路径');
    return withRlsTransaction(this.ds, async (em) => {
      const row = await em.getRepository(DealerCollectionConfigEntity)
        .findOne({ where: { tenantId: user.tenantId, dealerId: user.dealerId! } });
      return { success: true, data: row ?? this.toConfig(null, user.dealerId!) };
    }, this.rls(user));
  }

  // ── 消费者侧：凭报告发起可退定金意向 ────────────────────────────────────────
  async createIntentByReport(body: any = {}) {
    const scope = this.resolvePublicScope();
    if (!scope) throw new ServiceUnavailableException('公开问诊入口未配置租户上下文');
    const reportId = String(body?.reportId || '');
    const shareToken = String(body?.shareToken || '');
    if (!reportId || !shareToken) throw new BadRequestException('reportId 与 shareToken 必填');
    const shareTokenHash = hashShareToken(shareToken);

    return withRlsTransaction(this.ds, async (em) => {
      const session = await em.getRepository(DiagnosisSessionEntity).findOne({
        where: { tenantId: scope.tenantId, reportId, shareTokenHash, status: 'active' },
      });
      if (!session) throw new NotFoundException('报告不存在或已失效');
      if (!session.dealerId) throw new BadRequestException('该线索尚未分配经销商，暂不能支付定金');

      const cfgRow = await em.getRepository(DealerCollectionConfigEntity)
        .findOne({ where: { tenantId: scope.tenantId, dealerId: session.dealerId } });
      const config = this.toConfig(cfgRow, session.dealerId);
      const instruction = buildPaymentInstruction(config);
      const amount = normalizeDepositAmount(body?.amount ?? config.defaultDepositAmount);

      const orders = em.getRepository(DepositOrderEntity);
      const order = await orders.save(orders.create({
        tenantId: scope.tenantId,
        dealerId: session.dealerId, storeId: null,
        customerId: session.customerId, opportunityId: session.opportunityId,
        reportId, amount, currency: 'CNY',
        channel: instruction.channel, state: 'awaiting_payment',
        instruction: instruction as unknown as Record<string, unknown>,
      }));

      await this.eventBus.publishInTx(em, {
        tenantId: scope.tenantId, eventType: 'deposit.intent.created',
        aggregateType: 'deposit_order', aggregateId: order.id,
        payload: {
          depositId: order.id, dealerId: order.dealerId, customerId: order.customerId,
          opportunityId: order.opportunityId, reportId, amount, channel: order.channel,
        },
      });
      return { success: true, data: { depositId: order.id, state: order.state, amount, currency: order.currency, instruction } };
    }, this.rls(scope as any));
  }

  // ── 经销商侧：确认收款 / 退款（状态机） ──────────────────────────────────────
  async confirmPaid(user: JwtPayload, depositId: string) {
    return this.transition(user, depositId, 'mark_paid', 'deposit.paid');
  }

  async refund(user: JwtPayload, depositId: string) {
    return this.transition(user, depositId, 'refund', 'deposit.refunded');
  }

  private async transition(user: JwtPayload, depositId: string, action: string, eventType: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const orders = em.getRepository(DepositOrderEntity);
      const where: any = { id: depositId, tenantId: user.tenantId };
      if (user.dealerId) where.dealerId = user.dealerId; // 归属校验：非本经销商订单不可操作
      const order = await orders.findOne({ where });
      if (!order) throw new NotFoundException('定金订单不存在');
      const next = resolveDepositTransition(action, order.state as DepositState);
      if (!next) throw new BadRequestException(`非法状态流转：${action} 不可从 ${order.state} 执行`);
      order.state = next;
      if (next === 'paid') order.paidAt = new Date();
      if (next === 'refunded') order.refundedAt = new Date();
      await orders.save(order);
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId, eventType,
        aggregateType: 'deposit_order', aggregateId: order.id,
        payload: {
          depositId: order.id, dealerId: order.dealerId, customerId: order.customerId,
          opportunityId: order.opportunityId, reportId: order.reportId, state: order.state,
        },
      });
      return { success: true, data: { depositId: order.id, state: order.state } };
    }, this.rls(user));
  }
}
