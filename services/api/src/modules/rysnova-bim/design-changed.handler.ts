import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusService } from '../mdm/event-bus.service';
import { OutboxEventEntity } from '../mdm/outbox-event.entity';
import { DesignSyncService } from './design-sync.service';
import { QuoteService } from '../quote/quote.service';
import { QuotationEntity } from '../quote/quote.entity';
import { DesignProjectEntity, FloorPlanEntity } from '../design/design.entity';
import { withRlsTransaction } from '../common/rls';

/**
 * W-BIM-2 · 2.1：design.changed 事件消费端。
 * 职责：
 *  1. 把该 design 关联的 Rysnova 深化产物置 stale（单一真相源同步）。
 *  2. 对同一 opportunity 下的报价进行重算（基于最新 design 与既有设备清单）。
 *  3. 发布 quote.recalculated / quote.stale 事件供后续工作流消费。
 *
 * 注意：当前报价重算为 v1 实现，仅更新 costBreakdown 与 meta；后续随报价模型
 * 细化，可替换为完整 BOM 重算。
 */
@Injectable()
export class DesignChangedHandler implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly designSync: DesignSyncService,
    private readonly quoteService: QuoteService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('design.changed', (event) => this.handle(event));
  }

  async handle(event: OutboxEventEntity): Promise<void> {
    const payload = event.payload as Record<string, any>;
    const tenantId = event.tenantId ?? payload.tenantId;
    const designProjectId = payload.designProjectId as string;
    const designVersion = payload.designVersion as string;
    const opportunityId = payload.opportunityId as string | undefined;
    const dealerId = payload.dealerId as string | undefined;

    if (!tenantId || !designProjectId || !designVersion) {
      throw new Error('design.changed 事件缺少 tenantId/designProjectId/designVersion');
    }

    const owner = dealerId ? { dealerId } : undefined;

    // 1. 派生产物置 stale
    await this.designSync.onDesignChanged(tenantId, designProjectId, designVersion, owner);

    // 2. 同一 opportunity 的报价重算
    if (opportunityId) {
      await this.recalculateQuotes(tenantId, opportunityId, designProjectId, payload);
    }
  }

  private async recalculateQuotes(
    tenantId: string,
    opportunityId: string,
    designProjectId: string,
    payload: Record<string, any>,
  ): Promise<void> {
    await withRlsTransaction(
      this.ds,
      async (em) => {
        const quotations = em.getRepository(QuotationEntity);
        const quotes = await quotations.find({
          where: { tenantId, opportunityId },
          order: { updatedAt: 'DESC' },
        });
        if (!quotes.length) return;

        const design = await this.buildLatestDesignDto(em, tenantId, designProjectId);

        for (const quote of quotes) {
          // 仅对非已签/已锁的报价重算；已签报价需要变更流程另行处理
          if (quote.status === 'signed' || quote.status === 'locked') {
            continue;
          }

          const devices = (quote.items || []).map((it: any) => ({
            sku: it.sku ?? it.model ?? null,
            name: it.name ?? null,
            price: Number(it.unitPrice ?? it.price ?? 0),
            quantity: Number(it.quantity ?? 1),
          }));

          const recalc = await this.quoteService.generate({ design, devices });
          const summary = (recalc as any)?.summary ?? recalc;

          const costBreakdown = {
            ...(quote.costBreakdown || {}),
            subtotal: summary?.subtotal ?? 0,
            tax: summary?.tax ?? 0,
            total: summary?.total ?? 0,
            currency: summary?.currency ?? 'CNY',
            recalculatedAt: new Date().toISOString(),
            recalculatedFromDesignVersion: payload.designVersion,
          };
          quote.costBreakdown = costBreakdown as unknown as Record<string, number>;
          quote.project = {
            ...(quote.project || {}),
            recalcMeta: {
              designStale: false,
              lastRecalc: new Date().toISOString(),
              recalcSource: 'design.changed',
            },
          };
          await quotations.save(quote);

          await this.eventBus.publishInTx(em, {
            tenantId,
            eventType: 'quote.recalculated',
            aggregateType: 'quotation',
            aggregateId: quote.id,
            payload: {
              quotationId: quote.id,
              designProjectId,
              designVersion: payload.designVersion,
              opportunityId,
              summary,
            },
          });
        }
      },
      { tenantId, actorId: 'system:design-changed-handler' },
    );
  }

  private async buildLatestDesignDto(
    em: any,
    tenantId: string,
    designProjectId: string,
  ): Promise<Record<string, unknown>> {
    const project = await em.getRepository(DesignProjectEntity).findOne({
      where: { tenantId, id: designProjectId },
    });
    const plan = await em.getRepository(FloorPlanEntity).findOne({
      where: { tenantId, projectId: designProjectId },
      order: { createdAt: 'DESC' },
    });
    const projectMeta = (project?.meta ?? {}) as any;
    const planMeta = (plan?.meta ?? {}) as any;
    return {
      area: Number(planMeta.area ?? projectMeta.area ?? 100),
      city: projectMeta.city ?? '上海',
      buildingType: projectMeta.buildingType ?? 'residential',
      projectId: designProjectId,
      floorPlanId: plan?.id ?? null,
      version: plan?.version ?? 'v1',
    };
  }
}
