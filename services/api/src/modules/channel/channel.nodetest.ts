import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';
import { ChannelRebateEntity } from './channel.entity';
import { ChannelService } from './channel.service';

const actor: any = { userId: 'u1', tenantId: 't1', role: 'hq_admin' };
const noopEventBus: any = { subscribe() {}, publishInTx: async () => ({}) };

function fixture(rebateRows: any[] = []) {
  const rebateRepo = new InMemoryRepository();
  rebateRepo.seed(...rebateRows);
  const { ds } = makeFakeDataSource([[ChannelRebateEntity, rebateRepo]]);
  const svc = new ChannelService(ds);
  return { svc, rebateRepo };
}

test('返利提报：毛利闸未过 → 标记 gatePassed=false + 返回告警', async () => {
  const { svc } = fixture();
  const r: any = await svc.submitRebate(actor, { period: '2026Q1', basis: 'gmv', amount: 1800, gmv: 10000, baseMarginRate: 0.2 });
  assert.equal(r.gatePassed, false);
  assert.ok(r.warning, '应返回毛利告警');
});

test('返利审批：毛利闸未过时批准被拦(基座3)', async () => {
  const { svc, rebateRepo } = fixture([
    { id: 'rb1', tenantId: 't1', status: 'submitted', amount: 1800, marginCalc: { gatePassed: false } },
  ]);
  await assert.rejects(() => svc.decideRebate(actor, 'rb1', 'approved'), /毛利闸未通过/);
  // 状态未被改动
  const row: any = rebateRepo.rows.find((x: any) => x.id === 'rb1');
  assert.equal(row.status, 'submitted');
});

test('返利审批：毛利闸通过时可批准', async () => {
  const { svc, rebateRepo } = fixture([
    { id: 'rb2', tenantId: 't1', status: 'submitted', amount: 500, marginCalc: { gatePassed: true } },
  ]);
  const r: any = await svc.decideRebate(actor, 'rb2', 'approved');
  assert.equal(r.status, 'approved');
  const row: any = rebateRepo.rows.find((x: any) => x.id === 'rb2');
  assert.equal(row.status, 'approved');
});
