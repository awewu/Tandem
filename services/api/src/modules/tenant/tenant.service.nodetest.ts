import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogEntity } from '../governance/governance.entity';
import { DealerEntity, StoreEntity, TenantEntity } from './tenant.entity';
import { TenantService } from './tenant.service';

type Row = Record<string, any>;

function repository(seed: Row[] = [], idPrefix = 'row') {
  const rows = seed.map(row => ({ ...row }));
  let lastUpdate: Row | null = null;
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
    async findOneBy(where: Row) {
      return rows.find(row => Object.entries(where).every(([key, value]) => row[key] === value)) || null;
    },
    async findOneByOrFail(where: Row) {
      const found = await this.findOneBy(where);
      if (!found) throw new Error('not found');
      return { ...found };
    },
    async update(id: string, patch: Row) {
      lastUpdate = { ...patch };
      const index = rows.findIndex(row => row.id === id);
      if (index >= 0) rows[index] = { ...rows[index], ...patch };
    },
    createQueryBuilder() {
      throw new Error('query builder is not used by this test');
    }
  };
}

function fixture() {
  const tenants = repository([
    { id: 'tenant-a', code: 'TA', name: 'Tenant A', type: 'dealer_group', status: 'active', settings: {} }
  ], 'tenant');
  const dealers = repository([
    { id: 'dealer-a', tenantId: 'tenant-a', code: 'DA', name: 'Dealer A', status: 'active' },
    { id: 'dealer-b', tenantId: 'tenant-a', code: 'DB', name: 'Dealer B', status: 'active' },
    { id: 'dealer-x', tenantId: 'tenant-b', code: 'DX', name: 'Dealer X', status: 'active' }
  ], 'dealer');
  const stores = repository([
    { id: 'store-a', tenantId: 'tenant-a', dealerId: 'dealer-a', code: 'SA', name: 'Store A', status: 'active' },
    { id: 'store-b', tenantId: 'tenant-a', dealerId: 'dealer-b', code: 'SB', name: 'Store B', status: 'active' }
  ], 'store');
  const audits = repository([], 'audit');
  const events: Row[] = [];

  const manager = {
    async query() { return undefined; },
    getRepository(entity: unknown) {
      if (entity === TenantEntity) return tenants;
      if (entity === DealerEntity) return dealers;
      if (entity === StoreEntity) return stores;
      if (entity === AuditLogEntity) return audits;
      throw new Error('unexpected repository');
    }
  };
  const dataSource = {
    async transaction(work: (em: any) => Promise<unknown>) { return work(manager); }
  };
  const eventBus = {
    async publishInTx(_em: unknown, event: Row) { events.push(event); return event; }
  };
  const service = new TenantService(
    dataSource as any,
    tenants as any,
    dealers as any,
    stores as any,
    eventBus as any
  );
  const user = {
    userId: 'admin-a', tenantId: 'tenant-a', dealerId: null, storeId: null,
    customerId: null, role: 'platform_admin', permissions: ['*'], modules: ['*']
  } as any;

  return { service, user, tenants, dealers, stores, audits, events };
}

test('dealer writes take tenant scope from JWT, whitelist mutable fields, and emit audit plus outbox', async () => {
  const f = fixture();
  const created = await f.service.createDealer(f.user, {
    tenantId: 'tenant-b', code: 'NEW', name: 'New Dealer'
  } as any);

  assert.equal(created.tenantId, 'tenant-a');
  assert.equal(f.audits.rows.at(-1)?.action, 'dealer.create');
  assert.equal(f.events.at(-1)?.eventType, 'tenant.dealer.created');

  await f.service.updateDealer(f.user, created.id, {
    tenantId: 'tenant-b', id: 'dealer-hijack', createdAt: 'yesterday', name: 'Renamed Dealer'
  });

  assert.deepEqual(f.dealers.lastUpdate, { name: 'Renamed Dealer' });
  assert.equal(f.audits.rows.at(-1)?.action, 'dealer.update');
  assert.equal(f.events.at(-1)?.eventType, 'tenant.dealer.updated');
});

test('store creation rejects a dealer outside the authenticated tenant', async () => {
  const f = fixture();
  await assert.rejects(
    () => f.service.createStore(f.user, { dealerId: 'dealer-x', code: 'SX', name: 'Cross Tenant Store' }),
    /经销商不存在/
  );
  assert.equal(f.stores.rows.length, 2);
  assert.equal(f.events.length, 0);
  assert.equal(f.audits.rows.length, 0);
});

test('tenant and store writes each emit an audit record and outbox event in the business transaction', async () => {
  const f = fixture();

  const tenant = await f.service.createTenant(f.user, { code: 'TC', name: 'Tenant C' });
  await f.service.updateTenant(f.user, tenant.id, { status: 'suspended', id: 'tenant-hijack' });
  const store = await f.service.createStore(f.user, { dealerId: 'dealer-a', code: 'S2', name: 'Store 2' });
  await f.service.updateStore(f.user, store.id, { name: 'Store 2 Renamed', tenantId: 'tenant-b' });

  assert.deepEqual(
    f.audits.rows.map(row => row.action),
    ['tenant.create', 'tenant.update', 'store.create', 'store.update']
  );
  assert.deepEqual(
    f.events.map(event => event.eventType),
    ['tenant.created', 'tenant.updated', 'tenant.store.created', 'tenant.store.updated']
  );
  assert.equal(f.stores.rows.find(row => row.id === store.id)?.tenantId, 'tenant-a');
});

test('dealer administrators can only read or update their own dealer and stores', async () => {
  const f = fixture();
  const dealerAdmin = { ...f.user, role: 'dealer_admin', dealerId: 'dealer-a' };

  assert.equal((await f.service.getDealer(dealerAdmin, 'dealer-a')).id, 'dealer-a');
  assert.equal((await f.service.getStore(dealerAdmin, 'store-a')).id, 'store-a');
  await assert.rejects(() => f.service.getDealer(dealerAdmin, 'dealer-b'), /不可跨经销商|经销商不存在/);
  await assert.rejects(() => f.service.getStore(dealerAdmin, 'store-b'), /不可跨经销商|门店不存在/);
  assert.throws(
    () => f.service.createDealer(dealerAdmin, { code: 'DX', name: 'Cross Dealer' }),
    /权限不足/
  );
});
