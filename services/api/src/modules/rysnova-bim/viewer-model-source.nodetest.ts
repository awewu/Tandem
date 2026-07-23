import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { ViewerModelSourceEntity } from './viewer-model-source.entity';
import { ViewerModelSourceService } from './viewer-model-source.service';

const user = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  dealerId: 'dealer-1',
  storeId: 'store-1',
  role: 'designer',
} as any;

function svcWith(rows: Partial<ViewerModelSourceEntity>[] = []) {
  const sourceRepo = new InMemoryRepository<any>().seed(...rows.map((row) => ({ ...row })));
  const { ds, repoFor } = makeFakeDataSource([[ViewerModelSourceEntity, sourceRepo]]);
  return { svc: new ViewerModelSourceService(ds), repo: repoFor<any>(ViewerModelSourceEntity) };
}

test('viewer model source creates a tenant-scoped local IFC record without changing draft inputs', async () => {
  const { svc, repo } = svcWith();
  const source = await svc.save(user, {
    draftId: 'draft-1',
    projectId: 'project-1',
    sourceType: 'local-upload',
    uploadReference: { fileName: 'customer-house.ifc', sizeBytes: 1024 },
    loadStatus: 'ready',
    metadata: { meshCount: 8, objectCount: 4 },
    componentSummary: { objects: [{ id: 'ifc-1', type: 'IfcWall', name: 'Wall A' }] },
  });

  assert.equal(repo.rows.length, 1);
  assert.equal(source.tenantId, 'tenant-1');
  assert.equal(source.dealerId, 'dealer-1');
  assert.equal(source.storeId, 'store-1');
  assert.equal(source.projectId, 'project-1');
  assert.equal(source.draftId, 'draft-1');
  assert.equal(source.sourceType, 'local-upload');
  assert.equal(source.modelType, 'ifc');
  assert.equal(source.loadStatus, 'ready');
  assert.equal(source.version, 1);
  assert.equal(source.name, 'customer-house.ifc');
  assert.deepEqual(source.uploadReference, { fileName: 'customer-house.ifc', sizeBytes: 1024 });
});

test('viewer model source accepts imported GLB source without deep object hierarchy', async () => {
  const { svc } = svcWith();
  const source = await svc.save(user, {
    draftId: 'draft-empty-glb',
    sourceType: 'local-upload',
    uploadReference: { fileName: 'empty-mechanical-shell.glb', sizeBytes: 2048 },
    loadStatus: 'ready',
    metadata: { meshCount: 1, objectCount: 0 },
    componentSummary: {},
  });

  assert.equal(source.sourceType, 'local-upload');
  assert.equal(source.modelType, 'glb');
  assert.equal(source.name, 'empty-mechanical-shell.glb');
  assert.equal(source.loadStatus, 'ready');
  assert.deepEqual(source.componentSummary, {});
});

test('viewer model source detects GLB artifact records and updates load status/version', async () => {
  const { svc } = svcWith();
  const first = await svc.save(user, {
    sourceType: 'artifact',
    artifactId: 'artifact-glb-1',
    metadata: { originalName: 'plant-room.glb', mimeType: 'model/gltf-binary' },
    loadStatus: 'loading',
  });
  const second = await svc.save(user, {
    id: first.id,
    sourceType: 'artifact',
    artifactId: 'artifact-glb-1',
    metadata: { originalName: 'plant-room.glb', meshCount: 3, objectCount: 7 },
    componentSummary: { objects: [{ id: 'glb-0', type: 'Mesh', name: 'Heat pump' }] },
    loadStatus: 'ready',
  });

  assert.equal(first.modelType, 'glb');
  assert.equal(second.id, first.id);
  assert.equal(second.modelType, 'glb');
  assert.equal(second.loadStatus, 'ready');
  assert.equal(second.version, 2);
  assert.deepEqual(second.componentSummary, {
    objects: [{ id: 'glb-0', type: 'Mesh', name: 'Heat pump' }],
  });
});

test('viewer model source read is scoped by tenant and dealer/store ownership', async () => {
  const { svc } = svcWith([
    {
      id: 'source-1',
      tenantId: 'tenant-1',
      dealerId: 'dealer-OWNER',
      storeId: 'store-OWNER',
      sourceType: 'artifact',
      modelType: 'ifc',
      artifactId: 'artifact-ifc-1',
      uploadReference: {},
      loadStatus: 'ready',
      metadata: {},
      componentSummary: {},
      version: 1,
    },
  ]);

  await assert.rejects(
    () => svc.get({ ...user, dealerId: 'dealer-INTRUDER', storeId: 'store-INTRUDER' }, 'source-1'),
    /viewer model source not found/
  );
});

