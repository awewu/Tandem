import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';
import { withRlsTransaction } from '../common/rls';

export interface OutboxPublish {
  tenantId?: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
}

type Handler = (event: OutboxEventEntity) => Promise<void> | void;

/**
 * M15 · 跨板块事件总线（eventBus / event_bus）。
 * publish() 写 outbox（与业务写同事务由调用方保证）；dispatchPending() 投递给订阅者；
 * 至少一次投递 + 重试 + 死信。板块间只经此总线通信，禁止直连。
 */
@Injectable()
export class EventBusService {
  private readonly subscribers = new Map<string, Handler[]>();
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(OutboxEventEntity) private readonly outbox: Repository<OutboxEventEntity>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  subscribe(eventType: string, handler: Handler) {
    const list = this.subscribers.get(eventType) || [];
    list.push(handler);
    this.subscribers.set(eventType, list);
  }

  async publish(p: OutboxPublish): Promise<OutboxEventEntity> {
    return this.outbox.save(this.draft(p));
  }

  /**
   * 事务内发射：在业务写的同一事务（withRlsTransaction 的 EntityManager）里写 outbox，
   * 保证「业务变更 + 事件」原子落库——这是 outbox 模式的核心。调用方务必传入事务 manager。
   */
  async publishInTx(manager: EntityManager, p: OutboxPublish): Promise<OutboxEventEntity> {
    const repo = manager.getRepository(OutboxEventEntity);
    return repo.save(repo.create(this.draft(p)));
  }

  private draft(p: OutboxPublish): Partial<OutboxEventEntity> {
    return {
      tenantId: p.tenantId ?? null,
      eventType: p.eventType,
      aggregateType: p.aggregateType,
      aggregateId: p.aggregateId,
      payload: p.payload || {},
      status: 'pending',
      attempts: 0,
    };
  }

  /**
   * 投递 pending 事件给订阅者；失败重试，超限置死信。
   *
   * mdm_outbox_events 启用 FORCE RLS（tenant_id IS NULL OR tenant_id=current_tenant_id()），
   * 故：
   *  - 不带 tenantId：只处理 foundation（tenant_id NULL）事件（裸连接无 GUC）；
   *  - 带 tenantId：在该租户 RLS 事务内处理其租户级事件（可见 + 可 UPDATE）。
   * 生产的全租户扇出由 Temporal 投递器按租户上下文驱动；此方法供运维/测试触发。
   */
  async dispatchPending(limit = 100, tenantId?: string) {
    if (tenantId) {
      return withRlsTransaction(
        this.ds,
        (em) => this.drain(em.getRepository(OutboxEventEntity), limit),
        { tenantId, actorId: 'system:event-bus' },
      );
    }
    return this.drain(this.outbox, limit);
  }

  /**
   * P2-4 · 关键用户动作（如签单）后的即时催投：在紧邻的下一个事件循环立即投递该租户
   * pending 事件，把下游可见反应（站内通知/生命周期推进等）从"等 sweep（≤5s）"压缩到毫秒级，
   * 消除"点了没反应"的演示级延迟。
   *
   * 语义：**尽力而为**——吞掉任何投递异常（周期 sweep / Redis 消费组仍是兜底真相源），
   * 绝不让催投失败反噬触发它的业务动作。返回 Promise 供调用方按需 await（测试可断言已投递）。
   */
  async kickDispatch(tenantId?: string, limit = 100): Promise<void> {
    try {
      await this.dispatchPending(limit, tenantId);
    } catch {
      /* 催投失败无害：outbox 仍为真相源，周期调度器会兜底重投 */
    }
  }

  private async drain(repo: Repository<OutboxEventEntity>, limit: number) {
    const pending = await repo.find({ where: { status: 'pending' }, take: limit });
    let delivered = 0, dead = 0;
    for (const event of pending) {
      const r = await this.deliverEvent(repo, event);
      if (r === 'delivered') delivered++;
      else if (r === 'dead') dead++;
    }
    return { processed: pending.length, delivered, dead };
  }

  /**
   * 幂等投递单条事件（供 Redis Stream 消费组调用）：
   *  - 事件不存在（跨租户不可见/已清理）→ 'skipped'；
   *  - 已非 pending（delivered/dead）→ 'skipped'（应对重放/重复 XADD）；
   *  - 否则运行订阅者，成功 delivered / 失败重试或死信。
   * 在调用方给定的租户 RLS 事务内执行（tenantId 为空则用裸连接处理 foundation 事件）。
   */
  async deliverEventById(outboxId: string, tenantId?: string): Promise<'delivered' | 'skipped' | 'failed' | 'dead'> {
    const run = (repo: Repository<OutboxEventEntity>) => (async () => {
      const event = await repo.findOne({ where: { id: outboxId } });
      if (!event) return 'skipped' as const;
      if (event.status !== 'pending') return 'skipped' as const; // 幂等：已投递/死信不重复
      return this.deliverEvent(repo, event);
    })();
    if (tenantId) {
      return withRlsTransaction(this.ds, (em) => run(em.getRepository(OutboxEventEntity)), { tenantId, actorId: 'system:event-bus' });
    }
    return run(this.outbox);
  }

  /** 运行订阅者并落状态（delivered/failed/dead）。假定 event 为 pending。 */
  private async deliverEvent(repo: Repository<OutboxEventEntity>, event: OutboxEventEntity): Promise<'delivered' | 'failed' | 'dead'> {
    const handlers = this.subscribers.get(event.eventType) || [];
    try {
      for (const h of handlers) await h(event);
      event.status = 'delivered';
      event.deliveredAt = new Date();
      await repo.save(event);
      return 'delivered';
    } catch (err: any) {
      event.attempts += 1;
      event.lastError = String(err?.message || err);
      const dead = event.attempts >= this.MAX_ATTEMPTS;
      if (dead) event.status = 'dead';
      await repo.save(event);
      return dead ? 'dead' : 'failed';
    }
  }

  /**
   * 只读列出 pending 事件摘要（供 Redis Stream relay 中继用；不投递、不改状态）。
   * tenantId 为空 → foundation（tenant NULL）事件；否则该租户 RLS 事务内可见事件。
   */
  async listPending(limit = 200, tenantId?: string): Promise<Array<{ id: string; tenantId: string | null; eventType: string }>> {
    const read = async (repo: Repository<OutboxEventEntity>) => {
      const rows = await repo.find({ where: { status: 'pending' }, take: limit });
      return rows.map((e) => ({ id: e.id, tenantId: e.tenantId, eventType: e.eventType }));
    };
    if (tenantId) {
      return withRlsTransaction(this.ds, (em) => read(em.getRepository(OutboxEventEntity)), { tenantId, actorId: 'system:event-bus' });
    }
    return read(this.outbox);
  }

  async deadLetters() {
    return this.outbox.find({ where: { status: 'dead' } });
  }
}
