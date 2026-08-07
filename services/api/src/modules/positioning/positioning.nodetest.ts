import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';
import { PositioningHouseEntity } from './positioning.entity';
import { PositioningService } from './positioning.service';

const actor: any = { userId: 'u1', tenantId: 't1', role: 'hq_admin' };

function fixture(rows: any[] = []) {
  const repo = new InMemoryRepository();
  repo.seed(...rows);
  const { ds } = makeFakeDataSource([[PositioningHouseEntity, repo]]);
  return { svc: new PositioningService(ds), repo };
}

test('批准：缺核心承诺/支柱 → 拦截', async () => {
  const { svc } = fixture([{ id: 'h1', tenantId: 't1', status: 'draft', promise: '', pillars: [] }]);
  await assert.rejects(() => svc.setStatus(actor, 'h1', 'approved'), /缺核心承诺\/支柱/);
});

test('批准：承诺+支柱齐备 → 通过', async () => {
  const { svc, repo } = fixture([{ id: 'h2', tenantId: 't1', status: 'draft', promise: '恒温', pillars: [{ title: '稳定' }] }]);
  const r: any = await svc.setStatus(actor, 'h2', 'approved');
  assert.equal(r.status, 'approved');
  assert.equal((repo.rows.find((x: any) => x.id === 'h2') as any).status, 'approved');
});

test('归档：不受承诺/支柱限制', async () => {
  const { svc } = fixture([{ id: 'h3', tenantId: 't1', status: 'draft', promise: '', pillars: [] }]);
  assert.equal((await svc.setStatus(actor, 'h3', 'archived') as any).status, 'archived');
});
