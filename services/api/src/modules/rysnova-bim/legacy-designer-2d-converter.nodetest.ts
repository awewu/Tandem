import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewerDraftService } from './viewer-draft.service';
import { ViewerDesignDraftEntity } from './viewer-draft.entity';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';

const user = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  dealerId: 'dealer-1',
  storeId: 'store-1',
  role: 'designer',
} as any;

function svcWith(rows: Partial<ViewerDesignDraftEntity>[] = []) {
  const draftRepo = new InMemoryRepository<any>().seed(...rows.map((row) => ({ ...row })));
  const { ds, repoFor } = makeFakeDataSource([[ViewerDesignDraftEntity, draftRepo]]);
  return { svc: new ViewerDraftService(ds), repo: repoFor<any>(ViewerDesignDraftEntity) };
}

test('legacy designer 2D drawing converts to persisted viewer component instances', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectInputs: { name: 'Legacy import placeholder', city: '上海' },
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 3 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });

  const converted = await svc.convertLegacyDesigner2d(user, draft.id, {
    sourceName: 'sample.rh-design.json',
    legacyProject: {
      name: '4001 旧版设计器样例',
      walls: [
        { id: 'wall-a', points: [100, 100, 300, 100, 300, 250] },
      ],
      doors: [{ id: 'door-a', x: 150, y: 100, rotation: 0 }],
      windows: [{ id: 'win-a', x: 300, y: 180, rotation: 90 }],
      texts: [{ id: 'txt-living', x: 190, y: 170, text: '客厅' }],
      devices: [
        { id: 'dev-fcu', type: 'fcu', x: 210, y: 150, rotation: 0 },
        { id: 'dev-ahu', type: 'ahu', x: 260, y: 210, rotation: 90 },
      ],
      pipes: [
        { id: 'pipe-refrig', type: 'refrig', points: [210, 150, 260, 170, 300, 210] },
        { id: 'pipe-duct', type: 'air-duct', points: [260, 210, 300, 240] },
      ],
    },
  });
  const reloaded = await svc.get(user, draft.id);
  const model = reloaded.generatedModel as any;
  const firstWall = model.components.find((item: any) => item.type === 'wall');
  const door = model.components.find((item: any) => item.type === 'door');
  const duct = model.components.find((item: any) => item.type === 'duct-route');

  assert.equal(converted.version, 2);
  assert.equal(model.modelType, 'parametric-hvac');
  assert.equal(model.id, `${draft.id}-legacy-designer-2d-v2`);
  assert.equal(model.componentSummary.byType.wall, 2);
  assert.equal(model.componentSummary.byType.door, 1);
  assert.equal(model.componentSummary.byType.window, 1);
  assert.equal(model.componentSummary.byType['room-zone'], 1);
  assert.equal(model.componentSummary.byType.equipment, 2);
  assert.equal(model.componentSummary.byType['pipe-route'], 1);
  assert.equal(model.componentSummary.byType['duct-route'], 1);
  assert.equal(firstWall.systemKey, 'envelope');
  assert.equal(firstWall.dimensions.height, 3);
  assert.equal(firstWall.dimensions.depth, 0.24);
  assert.equal(firstWall.bomMetadata.bomCategory, 'wall');
  assert.ok(door.businessMetadata.hostWallId);
  assert.equal(duct.systemKey, 'freshAir');
  assert.equal(duct.geometry.kind, 'polyline');
  assert.equal(reloaded.projectInputs.name, '4001 旧版设计器样例');
  assert.equal((reloaded.projectInputs as any).legacyDesigner2dSource.sourceName, 'sample.rh-design.json');
});
