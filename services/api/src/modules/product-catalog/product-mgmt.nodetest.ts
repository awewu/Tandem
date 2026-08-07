import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';
import { PricingPolicyEntity } from './product-mgmt.entity';
import { ProductMgmtService } from './product-mgmt.service';

const actor: any = { userId: 'u1', tenantId: 't1', role: 'hq_admin' };

function fixture(rows: any[] = []) {
  const repo = new InMemoryRepository();
  repo.seed(...rows);
  const { ds } = makeFakeDataSource([[PricingPolicyEntity, repo]]);
  return { svc: new ProductMgmtService(ds), repo };
}

test('定价提报：低毛利 → gatePassed=false + 告警', async () => {
  const { svc } = fixture();
  const r: any = await svc.submitPricingPolicy(actor, { sku: 'A1', policyType: 'promo', proposedPrice: 1000, costPrice: 950 });
  assert.equal(r.gatePassed, false);
  assert.ok(r.warning);
});

test('定价审批：毛利闸未过时批准被拦(基座3)', async () => {
  const { svc, repo } = fixture([{ id: 'p1', tenantId: 't1', status: 'submitted', marginCalc: { gatePassed: false } }]);
  await assert.rejects(() => svc.decidePricingPolicy(actor, 'p1', 'approved'), /毛利闸未通过/);
  assert.equal((repo.rows.find((x: any) => x.id === 'p1') as any).status, 'submitted');
});

test('定价审批：过闸可批准；驳回不受闸限制', async () => {
  const { svc } = fixture([
    { id: 'p2', tenantId: 't1', status: 'submitted', marginCalc: { gatePassed: true } },
    { id: 'p3', tenantId: 't1', status: 'submitted', marginCalc: { gatePassed: false } },
  ]);
  assert.equal((await svc.decidePricingPolicy(actor, 'p2', 'approved') as any).status, 'approved');
  assert.equal((await svc.decidePricingPolicy(actor, 'p3', 'rejected') as any).status, 'rejected');
});
