import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewerSummaryService } from './viewer-summary.service';
import { ViewerDesignSummaryEntity } from './viewer-summary.entity';
import { ViewerDesignDraftEntity } from './viewer-draft.entity';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';

const user = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  dealerId: 'dealer-1',
  storeId: 'store-1',
  role: 'designer',
} as any;

function svcWith(
  summaries: Partial<ViewerDesignSummaryEntity>[] = [],
  drafts: Partial<ViewerDesignDraftEntity>[] = []
) {
  const summaryRepo = new InMemoryRepository<any>().seed(...summaries.map((row) => ({ ...row })));
  const draftRepo = new InMemoryRepository<any>().seed(...drafts.map((row) => ({ ...row })));
  const { ds, repoFor } = makeFakeDataSource([
    [ViewerDesignSummaryEntity, summaryRepo],
    [ViewerDesignDraftEntity, draftRepo],
  ]);
  return {
    svc: new ViewerSummaryService(ds),
    summaries: repoFor<any>(ViewerDesignSummaryEntity),
    drafts: repoFor<any>(ViewerDesignDraftEntity),
  };
}

test('viewer summary save stores calculation, equipment, pipe and compliance snapshots linked to draft version', async () => {
  const { svc, summaries } = svcWith(
    [],
    [
      {
        id: 'draft-1',
        tenantId: 'tenant-1',
        dealerId: 'dealer-1',
        storeId: 'store-1',
        projectId: 'project-1',
        designProjectId: 'design-1',
        bimProjectId: 'bim-1',
        version: 3,
        status: 'draft',
      },
    ]
  );
  const saved = await svc.save(user, {
    draftId: 'draft-1',
    modelId: 'draft-1-generated-hvac-v3',
    modelVersion: 3,
    trustStatus: 'estimate',
    calculationSummary: { coolingLoadKw: 25.2, heatingLoadKw: 17.1, status: 'estimate' },
    equipmentSummary: {
      rows: [{ id: 'cooling-primary', linkedComponentId: 'hvac-v3-cooling-equipment' }],
    },
    pipeSummary: {
      source: 'model',
      totalLengthM: 88,
      linkedComponentIds: ['hvac-v3-cooling-pipe'],
    },
    complianceSummary: {
      state: 'warning',
      checks: [{ key: 'calculation-trust', state: 'warning' }],
    },
  });

  assert.equal(summaries.rows.length, 1);
  assert.equal(saved.tenantId, 'tenant-1');
  assert.equal(saved.dealerId, 'dealer-1');
  assert.equal(saved.storeId, 'store-1');
  assert.equal(saved.draftId, 'draft-1');
  assert.equal(saved.draftVersion, 3);
  assert.equal(saved.projectId, 'project-1');
  assert.equal(saved.designProjectId, 'design-1');
  assert.equal(saved.bimProjectId, 'bim-1');
  assert.deepEqual(saved.calculationSummary, {
    coolingLoadKw: 25.2,
    heatingLoadKw: 17.1,
    status: 'estimate',
  });
  assert.deepEqual(saved.equipmentSummary, {
    rows: [{ id: 'cooling-primary', linkedComponentId: 'hvac-v3-cooling-equipment' }],
  });
});

test('viewer summary latest returns the newest persisted summary for the active draft', async () => {
  const now = Date.now();
  const { svc } = svcWith([
    {
      id: 'summary-old',
      tenantId: 'tenant-1',
      dealerId: 'dealer-1',
      storeId: 'store-1',
      draftId: 'draft-1',
      trustStatus: 'estimate',
      calculationSummary: { coolingLoadKw: 20 },
      equipmentSummary: {},
      pipeSummary: {},
      complianceSummary: {},
      updatedAt: new Date(now - 1000),
    },
    {
      id: 'summary-new',
      tenantId: 'tenant-1',
      dealerId: 'dealer-1',
      storeId: 'store-1',
      draftId: 'draft-1',
      trustStatus: 'verified',
      calculationSummary: { coolingLoadKw: 22 },
      equipmentSummary: {},
      pipeSummary: {},
      complianceSummary: { state: 'passed' },
      updatedAt: new Date(now),
    },
  ]);
  const latest = await svc.latest(user, 'draft-1');

  assert.equal(latest?.id, 'summary-new');
  assert.equal(latest?.trustStatus, 'verified');
  assert.deepEqual(latest?.complianceSummary, { state: 'passed' });
});

