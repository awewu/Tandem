import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogEntity } from '../governance/governance.entity';
import { CustomerEntity, OpportunityEntity } from '../crm/crm.entity';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { QuotationEntity } from './quote.entity';
import { QuoteService } from './quote.service';

const USER: any = {
  tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a', userId: 'seller-a', role: 'sales',
};

function fixture(options: { customer?: any; opportunity?: any; quote?: any } = {}) {
  const customers = new InMemoryRepository<any>();
  const opportunities = new InMemoryRepository<any>();
  const quotations = new InMemoryRepository<any>();
  const audits = new InMemoryRepository<any>();
  if (options.customer !== null) customers.seed(options.customer || {
    id: 'customer-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a',
  });
  if (options.opportunity !== null) opportunities.seed(options.opportunity || {
    id: 'opp-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a', customerId: 'customer-a',
  });
  if (options.quote) quotations.seed(options.quote);
  const { ds, repoFor } = makeFakeDataSource([
    [CustomerEntity, customers],
    [OpportunityEntity, opportunities],
    [QuotationEntity, quotations],
    [AuditLogEntity, audits],
  ]);
  const events: any[] = [];
  const eventBus = { async publishInTx(_em: unknown, event: any) { events.push(event); return event; } };
  const guardrail = { async evaluate() { return { blocked: false, passed: true, violations: [], facts: {} }; } };
  const service = new QuoteService(ds, guardrail as any, eventBus as any);
  return {
    service,
    events,
    customers,
    opportunities,
    quotations: repoFor<any>(QuotationEntity),
    audits: repoFor<any>(AuditLogEntity),
  };
}

test('persist scopes the complete parent graph, ignores ownership injection, and writes audit plus outbox', async () => {
  const f = fixture();
  const quote = await f.service.persist(USER, {
    customerId: 'customer-a', opportunityId: 'opp-a', status: 'draft', items: [],
    tenantId: 'tenant-b', dealerId: 'dealer-b', storeId: 'store-b', ownerUserId: 'other-user', projectId: 'other-project',
  });

  assert.equal(quote.tenantId, 'tenant-a');
  assert.equal(quote.dealerId, 'dealer-a');
  assert.equal(quote.storeId, 'store-a');
  assert.equal(quote.ownerUserId, 'seller-a');
  assert.equal(quote.projectId, null);
  assert.equal(f.audits.rows.at(-1)?.action, 'quotation.create');
  assert.equal(f.events.at(-1)?.eventType, 'quotation.created');
});

test('persist rejects cross-store customers and mismatched opportunities', async () => {
  const crossCustomer = fixture({
    customer: { id: 'customer-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-b' },
  });
  await assert.rejects(
    () => crossCustomer.service.persist(USER, { customerId: 'customer-a', items: [] }),
    /客户不存在/,
  );

  const wrongOpportunity = fixture({
    opportunity: {
      id: 'opp-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a', customerId: 'customer-other',
    },
  });
  await assert.rejects(
    () => wrongOpportunity.service.persist(USER, { customerId: 'customer-a', opportunityId: 'opp-a', items: [] }),
    /商机不存在/,
  );
});

test('lock returns not found for an unowned quote and audits a successful price freeze', async () => {
  const f = fixture({ quote: {
    id: 'quote-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a', customerId: 'customer-a',
    status: 'draft', items: [{ sku: 'HW-1', price: 8000, quantity: 1 }], quotationLock: {},
  } });
  await assert.rejects(() => f.service.lockQuotation(USER, 'missing'), /报价不存在/);

  const locked = await f.service.lockQuotation(USER, 'quote-a');
  assert.equal(locked.status, 'locked');
  assert.equal(f.audits.rows.at(-1)?.action, 'quotation.lock');
  assert.equal(f.events.at(-1)?.eventType, 'quotation.locked');
});
