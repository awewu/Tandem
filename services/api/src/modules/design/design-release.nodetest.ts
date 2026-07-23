import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DesignService } from './design.service';
import { DesignReleaseEntity } from './design.entity';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';

// P0-1 · 设计放行状态机（draft → reviewed → released）· 软闸/免责/越过分支单测。
// 直测真实 DesignService（ds/eventBus 用替身；productCatalog 未用到传 null）。

const T = 'tenant-1';
const USER: any = { tenantId: T, userId: 'u1', role: 'dealer_admin' };

function svcWith(release: Partial<DesignReleaseEntity>) {
  const repo = new InMemoryRepository<any>().seed({ ...release });
  const { ds, repoFor } = makeFakeDataSource([[DesignReleaseEntity, repo]]);
  const events: any[] = [];
  const eventBus: any = { publishInTx: async (_m: any, e: any) => { events.push(e); return e; } };
  const svc = new DesignService(ds, eventBus, null as any);
  return { svc, repo: repoFor<any>(DesignReleaseEntity), events };
}

// ── review：draft → reviewed ─────────────────────────────────────────

test('reviewRelease: draft → reviewed', async () => {
  const { svc, repo } = svcWith({ id: 'r1', tenantId: T, status: 'draft' });
  const res = await svc.reviewRelease(USER, 'r1');
  assert.equal(res.data.status, 'reviewed');
  assert.equal(repo.rows[0].status, 'reviewed');
});

test('reviewRelease: 非 draft → 冲突（仅 draft 可评审）', async () => {
  const { svc } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed' });
  await assert.rejects(() => svc.reviewRelease(USER, 'r1'), /仅 draft 可评审/);
});

// ── release：reviewed → released（含软闸/免责）────────────────────────

test('releaseDesign: 未确认免责声明 → 拒绝', async () => {
  const { svc } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed' });
  await assert.rejects(() => svc.releaseDesign(USER, 'r1', { disclaimerAccepted: false }), /免责声明/);
});

test('releaseDesign: 非 reviewed（draft）→ 冲突（仅 reviewed 可放行）', async () => {
  const { svc } = svcWith({ id: 'r1', tenantId: T, status: 'draft' });
  await assert.rejects(() => svc.releaseDesign(USER, 'r1', { disclaimerAccepted: true }), /仅 reviewed 可放行/);
});

test('releaseDesign: 校验闸拦截且未签字越过 → 冲突', async () => {
  const { svc } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed', gateBlocked: true, overrideSigned: false });
  await assert.rejects(() => svc.releaseDesign(USER, 'r1', { disclaimerAccepted: true }), /校验闸拦截/);
});

test('releaseDesign: reviewed + 免责 → released，并发 design.released 事件（版本锚点=release id）', async () => {
  const { svc, repo, events } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed', projectId: 'proj-9' });
  const res = await svc.releaseDesign(USER, 'r1', { disclaimerAccepted: true });
  assert.equal(res.data.status ?? repo.rows[0].status, 'released');
  assert.equal(repo.rows[0].status, 'released');
  assert.ok(repo.rows[0].releasedAt, '须记录 releasedAt');
  const ev = events.find((e) => e.eventType === 'design.released');
  assert.ok(ev, '须发 design.released');
  assert.equal(ev.payload.releaseId, 'r1', 'releaseId 作为真相源版本锚点');
  assert.equal(ev.payload.designId, 'proj-9');
});

test('releaseDesign: 闸拦截但已签字越过 + 免责 → 放行', async () => {
  const { svc, repo } = svcWith({
    id: 'r1', tenantId: T, status: 'reviewed', projectId: 'proj-9',
    gateBlocked: true, overrideSigned: true,
  });
  await svc.releaseDesign(USER, 'r1', { disclaimerAccepted: true });
  assert.equal(repo.rows[0].status, 'released');
});

// ── signOverride：软闸签字越过 ───────────────────────────────────────

test('signOverride: 未拦截无需越过 → 冲突', async () => {
  const { svc } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed', overrideRequired: false });
  await assert.rejects(() => svc.signOverride(USER, 'r1', '理由'), /无需签字越过/);
});

test('signOverride: 空理由 → 拒绝', async () => {
  const { svc } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed', overrideRequired: true });
  await assert.rejects(() => svc.signOverride(USER, 'r1', '   '), /越过须填写免责理由/);
});

test('signOverride: 有拦截 + 理由 → 记录 overrideSigned', async () => {
  const { svc, repo } = svcWith({ id: 'r1', tenantId: T, status: 'reviewed', overrideRequired: true });
  await svc.signOverride(USER, 'r1', '现场条件已核实，责任自负');
  assert.equal(repo.rows[0].overrideSigned, true);
  assert.equal(repo.rows[0].overrideReason, '现场条件已核实，责任自负');
});
