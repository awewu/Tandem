import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogEntity } from '../governance/governance.entity';
import { hashPII } from '../compliance/compliance.pii';
import { CustomerEntity, InteractionEntity, OpportunityEntity } from './crm.entity';
import { CrmService } from './crm.service';

type Row = Record<string, any>;

function repository(seed: Row[] = [], idPrefix = 'row') {
  const rows = seed.map(row => ({ ...row }));
  let lastUpdate: Row | null = null;
  const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
  return {
    rows,
    get lastUpdate() { return lastUpdate; },
    create(value: Row) { return { id: value.id || `${idPrefix}-${rows.length + 1}`, ...value }; },
    async save(value: Row) {
      const saved = { ...value };
      const index = rows.findIndex(row => row.id === saved.id);
      if (index >= 0) rows[index] = saved;
      else rows.push(saved);
      return saved;
    },
    async findOneBy(where: Row) { return rows.find(row => matches(row, where)) || null; },
    async findOneByOrFail(where: Row) {
      const found = rows.find(row => matches(row, where));
      if (!found) throw new Error('not found');
      return { ...found };
    },
    async findOne(options: { where: Row }) { return rows.find(row => matches(row, options.where)) || null; },
    async find(options: { where: Row; order?: Row; take?: number }) {
      return rows.filter(row => matches(row, options.where)).slice(0, options.take);
    },
    async update(criteria: Row, patch: Row) {
      lastUpdate = { ...patch };
      const row = rows.find(candidate => matches(candidate, criteria));
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }
  };
}

function fixture() {
  const customers = repository([], 'customer');
  const opportunities = repository([], 'opportunity');
  const interactions = repository([], 'interaction');
  const audits = repository([], 'audit');
  const events: Row[] = [];
  const lifecycleCalls: Row[] = [];
  const manager = {
    async query() { return undefined; },
    getRepository(entity: unknown) {
      if (entity === CustomerEntity) return customers;
      if (entity === OpportunityEntity) return opportunities;
      if (entity === InteractionEntity) return interactions;
      if (entity === AuditLogEntity) return audits;
      throw new Error('unexpected repository');
    }
  };
  const dataSource = { async transaction(work: (em: any) => Promise<unknown>) { return work(manager); } };
  const lifecycle = {
    async advanceInTx(_em: unknown, input: Row) {
      lifecycleCalls.push(input);
      return { id: 'project-1', ...input };
    }
  };
  const eventBus = {
    async publishInTx(_em: unknown, event: Row) { events.push(event); return event; },
    async kickDispatch() { return undefined; }
  };
  const bim = { async inheritFromQuotation() { return { project: { id: 'bim-1' } }; } };
  const service = new CrmService(dataSource as any, bim as any, eventBus as any, lifecycle as any);
  const user = {
    userId: 'seller-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a',
    customerId: null, role: 'sales', permissions: [], modules: []
  } as any;
  return { service, user, customers, opportunities, interactions, audits, events, lifecycleCalls };
}

test('lead creation takes ownership from JWT, encrypts PII, and writes audit plus outbox', async () => {
  const f = fixture();
  const result = await f.service.createLead(f.user, {
    phone: '138 0013 8000', name: 'Lead A', source: 'store', city: 'Shanghai',
    tenantId: 'tenant-b', dealerId: 'dealer-b', phoneEncrypted: 'plaintext-injection'
  } as any);

  const customer = f.customers.rows[0];
  assert.equal(customer.tenantId, 'tenant-a');
  assert.equal(customer.dealerId, 'dealer-a');
  assert.equal(customer.storeId, 'store-a');
  assert.equal(customer.phoneHash, hashPII('13800138000'));
  assert.notEqual(customer.phoneEncrypted, '138 0013 8000');
  assert.match(customer.phoneEncrypted, /^v1:/);
  assert.equal((result.customer as any).phoneEncrypted, undefined);
  assert.equal(f.audits.rows.at(-1)?.action, 'customer.create');
  assert.equal(f.events.at(-1)?.eventType, 'lead.created');
  assert.equal(JSON.stringify(f.audits.rows).includes('13800138000'), false);
  assert.equal(JSON.stringify(f.events).includes('13800138000'), false);
});