test('viewer summary save preserves verified summaries with component-linked equipment and route stats', async () => {
  const { svc } = svcWith(
    [],
    [
      {
        id: 'draft-verified',
        tenantId: 'tenant-1',
        dealerId: 'dealer-1',
        storeId: 'store-1',
        projectId: 'project-verified',
        version: 8,
        status: 'draft',
      },
    ]
  );
  const saved = await svc.save(user, {
    draftId: 'draft-verified',
    modelId: 'model-verified',
    modelVersion: 8,
    trustStatus: 'verified',
    calculationSummary: {
      status: 'verified',
      method: 'approved-v2-calculation',
      areaM2: 260,
      floorCount: 3,
      coolingLoadKw: 31.8,
      heatingLoadKw: 22.4,
    },
    equipmentSummary: {
      status: 'verified',
      rows: [
        {
          id: 'cooling-primary',
          systemKey: 'cooling',
          name: '客厅多联机',
          quantity: 1,
          loadKw: 31.8,
          linkedComponentId: 'cooling-equipment-1',
          dimensions: { length: 1.2, width: 0.9, height: 0.7 },
          businessMetadata: { modelSku: 'VRF-CN-120', capacityKw: 31.8 },
        },
      ],
    },
    pipeSummary: {
      status: 'passed',
      source: 'model',
      routeCount: 2,
      totalLengthM: 88,
      linkedComponentIds: ['pipe-1', 'duct-1'],
      routes: [
        {
          id: 'route-pipe-1',
          name: '冷媒管 DN32',
          systemKey: 'cooling',
          type: 'pipe-route',
          lengthM: 44,
          material: '铜管',
          linkedComponentId: 'pipe-1',
          businessMetadata: { material: '铜管', insulationMm: 25 },
        },
      ],
    },
    complianceSummary: {
      state: 'passed',
      checks: [{ key: 'calculation-trust', state: 'passed' }],
    },
  });

  assert.equal(saved.trustStatus, 'verified');
  assert.equal(saved.draftVersion, 8);
  assert.equal(saved.calculationSummary.method, 'approved-v2-calculation');
  assert.equal((saved.equipmentSummary.rows as any[])[0].linkedComponentId, 'cooling-equipment-1');
  assert.equal((saved.equipmentSummary.rows as any[])[0].name, '客厅多联机');
  assert.deepEqual((saved.equipmentSummary.rows as any[])[0].dimensions, {
    length: 1.2,
    width: 0.9,
    height: 0.7,
  });
  assert.deepEqual(saved.pipeSummary.linkedComponentIds, ['pipe-1', 'duct-1']);
  assert.equal((saved.pipeSummary.routes as any[])[0].name, '冷媒管 DN32');
  assert.equal((saved.pipeSummary.routes as any[])[0].businessMetadata.material, '铜管');
});

test('viewer summary save derives route pipe summary from accepted draft model instead of client quantity', async () => {
  const { svc } = svcWith(
    [],
    [
      {
        id: 'draft-route-derived',
        tenantId: 'tenant-1',
        dealerId: 'dealer-1',
        storeId: 'store-1',
        projectId: 'project-route-derived',
        version: 4,
        status: 'draft',
        generatedModel: {
          id: 'model-route-derived',
          modelVersion: 4,
          components: [
            {
              id: 'pipe-main-derived',
              type: 'pipe-route',
              systemKey: 'cooling',
              name: 'Cooling derived route',
              status: 'active',
              route: {
                points: [
                  { x: 0, y: 1, z: 0 },
                  { x: 3, y: 1, z: 4 },
                  { x: 3, y: 4, z: 4 },
                ],
                size: { diameterMm: 32 },
                crossFloorTransitions: [{ kind: 'riser' }],
              },
              geometry: {
                points: [
                  { x: 0, y: 1, z: 0 },
                  { x: 3, y: 1, z: 4 },
                  { x: 3, y: 4, z: 4 },
                ],
              },
              bomMetadata: { unit: 'm', quantity: 999, estimatedLengthM: 999 },
              businessMetadata: { estimatedLengthM: 999 },
            },
          ],
        },
      },
    ]
  );

  const saved = await svc.save(user, {
    draftId: 'draft-route-derived',
    trustStatus: 'estimate',
    calculationSummary: { status: 'estimate' },
    equipmentSummary: { status: 'estimate', rows: [] },
    pipeSummary: {
      status: 'passed',
      source: 'model',
      routeCount: 99,
      totalLengthM: 999,
      linkedComponentIds: ['client-forged-route'],
      routes: [{ id: 'forged', lengthM: 999, bomMetadata: { quantity: 999 } }],
    },
    complianceSummary: { state: 'pending', checks: [] },
  });

  assert.equal(saved.pipeSummary.routeCount, 1);
  assert.equal(saved.pipeSummary.totalLengthM, 8);
  assert.deepEqual(saved.pipeSummary.linkedComponentIds, ['pipe-main-derived']);
  assert.equal((saved.pipeSummary.routes as any[])[0].lengthM, 8);
  assert.equal((saved.pipeSummary.routes as any[])[0].bomMetadata.quantity, 8);
  assert.equal(saved.pipeSummary.crossFloorRouteCount, 1);
  assert.equal(saved.pipeSummary.crossFloorTransitionCount, 1);
});

