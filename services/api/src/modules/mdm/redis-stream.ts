/**
 * P0-2 · Redis Stream 事件投递底座（消费组语义）。
 *
 * 设计原则（对齐宪章 5.5.3 + 委员会架构裁决）：
 *  - outbox 表仍是事务性真相源（先写库、后进流）；Stream 只做「多实例互斥投递」的分发层。
 *  - 消费组（XREADGROUP + XACK）保证「一条流消息只被组内一个消费者处理」→ 天然去重复/去漏投。
 *  - 消费幂等：投递前按 outboxId 查库，若已 delivered/dead 则跳过（应对重放/重复 XADD）。
 *  - 客户端经接口注入：生产用 RedisStreamClient（redis v4），测试用 InMemoryStreamClient
 *    以确定性地证明「多消费者不重复投递」，无需真实 Redis。
 */

export interface StreamMessage {
  id: string;
  fields: Record<string, string>;
}

/** 最小化 Stream 客户端接口（仅本投递层用到的命令）。 */
export interface StreamClient {
  xadd(key: string, fields: Record<string, string>): Promise<string>;
  ensureGroup(key: string, group: string): Promise<void>;
  /** 读取尚未投递给本组的新消息（'>'）；无则空数组。 */
  readGroup(key: string, group: string, consumer: string, count: number, blockMs: number): Promise<StreamMessage[]>;
  ack(key: string, group: string, ids: string[]): Promise<void>;
  /** 组内待确认（PEL）条数，用于健康/烟雾探测。 */
  pending(key: string, group: string): Promise<number>;
}

/**
 * 内存 Stream 客户端：确定性模拟消费组「互斥投递 + PEL + ack」语义（测试专用，零依赖）。
 * 不实现阻塞；readGroup 立即返回当前未投递条目。
 */
export class InMemoryStreamClient implements StreamClient {
  private seq = 0;
  private readonly streams = new Map<string, StreamMessage[]>();
  // key → group → { deliveredIds:Set, pel:Set }
  private readonly groups = new Map<string, Map<string, { cursor: number; pel: Set<string> }>>();

  async xadd(key: string, fields: Record<string, string>): Promise<string> {
    const id = `${Date.now()}-${this.seq++}`;
    const list = this.streams.get(key) ?? [];
    list.push({ id, fields });
    this.streams.set(key, list);
    return id;
  }

  async ensureGroup(key: string, group: string): Promise<void> {
    if (!this.groups.has(key)) this.groups.set(key, new Map());
    const g = this.groups.get(key)!;
    if (!g.has(group)) g.set(group, { cursor: 0, pel: new Set() });
  }

  async readGroup(key: string, group: string, _consumer: string, count: number, _blockMs: number): Promise<StreamMessage[]> {
    await this.ensureGroup(key, group);
    const g = this.groups.get(key)!.get(group)!;
    const list = this.streams.get(key) ?? [];
    // 互斥核心：从组游标处取「从未投递给本组」的新消息，游标推进 → 别的消费者拿不到同一条。
    const out = list.slice(g.cursor, g.cursor + count);
    g.cursor += out.length;
    for (const m of out) g.pel.add(m.id);
    return out;
  }

  async ack(key: string, group: string, ids: string[]): Promise<void> {
    await this.ensureGroup(key, group);
    const g = this.groups.get(key)!.get(group)!;
    for (const id of ids) g.pel.delete(id);
  }

  async pending(key: string, group: string): Promise<number> {
    await this.ensureGroup(key, group);
    return this.groups.get(key)!.get(group)!.pel.size;
  }
}

/**
 * Redis v4 Stream 客户端。惰性连接；连接失败由上层降级处理。
 * client 为 redis createClient() 实例（外部注入，便于复用现有连接与配置）。
 */
export class RedisStreamClient implements StreamClient {
  constructor(private readonly client: any) {}

  async xadd(key: string, fields: Record<string, string>): Promise<string> {
    return this.client.xAdd(key, '*', fields);
  }

