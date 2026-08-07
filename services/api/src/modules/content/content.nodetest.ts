import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';
import { ContentAssetEntity } from './content.entity';
import { ContentService } from './content.service';

const actor: any = { userId: 'u1', tenantId: 't1', role: 'hq_admin' };

function fixture(rows: any[] = []) {
  const repo = new InMemoryRepository();
  repo.seed(...rows);
  const { ds } = makeFakeDataSource([[ContentAssetEntity, repo]]);
  return { svc: new ContentService(ds), repo };
}

test('发布：未核准 → 拦截', async () => {
  const { svc } = fixture([{ id: 'c1', tenantId: 't1', status: 'in_review', factRefs: [{ type: 'fact', id: 'f1' }] }]);
  await assert.rejects(() => svc.publish(actor, 'c1'), /须先审核通过/);
});

test('发布：已核准但无事实源 → 拦截(基座4)', async () => {
  const { svc } = fixture([{ id: 'c2', tenantId: 't1', status: 'approved', factRefs: [] }]);
  await assert.rejects(() => svc.publish(actor, 'c2'), /无事实源/);
});

test('发布：已核准 + 有事实源 → 通过', async () => {
  const { svc, repo } = fixture([{ id: 'c3', tenantId: 't1', status: 'approved', factRefs: [{ type: 'fact', id: 'f1' }] }]);
  const r: any = await svc.publish(actor, 'c3');
  assert.equal(r.status, 'published');
  assert.equal((repo.rows.find((x: any) => x.id === 'c3') as any).status, 'published');
});
