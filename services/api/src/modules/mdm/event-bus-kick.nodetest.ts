import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBusService } from './event-bus.service';

// P2-4 · 同步实时化：签单后 kickDispatch 立即投递 pending 事件（不等 sweep）。
// 用内存 fake repo 驱动 no-tenant 路径（dispatchPending→drain→deliverEvent），
// 证明：①立即投递 ②幂等（无 pending 不重投）③订阅者抛错被吞、签单不受影响。

function makeRepo(rows: any[]) {
  return {
    _rows: rows,
    async find({ where, take }: any) {
      return rows.filter((r) => r.status === where.status).slice(0, take ?? rows.length);
    },
    async findOne({ where }: any) {
      return rows.find((r) => r.id === where.id) || null;
    },
    async save(e: any) {
      const i = rows.findIndex((r) => r.id === e.id);
      if (i >= 0) rows[i] = e; else rows.push(e);
      return e;
    },
    create(d: any) { return { ...d }; },
  } as any;
}

function newService(rows: any[]) {
  // 直接构造（绕过 DI）：no-tenant 路径不触碰 DataSource。
  return new EventBusService(makeRepo(rows), {} as any);
}

test('kickDispatch：立即投递 pending 事件（无需等待 sweep）', async () => {
  const rows: any[] = [{ id: 'e1', status: 'pending', attempts: 0, eventType: 'opportunity.signed', payload: {}, tenantId: null }];
  const svc = newService(rows);
  let got: any = null;
  svc.subscribe('opportunity.signed', (e) => { got = e; });

  await svc.kickDispatch(); // no tenant → foundation 路径

  assert.equal(got?.id, 'e1', '订阅者应被立即调用');
  assert.equal(rows[0].status, 'delivered', '事件应即时标记 delivered');
  assert.ok(rows[0].deliveredAt instanceof Date);
});

test('kickDispatch：幂等——无 pending 时不重复投递', async () => {
  const rows = [{ id: 'e1', status: 'pending', attempts: 0, eventType: 'opportunity.signed', payload: {}, tenantId: null }];
  const svc = newService(rows);
  let calls = 0;
  svc.subscribe('opportunity.signed', () => { calls++; });

  await svc.kickDispatch();
  await svc.kickDispatch(); // 第二次：已 delivered，无 pending

  assert.equal(calls, 1, '已投递事件不得重复投递');
});

test('kickDispatch：订阅者抛错被吞，催投 resolve（不反噬签单）', async () => {
  const rows = [{ id: 'e1', status: 'pending', attempts: 0, eventType: 'opportunity.signed', payload: {}, tenantId: null }];
  const svc = newService(rows);
  svc.subscribe('opportunity.signed', () => { throw new Error('boom'); });

  await assert.doesNotReject(() => svc.kickDispatch(), '催投必须尽力而为、绝不抛出');
  assert.equal(rows[0].attempts, 1, '失败事件应累加 attempts（留待 sweep 兜底重投）');
  assert.notEqual(rows[0].status, 'delivered');
});

test('kickDispatch：只投 pending，delivered/dead 不动', async () => {
  const rows = [
    { id: 'e1', status: 'delivered', attempts: 0, eventType: 'opportunity.signed', payload: {}, tenantId: null },
    { id: 'e2', status: 'pending', attempts: 0, eventType: 'opportunity.signed', payload: {}, tenantId: null },
  ];
  const svc = newService(rows);
  const seen: string[] = [];
  svc.subscribe('opportunity.signed', (e) => { seen.push(e.id); });

  await svc.kickDispatch();

  assert.deepEqual(seen, ['e2'], '仅投递 pending 的 e2');
});