  async ensureGroup(key: string, group: string): Promise<void> {
    try {
      await this.client.xGroupCreate(key, group, '0', { MKSTREAM: true });
    } catch (e: any) {
      // 组已存在（BUSYGROUP）视为幂等成功；其余抛出。
      if (!String(e?.message || e).includes('BUSYGROUP')) throw e;
    }
  }

  async readGroup(key: string, group: string, consumer: string, count: number, blockMs: number): Promise<StreamMessage[]> {
    // 注意：Redis 语义中 BLOCK 0 = 永久阻塞。轮询场景须在 blockMs<=0 时省略 BLOCK，
    // 使 XREADGROUP 立即返回（无消息则空），避免调度循环被无限阻塞、堆积并发读。
    const opts: Record<string, number> = { COUNT: count };
    if (blockMs > 0) opts.BLOCK = blockMs;
    const res = await this.client.xReadGroup(
      group, consumer,
      [{ key, id: '>' }],
      opts,
    );
    if (!res || res.length === 0) return [];
    const messages = res[0]?.messages ?? [];
    return messages.map((m: any) => ({ id: m.id, fields: m.message ?? {} }));
  }

  async ack(key: string, group: string, ids: string[]): Promise<void> {
    if (ids.length) await this.client.xAck(key, group, ids);
  }

  async pending(key: string, group: string): Promise<number> {
    try {
      const info = await this.client.xPending(key, group);
      return Number(info?.pending ?? 0);
    } catch { return 0; }
  }
}

export const EVENT_STREAM_KEY = 'rhautt:events';
export const EVENT_STREAM_GROUP = 'event-consumers';

/**
 * Outbox → Stream 分发编排：把 outbox 事件 id 放进 Stream，并以消费组消费。
 * deliver 回调负责「按 outboxId 幂等投递」（由 EventBusService 提供）。
 */
export class OutboxStreamDispatcher {
  constructor(private readonly stream: StreamClient) {}

  /** 生产侧：把一批 pending outbox 事件 id 放进流（先写库后进流的第二步）。 */
  async relay(events: Array<{ id: string; tenantId?: string | null; eventType?: string }>): Promise<number> {
    let n = 0;
    for (const e of events) {
      await this.stream.xadd(EVENT_STREAM_KEY, {
        outboxId: String(e.id),
        tenantId: e.tenantId ? String(e.tenantId) : '',
        eventType: e.eventType ? String(e.eventType) : '',
      });
      n++;
    }
    return n;
  }

  /**
   * 消费侧：读一批 → 逐条 deliver（幂等）→ ack。返回本轮投递结果。
   * deliver 返回 'delivered' | 'skipped' | 'failed'；仅非 failed 才 ack（failed 留 PEL 重试）。
   */
  async consumeOnce(
    consumer: string,
    count: number,
    blockMs: number,
    deliver: (outboxId: string, tenantId: string) => Promise<'delivered' | 'skipped' | 'failed'>,
  ): Promise<{ read: number; delivered: number; skipped: number; failed: number }> {
    await this.stream.ensureGroup(EVENT_STREAM_KEY, EVENT_STREAM_GROUP);
    const msgs = await this.stream.readGroup(EVENT_STREAM_KEY, EVENT_STREAM_GROUP, consumer, count, blockMs);
    let delivered = 0, skipped = 0, failed = 0;
    const toAck: string[] = [];
    for (const m of msgs) {
      const outboxId = m.fields.outboxId;
      const tenantId = m.fields.tenantId || '';
      let r: 'delivered' | 'skipped' | 'failed';
      try {
        r = await deliver(outboxId, tenantId);
      } catch {
        // 单条投递抛错（如脏消息）不得中断整批：记为 failed，留 PEL 供重试/后续人工处置。
        r = 'failed';
      }
      if (r === 'delivered') { delivered++; toAck.push(m.id); }
      else if (r === 'skipped') { skipped++; toAck.push(m.id); }
      else { failed++; } // 不 ack，留 PEL 重试
    }
    if (toAck.length) await this.stream.ack(EVENT_STREAM_KEY, EVENT_STREAM_GROUP, toAck);
    return { read: msgs.length, delivered, skipped, failed };
  }
}