test('viewer model source supports create save and reopen workflow', async () => {
  const { svc } = svcWith();
  const created = await svc.save(user, {
    sourceType: 'generated',
    modelType: 'generated',
    name: 'Initial model',
    loadStatus: 'ready',
    metadata: { name: 'Initial model' },
    componentSummary: { objects: [{ id: 'eq-1', type: 'equipment', name: 'Outdoor unit' }] },
  });
  const saved = await svc.save(user, {
    id: created.id,
    name: 'Saved model',
    metadata: { name: 'Saved model', revisionNote: 'designer save' },
    componentSummary: { objects: [{ id: 'eq-1', type: 'equipment', name: 'Outdoor unit A' }] },
  });
  const reopened = await svc.get(user, created.id);

  assert.equal(saved.version, 2);
  assert.equal(reopened.name, 'Saved model');
  assert.equal(reopened.recordStatus, 'active');
  assert.deepEqual(reopened.componentSummary, {
    objects: [{ id: 'eq-1', type: 'equipment', name: 'Outdoor unit A' }],
  });
});

test('viewer model source supports duplicate then rename workflow', async () => {
  const { svc, repo } = svcWith();
  const source = await svc.save(user, {
    sourceType: 'local-upload',
    name: 'Customer IFC',
    uploadReference: { fileName: 'customer.ifc' },
    metadata: { meshCount: 3 },
    loadStatus: 'ready',
  });
  const duplicated = await svc.duplicate(user, source.id, { name: 'Customer IFC alternate' });
  const renamed = await svc.rename(user, duplicated.id, { name: 'Customer IFC final' });

  assert.equal(repo.rows.length, 2);
  assert.notEqual(duplicated.id, source.id);
  assert.equal(duplicated.version, 1);
  assert.equal(duplicated.metadata.duplicatedFromId, source.id);
  assert.equal(renamed.name, 'Customer IFC final');
  assert.equal(renamed.version, 2);
});

test('viewer model source archive remains discoverable for audit-linked records and delete is guarded', async () => {
  const { svc } = svcWith();
  const protectedSource = await svc.save(user, {
    sourceType: 'artifact',
    artifactId: 'artifact-ifc-contract',
    name: 'Contract deliverable model',
    contractId: 'contract-1',
    metadata: { originalName: 'deliverable.ifc', customerSignoffId: 'signoff-1' },
    loadStatus: 'ready',
  });
  const archived = await svc.archive(user, protectedSource.id);
  const listed = await svc.list(user, { projectId: undefined });

  assert.equal(archived.recordStatus, 'archived');
  assert.equal(archived.loadStatus, 'archived');
  assert.equal(
    listed.items.some((item: any) => item.id === protectedSource.id),
    true
  );
  await assert.rejects(
    () => svc.delete(user, protectedSource.id),
    /audit-linked model sources must be archived/
  );
});

test('viewer model source save cannot bypass archive/delete audit endpoints', async () => {
  const { svc } = svcWith();
  const protectedSource = await svc.save(user, {
    sourceType: 'artifact',
    artifactId: 'artifact-signoff-ifc',
    name: 'Signed model',
    contractId: 'contract-1',
    metadata: { originalName: 'signed.ifc', customerSignoffId: 'signoff-1' },
    loadStatus: 'ready',
  });

  await assert.rejects(
    () =>
      svc.save(user, {
        id: protectedSource.id,
        recordStatus: 'deleted',
      }),
    /recordStatus changes must use archive\/delete model source endpoints/
  );
  const reopened = await svc.get(user, protectedSource.id);

  assert.equal(reopened.recordStatus, 'active');
  assert.equal(reopened.deletedAt, null);
});

test('viewer model source delete soft-deletes unprotected records from default discovery', async () => {
  const { svc } = svcWith();
  const source = await svc.save(user, {
    sourceType: 'generated',
    modelType: 'generated',
    name: 'Disposable generated model',
    loadStatus: 'ready',
  });
  const deleted = await svc.delete(user, source.id);
  const listed = await svc.list(user, {});

  assert.equal(deleted.recordStatus, 'deleted');
  assert.equal(
    listed.items.some((item: any) => item.id === source.id),
    false
  );
  await assert.rejects(() => svc.get(user, source.id), /viewer model source not found/);
});
