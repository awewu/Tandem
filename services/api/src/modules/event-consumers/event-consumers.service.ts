import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusService } from '../mdm/event-bus.service';
import { OutboxEventEntity } from '../mdm/outbox-event.entity';
import { NotificationService } from '../notification/notification.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { InsightService } from '../insight/insight.service';
import { withRlsTransaction } from '../common/rls';
import { TARGET_API_BOOT_SMOKE } from '../boot-smoke';
import { OutboxStreamDispatcher, RedisStreamClient } from '../mdm/redis-stream';

/**
 * 跨板块 outbox 事件消费方订阅（板块间不直连，只经 event_bus）。
 * onModuleInit 把领域反应处理器注册到 EventBusService 单例；
 * EventBusService.dispatchPending() 投递 pending 事件时调用这些处理器。
 *
 * 处理器以 event.tenantId 自开 RLS 事务、system actor 身份写入，幂等可重放
 * （至少一次投递语义下安全）。
 */
@Injectable()
export class EventConsumersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EventConsumers');
  private static readonly SYSTEM_ACTOR = 'system:event-bus';
  private static readonly UUID_RE =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  // ── P0-2 · Redis Stream 驱动（opt-in：EVENT_BUS_DRIVER=redis）──────────────
  private redisTimer: ReturnType<typeof setInterval> | null = null;
  private redisClient: any = null;
  private streamDispatcher: OutboxStreamDispatcher | null = null;
  private readonly relayed = new Set<string>();          // 已中继 outboxId（进程内去重，界限 cap）
  private readonly consumerName = `api-${process.pid}`;   // 消费者名（实例区分）

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly notifications: NotificationService,
    private readonly dispatch: DispatchService,
    private readonly insight: InsightService,
  ) {}

  /**
   * GEO 探测命中竞品 → 竞品情报自动入账 ai_sov 时序点。
   * 幂等性：以 source=geo-probe:<probeId> 唯一标识一次探测，
   * 由迁移 090 的唯一索引 + ON CONFLICT DO NOTHING 兜底，重投递不再虚增量级。
   */
  private async onGeoCompetitorCited(event: OutboxEventEntity): Promise<void> {
    const payload: any = event?.payload || {};
    const competitors: string[] = Array.isArray(payload.competitors) ? payload.competitors : [];
    if (!event?.tenantId || !competitors.length) return;
    await this.insight.ingestAiSovHit(event.tenantId, {
      category: payload.category ?? null,
      competitors,
      source: `geo-probe:${payload.probeId || event.aggregateId || 'unknown'}`,
    });
  }

  onModuleInit(): void {
    // 签单 → 给商机负责人发站内通知（与签单写事务解耦，经 event_bus 投递）。
    this.eventBus.subscribe('opportunity.signed', (e) => this.onOpportunitySigned(e));
    // 线索交接层 · 公域留资捕获（获客池）→ 系统态按 地域+品类+负载 智能派单给经销商。
    this.eventBus.subscribe('lead.captured', (e) => this.onLeadCaptured(e));
    // GEO 探测命中竞品 → 自动喂竞品情报 ai_sov 时序（取代手工台账）。
    this.eventBus.subscribe('geo.competitor.cited', (e) => this.onGeoCompetitorCited(e));

    // 驱动选择（2026-07-10 裁决）：EVENT_BUS_DRIVER=redis → Redis Stream 消费组（多实例互斥投递）；
    // 默认 inprocess → 进程内 setInterval（dev/单实例）。Redis 连接失败自动回退 inprocess，绝不崩服务。
    if ((process.env.EVENT_BUS_DRIVER || 'inprocess').toLowerCase() === 'redis') {
      this.startRedisDriver().catch((e) => {
        this.logger.warn(`Redis 事件驱动启动失败，回退进程内调度器: ${String(e?.message || e)}`);
        this.startDispatchSweeper();
      });
    } else {
      this.startDispatchSweeper();
    }
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) { clearInterval(this.sweepTimer); this.sweepTimer = null; }
    if (this.redisTimer) { clearInterval(this.redisTimer); this.redisTimer = null; }
    if (this.redisClient) { try { if (this.redisClient.isOpen) this.redisClient.quit(); } catch { /* noop */ } this.redisClient = null; }
  }

  // ── outbox 投递调度器（进程内） ──────────────────────────────────────────
  // 生产由 Temporal 按租户上下文驱动投递；本调度器让 dev/单进程环境下 pending
  // 事件也能自动投递（否则跨板块反应永远停在 pending）。沿用产品发布调度器的
  // 门牌约定（`<SLUG>_TENANT_ID` 环境变量枚举运营租户），逐租户在各自 RLS 事务内
  // 投递；另跑一轮无租户投递以处理 foundation（tenant NULL）事件。
  // boot-smoke / 测试环境不启动；可用 EVENT_DISPATCH_SWEEP_MS=0 关闭。
  private startDispatchSweeper(): void {
    if (TARGET_API_BOOT_SMOKE || process.env.NODE_ENV === 'test') return;
    const raw = process.env.EVENT_DISPATCH_SWEEP_MS;
    if (raw === '0') { this.logger.log('outbox 投递调度器已禁用（EVENT_DISPATCH_SWEEP_MS=0）'); return; }
    const ms = Math.max(Number(raw) || 5_000, 1_000);
    this.sweepTimer = setInterval(() => {
      this.runDispatchSweep().catch((e) => this.logger.warn(`outbox 投递轮次异常: ${String(e)}`));
    }, ms);
    this.sweepTimer.unref?.();
    this.logger.log(`outbox 投递调度器已启动（每 ${ms}ms 投递一次）`);
  }

  private discoverTenants(): string[] {
    const out = new Set<string>();
    for (const [key, val] of Object.entries(process.env)) {
      if (/_TENANT_ID$/.test(key) && val && EventConsumersService.UUID_RE.test(val)) out.add(val);
    }
    return [...out];
  }

  /** 单轮投递：foundation（tenant NULL）+ 逐运营租户；单租户失败不影响其余。 */
  async runDispatchSweep(): Promise<{ tenants: number; delivered: number }> {
    let delivered = 0;
    try {
      const r = await this.eventBus.dispatchPending(100);
      delivered += (r as any)?.delivered ?? 0;
    } catch (err: unknown) {
      this.logger.warn(`foundation 投递跳过: ${String(err)}`);
    }
    const tenants = this.discoverTenants();
    for (const tenantId of tenants) {
      try {
        const r = await this.eventBus.dispatchPending(100, tenantId);
        delivered += (r as any)?.delivered ?? 0;
      } catch (err: unknown) {
        this.logger.warn(`投递跳过 tenant=${tenantId}: ${String(err)}`);
      }
    }
    return { tenants: tenants.length, delivered };
  }

  // ── P0-2 · Redis Stream 驱动 ─────────────────────────────────────────────
  // outbox 仍为真相源：本驱动每轮①把 pending 事件中继进流（XADD，进程内去重）②以消费组
  // 消费（XREADGROUP→幂等投递→XACK）。消费组保证多实例互斥投递；消费幂等应对重复 XADD。
  private async startRedisDriver(): Promise<void> {
    if (TARGET_API_BOOT_SMOKE || process.env.NODE_ENV === 'test') return;
    const url = process.env.REDIS_URL || process.env.REDIS_STAGING_URL;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis');
    const client = createClient({
      url: url || undefined,
      socket: url ? undefined : {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 2000),
        reconnectStrategy: false,
      },
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
    });
    client.on('error', (e: unknown) => this.logger.warn(`Redis 客户端错误: ${String((e as any)?.message || e)}`));
    await client.connect(); // 失败则抛出 → 上层回退进程内调度器
    this.redisClient = client;
    this.streamDispatcher = new OutboxStreamDispatcher(new RedisStreamClient(client));

    const ms = Math.max(Number(process.env.EVENT_DISPATCH_SWEEP_MS) || 2_000, 500);
    this.redisTimer = setInterval(() => {
      this.runRedisCycle().catch((e) => this.logger.warn(`Redis 投递轮次异常: ${String(e)}`));
    }, ms);
    this.redisTimer.unref?.();
    this.logger.log(`Redis Stream 事件驱动已启动（consumer=${this.consumerName}，每 ${ms}ms 一轮）`);
  }

  /** 单轮：中继 foundation + 逐租户 pending → 流；再消费一批。 */
  async runRedisCycle(): Promise<{ relayed: number; delivered: number; skipped: number; failed: number }> {
    const dispatcher = this.streamDispatcher;
    if (!dispatcher) return { relayed: 0, delivered: 0, skipped: 0, failed: 0 };

    // 1) 中继（进程内去重，避免同一 pending 事件每轮重复 XADD）
    let relayed = 0;
    const scopes: (string | undefined)[] = [undefined, ...this.discoverTenants()];
    for (const scope of scopes) {
      try {
        const pending = await this.eventBus.listPending(200, scope);
        const fresh = pending.filter((e) => !this.relayed.has(e.id));
        if (fresh.length) {
          relayed += await dispatcher.relay(fresh);
          for (const e of fresh) this.relayed.add(e.id);
        }
      } catch (err: unknown) {
        this.logger.warn(`Redis 中继跳过 scope=${scope ?? 'foundation'}: ${String(err)}`);
      }
    }
    if (this.relayed.size > 50_000) this.relayed.clear(); // 界限：超阈清空（幂等消费兜底重复）

    // 2) 消费（消费组互斥 + 幂等投递）
    const r = await dispatcher.consumeOnce(this.consumerName, 50, 0, async (outboxId, tenantId) => {
      try {
        const res = await this.eventBus.deliverEventById(outboxId, tenantId || undefined);
        if (res === 'delivered') return 'delivered';
        if (res === 'failed') return 'failed';
        return 'skipped'; // skipped / dead 均 ack（不重试）
      } catch (e) {
        this.logger.warn(`deliverEventById 抛错 outboxId=${outboxId} tenant=${tenantId}: ${String((e as any)?.message || e)}`);
        return 'failed';
      }
    });
    if (r.delivered || r.failed) {
      this.logger.log(`Redis 投递一轮：relayed=${relayed} read=${r.read} delivered=${r.delivered} skipped=${r.skipped} failed=${r.failed}`);
    }
    return { relayed, delivered: r.delivered, skipped: r.skipped, failed: r.failed };
  }

  private async onOpportunitySigned(event: OutboxEventEntity): Promise<void> {
    const tenantId = event.tenantId;
    const payload = (event.payload || {}) as Record<string, unknown>;
    const ownerUserId = String(payload.ownerUserId || '');
    const opportunityId = (payload.opportunityId as string) || null;
    // 无负责人绑定则不通知
    if (!tenantId || !ownerUserId) return;

    await withRlsTransaction(
      this.ds,
      (em) => this.notifications.createInTx(em, {
        tenantId, userId: ownerUserId, type: 'opportunity.signed',
        title: '签单成功', body: '商机已完成签单。',
        payload: { opportunityId, quotationId: (payload.quotationId as string) ?? null, customerId: (payload.customerId as string) ?? null },
      }),
      { tenantId, actorId: EventConsumersService.SYSTEM_ACTOR },
    );
    this.logger.log(`opportunity.signed → notification owner=${ownerUserId} tenant=${tenantId}`);
  }

  private async onLeadCaptured(event: OutboxEventEntity): Promise<void> {
    const tenantId = event.tenantId;
    const payload = (event.payload || {}) as Record<string, unknown>;
    const customerId = String(payload.customerId || event.aggregateId || '');
    if (!tenantId || !customerId) return;

    // 在获客池租户的 RLS 事务内派单（system actor）；DispatchService 读 foundation 目录、
    // 落决策审计、stamp 归属。幂等由业务判定（已归属客户不重复派单）。
    await withRlsTransaction(
      this.ds,
      (em) => this.dispatch.routeCapturedLeadInTx(em, { tenantId, customerId }),
      { tenantId, actorId: EventConsumersService.SYSTEM_ACTOR },
    );
    this.logger.log(`lead.captured → dispatch.route customer=${customerId} tenant=${tenantId}`);
  }
}