test('duplicate lead is idempotent and does not emit a second audit or outbox event', async () => {
  const f = fixture();
  await f.service.createLead(f.user, { phone: '13800138000', name: 'Lead A' });
  const duplicate = await f.service.createLead(f.user, { phone: '13800138000', name: 'Lead B' });

  assert.equal(duplicate.duplicate, true);
  assert.equal(f.customers.rows.length, 1);
  assert.equal(f.opportunities.rows.length, 1);
  assert.equal(f.audits.rows.length, 1);
  assert.equal(f.events.length, 1);
});

test('opportunity updates whitelist fields and emit an audit and outbox event', async () => {
  const f = fixture();
  f.opportunities.rows.push({
    id: 'opp-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a',
    customerId: 'customer-a', stage: 'lead', probability: 0.1
  });

  const stage = await f.service.updateOpportunityStage(f.user, 'opp-a', 'qualified');
  assert.equal(stage.stage, 'qualified');
  assert.equal(f.audits.rows.at(-1)?.action, 'opportunity.stage.update');
  assert.equal(f.events.at(-1)?.eventType, 'opportunity.stage.updated');

  await f.service.updateOpportunity(f.user, 'opp-a', {
    probability: 0.6, tenantId: 'tenant-b', customerId: 'customer-b', id: 'opp-b'
  } as any);
  assert.deepEqual(f.opportunities.lastUpdate, { probability: 0.6 });
  assert.equal(f.audits.rows.at(-1)?.action, 'opportunity.update');
  assert.equal(f.events.at(-1)?.eventType, 'opportunity.updated');
});

test('interaction validates customer and optional opportunity ownership, then audits the mutation', async () => {
  const f = fixture();
  f.customers.rows.push({ id: 'customer-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a' });
  f.opportunities.rows.push({
    id: 'opp-other', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a', customerId: 'customer-other'
  });

  await assert.rejects(
    () => f.service.addInteraction(f.user, { customerId: 'customer-a', opportunityId: 'opp-other', content: 'invalid' }),
    /商机不存在/
  );
  const saved = await f.service.addInteraction(f.user, { customerId: 'customer-a', type: 'call', content: 'follow up' });
  assert.equal(saved.tenantId, 'tenant-a');
  assert.equal(f.audits.rows.at(-1)?.action, 'interaction.create');
  assert.equal(f.events.at(-1)?.eventType, 'interaction.created');
});

test('by-id mutations return not found for missing or cross-store opportunities', async () => {
  const f = fixture();
  f.opportunities.rows.push({
    id: 'opp-store-b', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-b', customerId: 'customer-b'
  });

  await assert.rejects(() => f.service.updateOpportunityStage(f.user, 'missing', 'qualified'), /商机不存在/);
  await assert.rejects(() => f.service.updateOpportunity(f.user, 'opp-store-b', { probability: 0.5 }), /商机不存在/);
  await assert.rejects(() => f.service.sign(f.user, 'opp-store-b', 'quote-1'), /商机不存在/);
  assert.equal(f.audits.rows.length, 0);
  assert.equal(f.events.length, 0);
});

test('sign writes audit and outbox in the opportunity transaction', async () => {
  const f = fixture();
  f.opportunities.rows.push({
    id: 'opp-a', tenantId: 'tenant-a', dealerId: 'dealer-a', storeId: 'store-a',
    customerId: 'customer-a', ownerUserId: 'seller-a', stage: 'quote'
  });

  const result = await f.service.sign(f.user, 'opp-a', 'quote-1');
  assert.equal(result.signed, true);
  assert.equal(f.audits.rows.at(-1)?.action, 'opportunity.sign');
  assert.equal(f.events.at(-1)?.eventType, 'opportunity.signed');
});
