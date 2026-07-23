import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DesignSyncService } from './design-sync.service';
import { DesignSyncEntity } from './design-sync.entity';
import { DesignProjectEntity } from '../design/design.entity';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';

// P0-1 · M12 单一真相源同步：状态机 / 版本锚点 stale 规则 / 归属(IDOR) 单测。
// 用内存 DataSource 替身直测真实 DesignSyncService 逻辑（不连库、零生产改动）。

const T = 'tenant-1';

function svcWith(links: Partial<DesignSyncEntity>[] = [], designs: Partial<DesignProjectEntity>[] = []) {
  const linkRepo = new InMemoryRepository<any>().seed(...links.map((l) => ({ ...l })));
  const designRepo = new InMemoryRepository<any>().seed(...designs.map((d) => ({ ...d })));
  const { ds, repoFor } = makeFakeDataSource([
    [DesignSyncEntity, linkRepo],
    [DesignProjectEntity, designRepo],
  ]);
  return { svc: new DesignSyncService(ds), linkRepo: repoFor<any>(DesignSyncEntity) };
}

// ── 版本锚点 stale 规则（onDesignChanged）──────────────────────────────

test('onDesignChanged: 版本不同 → 置 stale 且版本推进到新锚点', async () => {
  const { svc, linkRepo } = svcWith([
    { tenantId: T, designId: 'd1', designVersion: 'rel-A', artifactId: 'a1', syncState: 'in_sync' },
  ]);
  const r = await svc.onDesignChanged(T, 'd1', 'rel-B');
  assert.equal(r.staled, 1);
  assert.equal(linkRepo.rows[0].syncState, 'stale');
  assert.equal(linkRepo.rows[0].designVersion, 'rel-B');
});

test('onDesignChanged: 版本相同（同一 release 重放）→ 不置 stale（幂等）', async () => {
  const { svc, linkRepo } = svcWith([
    { tenantId: T, designId: 'd1', designVersion: 'rel-A', artifactId: 'a1', syncState: 'in_sync' },
  ]);
  await svc.onDesignChanged(T, 'd1', 'rel-A');
  assert.equal(linkRepo.rows[0].syncState, 'in_sync', '同版本不应被置 stale');
  assert.equal(linkRepo.rows[0].designVersion, 'rel-A');
});

test('onDesignChanged: 只影响该 design 的派生，不误伤其它 design', async () => {
  const { svc, linkRepo } = svcWith([
    { tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1', syncState: 'in_sync' },
    { tenantId: T, designId: 'd2', designVersion: 'v1', artifactId: 'a2', syncState: 'in_sync' },
  ]);
  await svc.onDesignChanged(T, 'd1', 'v2');
  const d2 = linkRepo.rows.find((r) => r.designId === 'd2');
  assert.equal(d2.syncState, 'in_sync', 'd2 不应受 d1 变更影响');
});

// ── 变更回流状态机（propose / confirm）────────────────────────────────

test('proposeChangeBackToDesign: in_sync → proposed_change 且落载荷', async () => {
  const { svc, linkRepo } = svcWith([
    { id: 's1', tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1', syncState: 'in_sync' },
  ]);
  await svc.proposeChangeBackToDesign(T, 's1', { reason: '管路冲突' });
  assert.equal(linkRepo.rows[0].syncState, 'proposed_change');
  assert.deepEqual(linkRepo.rows[0].changeProposal, { reason: '管路冲突' });
});

test('confirmDesignUpdate: 仅 proposed_change 可确认；非该态抛错', async () => {
  const { svc } = svcWith([
    { id: 's1', tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1', syncState: 'in_sync' },
  ]);
  await assert.rejects(
    () => svc.confirmDesignUpdate(T, 's1', 'reviewer', 'v2'),
    /仅 proposed_change 状态可确认/,
  );
});

test('confirmDesignUpdate: proposed_change → in_sync，推进版本并清空载荷', async () => {
  const { svc, linkRepo } = svcWith([
    { id: 's1', tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1',
      syncState: 'proposed_change', changeProposal: { reason: 'x' } },
  ]);
  await svc.confirmDesignUpdate(T, 's1', 'alice', 'v2');
  const row = linkRepo.rows[0];
  assert.equal(row.syncState, 'in_sync');
  assert.equal(row.designVersion, 'v2');
  assert.equal(row.reviewedBy, 'alice');
  assert.equal(row.changeProposal, null);
});

// ── 归属校验（IDOR：同租户跨经销商不可见）──────────────────────────────

test('proposeChangeBackToDesign: 跨经销商访问 → 404（不泄露存在性）', async () => {
  const { svc } = svcWith(
    [{ id: 's1', tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1', syncState: 'in_sync' }],
    [{ id: 'd1', tenantId: T, dealerId: 'dealer-OWNER' }],
  );
  await assert.rejects(
    () => svc.proposeChangeBackToDesign(T, 's1', { r: 1 }, { dealerId: 'dealer-INTRUDER' } as any),
    /设计项目不存在/,
  );
});

// ── 同步状态汇总（getSyncStatus）──────────────────────────────────────

test('getSyncStatus: 汇总各态计数，allInSync 仅当全 in_sync', async () => {
  const { svc } = svcWith([
    { tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1', syncState: 'in_sync' },
    { tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a2', syncState: 'stale' },
  ]);
  const s = await svc.getSyncStatus(T, 'd1');
  assert.equal(s.artifacts, 2);
  assert.equal(s.states.in_sync, 1);
  assert.equal(s.states.stale, 1);
  assert.equal(s.allInSync, false);
  assert.equal(s.sourceOfTruth, 'design');
});

test('getSyncStatus: 全部 in_sync 且非空 → allInSync=true', async () => {
  const { svc } = svcWith([
    { tenantId: T, designId: 'd1', designVersion: 'v1', artifactId: 'a1', syncState: 'in_sync' },
  ]);
  const s = await svc.getSyncStatus(T, 'd1');
  assert.equal(s.allInSync, true);
});