test('viewer summary save removes deleted routes from pipe and BOM rollup', async () => {
  const { svc } = svcWith(
    [],
    [
      {
        id: 'draft-route-delete-derived',
        tenantId: 'tenant-1',
        dealerId: 'dealer-1',
        storeId: 'store-1',
        projectId: 'project-route-delete-derived',
        version: 7,
        status: 'draft',
        generatedModel: {
          id: 'model-route-delete-derived',
          modelVersion: 7,
          components: [
            {
              id: 'pipe-active-derived',
              type: 'pipe-route',
              systemKey: 'cooling',
              name: 'Active derived route',
              status: 'active',
              geometry: {
                points: [
                  { x: 0, y: 1, z: 0 },
                  { x: 3, y: 1, z: 4 },
                ],
              },
              bomMetadata: { unit: 'm', quantity: 999, estimatedLengthM: 999 },
              businessMetadata: { estimatedLengthM: 999 },
            },
            {
              id: 'pipe-deleted-derived',
              type: 'pipe-route',
              systemKey: 'cooling',
              name: 'Deleted derived route',
              status: 'deleted',
              geometry: {
                points: [
                  { x: 0, y: 1, z: 0 },
                  { x: 30, y: 1, z: 0 },
                ],
              },
              bomMetadata: { unit: 'm', quantity: 30, estimatedLengthM: 30 },
              businessMetadata: { estimatedLengthM: 30 },
            },
          ],
        },
      },
    ]
  );

  const saved = await svc.save(user, {
    draftId: 'draft-route-delete-derived',
    trustStatus: 'estimate',
    calculationSummary: { status: 'estimate' },
    equipmentSummary: { status: 'estimate', rows: [] },
    pipeSummary: {
      status: 'passed',
      source: 'model',
      routeCount: 2,
      totalLengthM: 999,
      linkedComponentIds: ['pipe-active-derived', 'pipe-deleted-derived'],
    },
    complianceSummary: { state: 'pending', checks: [] },
  });

  assert.equal(saved.pipeSummary.routeCount, 1);
  assert.equal(saved.pipeSummary.totalLengthM, 5);
  assert.deepEqual(saved.pipeSummary.linkedComponentIds, ['pipe-active-derived']);
  assert.equal((saved.pipeSummary.routes as any[])[0].bomMetadata.quantity, 5);
});

test('viewer summary save rejects invalid load equipment pipe and compliance sections', async () => {
  const { svc } = svcWith(
    [],
    [
      {
        id: 'draft-invalid',
        tenantId: 'tenant-1',
        dealerId: 'dealer-1',
        storeId: 'store-1',
        version: 1,
        status: 'draft',
      },
    ]
  );
  const base = {
    draftId: 'draft-invalid',
    trustStatus: 'estimate' as const,
    calculationSummary: { status: 'estimate', coolingLoadKw: 10, heatingLoadKw: 8 },
    equipmentSummary: { status: 'estimate', rows: [] },
    pipeSummary: { status: 'pending', source: 'pending', routeCount: 0, totalLengthM: 0 },
    complianceSummary: { state: 'pending', checks: [] },
  };

  await assert.rejects(
    () =>
      svc.save(user, {
        ...base,
        calculationSummary: { status: 'estimate', coolingLoadKw: -1, heatingLoadKw: 8 },
      }),
    /calculationSummary.coolingLoadKw must be a non-negative number/
  );
  await assert.rejects(
    () => svc.save(user, { ...base, equipmentSummary: { status: 'estimate', rows: {} } }),
    /equipmentSummary.rows must be an array/
  );
  await assert.rejects(
    () => svc.save(user, { ...base, pipeSummary: { status: 'passed', source: 'memory' } }),
    /pipeSummary.source must be model, estimate or pending/
  );
  await assert.rejects(
    () => svc.save(user, { ...base, complianceSummary: { state: 'unknown', checks: [] } }),
    /complianceSummary.state must be pending, warning, failed or passed/
  );
  await assert.rejects(
    () =>
      svc.save(user, {
        ...base,
        trustStatus: 'verified',
        calculationSummary: { status: 'estimate', coolingLoadKw: 10, heatingLoadKw: 8 },
      }),
    /calculationSummary.status must match trustStatus/
  );
});

test('viewer summary read is scoped by tenant and dealer/store ownership', async () => {
  const { svc } = svcWith([
    {
      id: 'summary-1',
      tenantId: 'tenant-1',
      dealerId: 'dealer-OWNER',
      storeId: 'store-OWNER',
      draftId: 'draft-1',
      trustStatus: 'estimate',
      calculationSummary: {},
      equipmentSummary: {},
      pipeSummary: {},
      complianceSummary: {},
    },
  ]);

  await assert.rejects(
    () => svc.get({ ...user, dealerId: 'dealer-INTRUDER', storeId: 'store-INTRUDER' }, 'summary-1'),
    /viewer summary not found/
  );
});
