import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuoteService } from './quote.service';
import { QuotationEntity } from './quote.entity';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';

// P0-1 · 报价价格快照锁定（PRD 4.9）· 金额关键路径单测。
// 直测真实 QuoteService.lockQuotation：护栏阻断 / 幂等 / 快照冻结不可变。

const T = 'tenant-1';
const USER: any = { tenantId: T, userId: 'u1', role: 'hq_admin' };

function fakeGuardrail(result: any) {
  return { evaluate: async () => result } as any;
}
const fakeEventBus: any = { publishInTx: async () => ({}) };
const PASS: any = { blocked: false, passed: true, violations: [], facts: {} };

function svcWith(quote: Partial<QuotationEntity>, guardrail: any = PASS) {
  const repo = new InMemoryRepository<any>().seed({ ...quote });
  const { ds, repoFor } = makeFakeDataSource([[QuotationEntity, repo]]);
  const svc = new QuoteService(ds, fakeGuardrail(guardrail), fakeEventBus);
  return { svc, repo: repoFor<any>(QuotationEntity) };
}

test('lockQuotation: draft → locked，冻结价格快照并置 lockedVersion=1', async () => {
  const { svc } = svcWith({
    id: 'q1', tenantId: T, status: 'draft',
    items: [{ sku: 'HW-1', name: '热水器', price: 8000, quantity: 1 }],
  });
  const saved = await svc.lockQuotation(USER, 'q1');
  assert.equal(saved.status, 'locked');
  assert.equal((saved.quotationLock as any).locked, true);
  assert.equal((saved.quotationLock as any).lockedVersion, 1);
  assert.equal((saved.priceSnapshot as any).items[0].unitPrice, 8000);
  assert.ok((saved.priceSnapshot as any).frozenAt, '快照须带 frozenAt 时间戳');
});

test('lockQuotation: 已锁 → 幂等返回，不再自增 lockedVersion', async () => {
  const { svc } = svcWith({
    id: 'q1', tenantId: T, status: 'locked',
    items: [{ sku: 'HW-1', price: 8000, quantity: 1 }],
    quotationLock: { locked: true, lockedVersion: 1 },
  });
  const saved = await svc.lockQuotation(USER, 'q1');
  assert.equal((saved.quotationLock as any).lockedVersion, 1, '幂等：版本不应再自增');
});

test('lockQuotation: 护栏 block → 抛错且不落锁', async () => {
  const { svc, repo } = svcWith(
    { id: 'q1', tenantId: T, status: 'draft', items: [{ sku: 'X', price: 1, quantity: 1 }] },
    { blocked: true, passed: false, violations: [{ code: 'below_cost' }], facts: {} },
  );
  await assert.rejects(() => svc.lockQuotation(USER, 'q1'), /价格护栏/);
  assert.notEqual(repo.rows[0].status, 'locked', 'block 时不得落锁');
  assert.equal(repo.rows[0].quotationLock, undefined);
});

test('lockQuotation: 报价不存在 → 抛错', async () => {
  const { svc } = svcWith({ id: 'other', tenantId: T, status: 'draft', items: [] });
  await assert.rejects(() => svc.lockQuotation(USER, 'missing'), /报价不存在/);
});

test('快照不可变：锁后改动源报价项价格，不影响已冻结快照', async () => {
  const { svc, repo } = svcWith({
    id: 'q1', tenantId: T, status: 'draft',
    items: [{ sku: 'HW-1', price: 8000, quantity: 1 }],
  });
  const saved = await svc.lockQuotation(USER, 'q1');
  const frozen = (saved.priceSnapshot as any).items[0].unitPrice;
  // 模拟品牌库/后续改价：直接改动存储行的源 items
  repo.rows[0].items[0].price = 9999;
  assert.equal((saved.priceSnapshot as any).items[0].unitPrice, frozen, '快照价格须与源解耦');
  assert.equal(frozen, 8000);
});
