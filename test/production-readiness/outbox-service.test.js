const OutboxService = require('../../server/modules/outbox/outbox.service');

describe('production outbox service', () => {
  test('publishes tenant-scoped idempotent events in memory mode', async () => {
    const memoryDb = {};
    const service = new OutboxService({
      memoryDb,
      now: () => new Date('2026-06-06T00:00:00.000Z')
    });
    const scope = { tenantId: 'tenant-1', requestId: 'req-1', traceId: 'trace-1' };

    const first = await service.publish(scope, {
      aggregateType: 'quotation',
      aggregateId: 'quote-1',
      eventType: 'quotation.persisted',
      idempotencyKey: 'tenant-1:quote-1:quotation.persisted',
      payload: { quotationNo: 'Q-1' }
    });
    const second = await service.publish(scope, {
      aggregateType: 'quotation',
      aggregateId: 'quote-1',
      eventType: 'quotation.persisted',
      idempotencyKey: 'tenant-1:quote-1:quotation.persisted',
      payload: { quotationNo: 'Q-1-duplicate' }
    });

    expect(first).toBe(second);
    expect(memoryDb.outboxEvents).toHaveLength(1);
    expect(first).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      aggregateType: 'quotation',
      aggregateId: 'quote-1',
      eventType: 'quotation.persisted',
      idempotencyKey: 'tenant-1:quote-1:quotation.persisted',
      status: 'pending',
      attempts: 0,
      requestId: 'req-1',
      traceId: 'trace-1',
      storageMode: 'memory'
    }));
  });

  test('lists events only inside tenant scope', async () => {
    const memoryDb = {};
    const service = new OutboxService({ memoryDb });

    await service.publish({ tenantId: 'tenant-a' }, {
      aggregateType: 'lifecycle_link',
      aggregateId: 'CNT-A',
      eventType: 'lifecycle.handover.upsert'
    });
    await service.publish({ tenantId: 'tenant-b' }, {
      aggregateType: 'lifecycle_link',
      aggregateId: 'CNT-B',
      eventType: 'lifecycle.handover.upsert'
    });

    const result = await service.list({ tenantId: 'tenant-a' }, { eventType: 'lifecycle.handover.upsert' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      tenantId: 'tenant-a',
      aggregateId: 'CNT-A'
    }));
  });

  test('rejects events without tenant and aggregate identity', async () => {
    const service = new OutboxService({ memoryDb: {} });

    await expect(service.publish({}, {
      aggregateType: 'quotation',
      aggregateId: 'quote-1',
      eventType: 'quotation.persisted'
    })).rejects.toThrow('tenantId is required for outbox events');

    await expect(service.publish({ tenantId: 'tenant-1' }, {
      aggregateType: 'quotation',
      eventType: 'quotation.persisted'
    })).rejects.toThrow('aggregateId is required for outbox events');

    await expect(service.publish({ tenantId: 'tenant-1' }, {
      aggregateType: 'quotation',
      aggregateId: 'quote-1',
      eventType: 'quotation.persisted',
      status: 'random'
    })).rejects.toThrow('unsupported outbox status');
  });

  test('claims pending events only when available inside tenant scope', async () => {
    const memoryDb = {};
    const now = new Date('2026-06-06T08:00:00.000Z');
    const service = new OutboxService({ memoryDb, now: () => now });

    const ready = await service.publish({ tenantId: 'tenant-a' }, {
      aggregateType: 'lifecycle_link',
      aggregateId: 'CNT-A',
      eventType: 'lifecycle.handover.upsert'
    });
    await service.publish({ tenantId: 'tenant-a' }, {
      aggregateType: 'lifecycle_link',
      aggregateId: 'CNT-FUTURE',
      eventType: 'lifecycle.handover.upsert',
      availableAt: new Date('2026-06-06T09:00:00.000Z')
    });
    await service.publish({ tenantId: 'tenant-b' }, {
      aggregateType: 'lifecycle_link',
      aggregateId: 'CNT-B',
      eventType: 'lifecycle.handover.upsert'
    });

    const claimed = await service.claimPending({ tenantId: 'tenant-a', workerId: 'worker-1' }, { limit: 5 });

    expect(claimed.items).toHaveLength(1);
    expect(claimed.items[0]).toBe(ready);
    expect(claimed.items[0]).toEqual(expect.objectContaining({
      status: 'delivering',
      lockedAt: '2026-06-06T08:00:00.000Z',
      workerId: 'worker-1'
    }));
  });

  test('marks delivered events without crossing tenant boundary', async () => {
    const memoryDb = {};
    const service = new OutboxService({
      memoryDb,
      now: () => new Date('2026-06-06T08:00:00.000Z')
    });
    const event = await service.publish({ tenantId: 'tenant-a' }, {
      aggregateType: 'quotation',
      aggregateId: 'quote-1',
      eventType: 'quotation.persisted'
    });

    expect(await service.markDelivered({ tenantId: 'tenant-b' }, event.id)).toBeNull();
    const delivered = await service.markDelivered({ tenantId: 'tenant-a' }, event.id);

    expect(delivered).toEqual(expect.objectContaining({
      status: 'delivered',
      deliveredAt: '2026-06-06T08:00:00.000Z'
    }));
  });

  test('retries failed delivery with backoff and dead_letter after max attempts', async () => {
    const memoryDb = {};
    const service = new OutboxService({
      memoryDb,
      maxAttempts: 2,
      baseDelayMs: 1000,
      now: () => new Date('2026-06-06T08:00:00.000Z')
    });
    const event = await service.publish({ tenantId: 'tenant-a' }, {
      aggregateType: 'quotation',
      aggregateId: 'QUOTE-1',
      eventType: 'quotation.persisted'
    });

    const firstFailure = await service.markFailed({ tenantId: 'tenant-a' }, event.id, new Error('temporary queue outage'));
    expect(firstFailure).toEqual(expect.objectContaining({
      status: 'pending',
      attempts: 1,
      lastError: 'temporary queue outage',
      availableAt: '2026-06-06T08:00:01.000Z'
    }));

    const secondFailure = await service.markFailed({ tenantId: 'tenant-a' }, event.id, 'queue still unavailable');
    expect(secondFailure).toEqual(expect.objectContaining({
      status: 'dead_letter',
      attempts: 2,
      lastError: 'queue still unavailable',
      deadLetteredAt: '2026-06-06T08:00:00.000Z'
    }));
  });

  test('replays dead_letter events as pending without losing idempotency key', async () => {
    const memoryDb = {};
    const service = new OutboxService({
      memoryDb,
      maxAttempts: 1,
      now: () => new Date('2026-06-06T08:00:00.000Z')
    });
    const event = await service.publish({ tenantId: 'tenant-a' }, {
      aggregateType: 'quotation',
      aggregateId: 'QUOTE-2',
      eventType: 'quotation.persisted',
      idempotencyKey: 'tenant-a:QUOTE-2:quotation.persisted'
    });
    await service.markFailed({ tenantId: 'tenant-a' }, event.id, 'object storage unavailable');

    expect(await service.replay({ tenantId: 'tenant-b' }, event.id)).toBeNull();
    const replayed = await service.replay({ tenantId: 'tenant-a' }, event.id, { reason: 'operator-fixed-storage' });

    expect(replayed).toEqual(expect.objectContaining({
      status: 'pending',
      availableAt: '2026-06-06T08:00:00.000Z',
      replayedAt: '2026-06-06T08:00:00.000Z',
      replayReason: 'operator-fixed-storage',
      idempotencyKey: 'tenant-a:QUOTE-2:quotation.persisted'
    }));
    expect(replayed.deadLetteredAt).toBeUndefined();
    expect(replayed.lastError).toBeUndefined();
  });
});
