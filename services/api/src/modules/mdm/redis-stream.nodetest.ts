import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStreamClient, OutboxStreamDispatcher, EVENT_STREAM_KEY, EVENT_STREAM_GROUP } from './redis-stream';

// P0-2 · Redis Stream 消费组语义证明（确定性，无需真实 Redis）：
//  1) 多消费者不重复投递：一条流消息只被组内一个消费者处理；
//  2) 消费幂等：重复 XADD 同一 outboxId 只产生一次副作用；
//  3) 失败不 ack：失败消息留在 PEL 供重试。

function deliverFactory() {
  const deliveredCount = new Map<string, number>(); // outboxId → 实际投递次数
  const deliver = async (outboxId: string): Promise<'delivered' | 'skipped' | 'failed'> => {
    const n = deliveredCount.get(outboxId) ?? 0;
    if (n > 0) return 'skipped'; // 幂等：已投递过 → 跳过（模拟 outbox 已 delivered）
    deliveredCount.set(outboxId, 1);
    return 'delivered';
  };
  return { deliver, deliveredCount };
}

test('多消费者不重复投递：5 条消息经 2 个消费者恰好各投递一次', async () => {
  const stream = new InMemoryStreamClient();
  const dispatcher = new OutboxStreamDispatcher(stream);
  await dispatcher.relay([1, 2, 3, 4, 5].map((i) => ({ id: `evt-${i}`, tenantId: 't', eventType: 'x' })));

  const { deliver, deliveredCount } = deliverFactory();
  // 两个消费者交替各读一批（每批 3）
  const a = await dispatcher.consumeOnce('consumer-A', 3, 0, deliver);
  const b = await dispatcher.consumeOnce('consumer-B', 3, 0, deliver);

  assert.equal(a.read + b.read, 5, '总读取应等于消息数（互斥，不重复读）');
  assert.equal(a.delivered + b.delivered, 5);
  // 每条恰好一次
  for (let i = 1; i <= 5; i++) assert.equal(deliveredCount.get(`evt-${i}`), 1, `evt-${i} 应恰好投递一次`);
  // 全部 ack → PEL 清空
  assert.equal(await stream.pending(EVENT_STREAM_KEY, EVENT_STREAM_GROUP), 0);
});

test('消费幂等：重复 XADD 同一 outboxId 只产生一次副作用', async () => {
  const stream = new InMemoryStreamClient();
  const dispatcher = new OutboxStreamDispatcher(stream);
  // 模拟 relay 竞态：同一 outboxId 被放进流两次
  await dispatcher.relay([{ id: 'dup-1', tenantId: 't', eventType: 'x' }]);
  await dispatcher.relay([{ id: 'dup-1', tenantId: 't', eventType: 'x' }]);

  const { deliver, deliveredCount } = deliverFactory();
  const r = await dispatcher.consumeOnce('consumer-A', 10, 0, deliver);

  assert.equal(r.read, 2, '两条流消息');
  assert.equal(r.delivered, 1, '仅首次真正投递');
  assert.equal(r.skipped, 1, '重复的一条被幂等跳过');
  assert.equal(deliveredCount.get('dup-1'), 1, '副作用只发生一次');
});

test('失败不 ack：失败消息留在 PEL 供重试', async () => {
  const stream = new InMemoryStreamClient();
  const dispatcher = new OutboxStreamDispatcher(stream);
  await dispatcher.relay([{ id: 'boom', tenantId: 't', eventType: 'x' }]);

  let attempts = 0;
  const deliver = async (): Promise<'delivered' | 'skipped' | 'failed'> => {
    attempts++;
    return attempts === 1 ? 'failed' : 'delivered'; // 首次失败，重试成功
  };

  const r1 = await dispatcher.consumeOnce('consumer-A', 10, 0, deliver);
  assert.equal(r1.failed, 1);
  assert.equal(await stream.pending(EVENT_STREAM_KEY, EVENT_STREAM_GROUP), 1, '失败未 ack → 留 PEL');
});
