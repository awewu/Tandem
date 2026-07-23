import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BimService } from './bim.service';
import { BimProjectEntity } from './bim.entity';
import { QuotationEntity } from '../quote/quote.entity';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';

// P0-1 · 签单承接幂等：同一报价单不重复创建 BIM 项目。
// 直测真实 BimService.inheritFromQuotation 的幂等短路分支（不连库）。

const T = 'tenant-1';
const USER: any = { tenantId: T, userId: 'u1', role: 'dealer_admin' };

test('inheritFromQuotation: 已存在同 quotation 的项目 → created:false，返回既有项目', async () => {
  const projRepo = new InMemoryRepository<any>().seed({ id: 'proj-existing', tenantId: T, quotationId: 'q1' });
  const quoteRepo = new InMemoryRepository<any>().seed({ id: 'q1', tenantId: T, customerId: 'c1' });
  const { ds } = makeFakeDataSource([
    [BimProjectEntity, projRepo],
    [QuotationEntity, quoteRepo],
  ]);
  const svc = new BimService(ds);

  const r = await svc.inheritFromQuotation(USER, 'q1');
  assert.equal(r.created, false, '幂等：不应重复创建');
  assert.equal(r.project.id, 'proj-existing');
  assert.equal(projRepo.rows.length, 1, '不应新增项目行');
});

test('inheritFromQuotation: 报价不存在 → findOneByOrFail 抛错', async () => {
  const projRepo = new InMemoryRepository<any>();
  const quoteRepo = new InMemoryRepository<any>();
  const { ds } = makeFakeDataSource([
    [BimProjectEntity, projRepo],
    [QuotationEntity, quoteRepo],
  ]);
  const svc = new BimService(ds);
  await assert.rejects(() => svc.inheritFromQuotation(USER, 'missing'), /EntityNotFound/);
});
