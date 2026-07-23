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

test('viewer draft save creates a tenant-scoped persisted draft snapshot', async () => {
  const { svc, repo } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-1',
    artifactId: 'artifact-1',
    projectInputs: { name: 'Shanghai Villa', city: 'Shanghai' },
    buildingInputs: { area: 260, floors: 3, floorHeight: 3.1, roomCount: 8 },
    systemInputs: { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' },
  });

  assert.equal(repo.rows.length, 1);
  assert.equal(draft.tenantId, 'tenant-1');
  assert.equal(draft.dealerId, 'dealer-1');
  assert.equal(draft.storeId, 'store-1');
  assert.equal(draft.projectId, 'project-1');
  assert.equal(draft.artifactId, 'artifact-1');
  assert.equal(draft.version, 1);
  assert.deepEqual(draft.projectInputs, { name: 'Shanghai Villa', city: 'Shanghai' });
});

test('viewer draft update increments version and read restores project/building/system state', async () => {
  const { svc } = svcWith();
  const first = await svc.save(user, {
    projectInputs: { name: 'Draft A', city: 'Suzhou' },
    buildingInputs: { area: 120, floors: 1, floorHeight: 2.9, roomCount: 4 },
    systemInputs: { coolingSystem: 'Ducted split system', heatingSystem: 'No heating' },
  });
  const second = await svc.save(user, {
    id: first.id,
    artifactId: 'artifact-ifc-2',
    projectInputs: { name: 'Draft B', city: 'Hangzhou' },
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'Air source heat pump', heatingSystem: 'Radiators' },
  });
  const loaded = await svc.get(user, first.id);

  assert.equal(second.version, 2);
  assert.equal(loaded.id, first.id);
  assert.equal(loaded.artifactId, 'artifact-ifc-2');
  assert.deepEqual(loaded.projectInputs, { name: 'Draft B', city: 'Hangzhou' });
  assert.deepEqual(loaded.buildingInputs, { area: 180, floors: 2, floorHeight: 3, roomCount: 6 });
  assert.deepEqual(loaded.systemInputs, { coolingSystem: 'Air source heat pump', heatingSystem: 'Radiators' });
});

test('viewer draft can generate persist reload and select a stable HVAC model component', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-model-1',
    contractId: 'contract-1',
    opportunityId: 'opp-1',
    projectInputs: { name: 'Generated HVAC', city: 'Nanjing' },
    buildingInputs: { area: 240, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' },
  });

  const generated = await svc.generateModel(user, draft.id);
  const loaded = await svc.get(user, draft.id);
  const model = loaded.generatedModel as any;
  const selected = model.components.find((item: any) => item.type === 'equipment' && item.systemKey === 'cooling');

  assert.equal(generated.version, 2);
  assert.equal(model.modelType, 'parametric-hvac');
  assert.equal(model.sourceType, 'generated');
  assert.equal(model.draftId, draft.id);
  assert.equal(model.projectId, 'project-model-1');
  assert.equal(model.modelVersion, 2);
  assert.deepEqual(model.layers.map((item: any) => item.systemKey), ['cooling', 'heating', 'freshAir']);
  assert.equal(model.componentSummary.byType['building-outline'], 1);
  assert.equal(model.componentSummary.byType['room-zone'], 6);
  assert.equal(model.componentSummary.byType.equipment, 3);
  assert.equal(model.componentSummary.byType['pipe-route'], 3);
  assert.equal(model.componentSummary.byStatus.active, model.components.length);
  assert.ok(selected.id.includes('cooling-equipment'));
  assert.equal(selected.draftId, draft.id);
  assert.equal(selected.category, 'equipment');
  assert.equal(selected.status, 'active');
  assert.equal(selected.displayName, selected.name);
  assert.equal(selected.visibility, 'visible');
  assert.equal(selected.locked, false);
  assert.equal(selected.version, 2);
  assert.deepEqual(selected.position, { x: -10.9, y: 0.45, z: -5 });
  assert.equal(selected.dimensions.width, 1.1);
  assert.equal(selected.bomMetadata.bomCategory, 'equipment');
  assert.equal(selected.modelVersion, 2);
  assert.equal(selected.businessMetadata.projectId, 'project-model-1');
  assert.equal(selected.businessMetadata.contractId, 'contract-1');
  assert.equal(selected.businessMetadata.bomCategory, 'equipment');
});

test('viewer draft persists expanded wall equipment and route component instance contract', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-components-1',
    designProjectId: 'design-components-1',
    bimProjectId: 'bim-components-1',
    projectInputs: { name: 'Expanded components', city: 'Shanghai' },
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' },
  });
  await svc.generateModel(user, draft.id);

  const wallSaved = await svc.createComponent(user, draft.id, {
    id: 'wall-living-01',
    type: 'wall',
    category: 'envelope-wall',
    systemKey: 'envelope',
    name: 'Living room wall',
    displayName: '客厅隔墙',
    sourceTemplateId: 'template-wall-standard',
    dimensions: { width: 5.6, height: 3, depth: 0.2 },
    position: { x: 1, y: 1.5, z: -2 },
    rotation: { x: 0, y: 90, z: 0 },
    visibility: 'visible',
    locked: false,
    elevation: 1.5,
    businessMetadata: { wallType: 'partition' },
    bomMetadata: { bomMappable: true, bomCategory: 'wall', quantity: 5.6, unit: 'm' },
    geometry: { kind: 'box', x: 1, y: 1.5, z: -2, width: 5.6, height: 3, depth: 0.2 },
  });
  const equipmentSaved = await svc.createComponent(user, draft.id, {
    id: 'equipment-ahu-01',
    type: 'equipment',
    category: 'hvac-equipment',
    systemKey: 'freshAir',
    name: 'Fresh air AHU',
    displayName: '新风主机',
    dimensions: { width: 1.2, height: 0.8, depth: 0.9 },
    position: { x: 2, y: 0.4, z: 3 },
    rotation: { x: 0, y: 0, z: 0 },
    businessMetadata: { capacityM3h: 350, modelSku: 'FA-350' },
    bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'FA-350' },
    geometry: { kind: 'box', x: 2, y: 0.4, z: 3, width: 1.2, height: 0.8, depth: 0.9 },
  });
  await svc.createComponent(user, draft.id, {
    id: 'pipe-main-01',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: 'Cooling main pipe',
    dimensions: { diameterMm: 32 },
    businessMetadata: { material: 'copper' },
    bomMetadata: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 3, y: 1, z: 4 },
      ],
    },
  });
  await svc.createComponent(user, draft.id, {
    id: 'duct-main-01',
    type: 'duct-route',
    systemKey: 'freshAir',
    name: 'Fresh air duct',
    dimensions: { width: 0.4, height: 0.25 },
    geometry: {
      kind: 'polyline',
      width: 0.4,
      height: 0.25,
      points: [
        { x: 0, y: 2.4, z: 0 },
        { x: 2, y: 2.4, z: 2 },
      ],
    },
  });
  await svc.createComponent(user, draft.id, {
    id: 'door-entry-01',
    type: 'door',
    systemKey: 'envelope',
    name: 'Entry door',
    dimensions: { width: 0.9, height: 2.1, depth: 0.08 },
    position: { x: -1, y: 1.05, z: -2 },
    geometry: { kind: 'box', x: -1, y: 1.05, z: -2, width: 0.9, height: 2.1, depth: 0.08 },
  });
  await svc.createComponent(user, draft.id, {
    id: 'window-living-01',
    type: 'window',
    systemKey: 'envelope',
    name: 'Living room window',
    dimensions: { width: 1.6, height: 1.2, depth: 0.06 },
    position: { x: 3, y: 1.6, z: -2 },
    geometry: { kind: 'box', x: 3, y: 1.6, z: -2, width: 1.6, height: 1.2, depth: 0.06 },
  });

  const wallModel = wallSaved.generatedModel as any;
  const wall = wallModel.components.find((item: any) => item.id === 'wall-living-01');
  const equipmentModel = equipmentSaved.generatedModel as any;
  const equipment = equipmentModel.components.find((item: any) => item.id === 'equipment-ahu-01');

  assert.equal(wall.draftId, draft.id);
  assert.ok(wall.modelId.includes(draft.id));
  assert.equal(wall.type, 'wall');
  assert.equal(wall.category, 'envelope-wall');
  assert.equal(wall.displayName, '客厅隔墙');
  assert.deepEqual(wall.dimensions, { width: 5.6, height: 3, depth: 0.2 });
  assert.deepEqual(wall.position, { x: 1, y: 1.5, z: -2 });
  assert.deepEqual(wall.rotation, { x: 0, y: 90, z: 0 });
  assert.equal(wall.visibility, 'visible');
  assert.equal(wall.locked, false);
  assert.equal(wall.elevation, 1.5);
  assert.equal(wall.status, 'active');
  assert.equal(wall.bomMetadata.bomCategory, 'wall');
  assert.equal(equipment.bomMetadata.bomSkuHint, 'FA-350');

  const updated = await svc.updateComponent(user, draft.id, 'wall-living-01', {
    dimensions: { width: 6.2, height: 3, depth: 0.2 },
    position: { x: 1.5, y: 1.5, z: -2 },
    rotation: { x: 0, y: 45, z: 0 },
    visibility: 'hidden',
    lockState: 'locked',
    geometry: { kind: 'box', x: 1.5, y: 1.5, z: -2, width: 6.2, height: 3, depth: 0.2 },
  });
  const deleted = await svc.deleteComponent(user, draft.id, 'equipment-ahu-01');
  const reopened = await svc.get(user, draft.id);
  const reopenedModel = reopened.generatedModel as any;
  const reopenedWall = reopenedModel.components.find((item: any) => item.id === 'wall-living-01');

  assert.equal(updated.version, 9);
  assert.equal(deleted.generatedModel.componentSummary.byType.equipment, 3);
  assert.equal(reopenedWall.dimensions.width, 6.2);
  assert.equal(reopenedWall.rotation.y, 45);
  assert.equal(reopenedWall.displayName, '客厅隔墙');
  assert.equal(reopenedWall.visibility, 'hidden');
  assert.equal(reopenedWall.locked, true);
  assert.equal(reopenedModel.components.some((item: any) => item.id === 'equipment-ahu-01'), false);
  assert.equal(reopenedModel.componentSummary.byType.wall, 1);
  assert.equal(reopenedModel.componentSummary.byType.door, 1);
  assert.equal(reopenedModel.componentSummary.byType.window, 1);
  assert.equal(reopenedModel.componentSummary.byType['pipe-route'], 4);
  assert.equal(reopenedModel.componentSummary.byType['duct-route'], 1);
});

test('viewer draft supports persisted generated-model component CRUD', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectInputs: { name: 'Editable HVAC', city: 'Shanghai' },
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' },
  });
  const generated = await svc.generateModel(user, draft.id);
  const initialModel = generated.generatedModel as any;
  const initialComponentCount = initialModel.components.length;
  const initialRouteLength = initialModel.componentSummary.routeSummary.totalLengthM;

  const created = await svc.createComponent(user, draft.id, {
    id: 'manual-cooling-pipe-01',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: 'Manual cooling pipe',
    businessMetadata: {
      bomMappable: true,
      bomCategory: 'pipe-route',
      estimatedLengthM: 12,
    },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: -1, y: 1, z: -1 },
        { x: 2, y: 1, z: 2 },
      ],
    },
  });
  const createdModel = created.generatedModel as any;

  assert.equal(created.version, 3);
  assert.equal(createdModel.components.length, initialComponentCount + 1);
  assert.equal(createdModel.componentSummary.byType['pipe-route'], 4);
  assert.ok(createdModel.componentSummary.bomMappableComponentIds.includes('manual-cooling-pipe-01'));
  assert.equal(createdModel.components.find((item: any) => item.id === 'manual-cooling-pipe-01').status, 'active');

  const updated = await svc.updateComponent(user, draft.id, 'manual-cooling-pipe-01', {
    type: 'pipe-route',
    systemKey: 'heating',
    name: 'Manual heating pipe',
    businessMetadata: {
      bomMappable: true,
      bomCategory: 'pipe-route',
      estimatedLengthM: 18,
    },
    geometry: {
      kind: 'polyline',
      diameterMm: 25,
      points: [
        { x: 0, y: 1.1, z: 0 },
        { x: 4, y: 1.1, z: 2 },
      ],
    },
  });
  const updatedModel = updated.generatedModel as any;
  const edited = updatedModel.components.find((item: any) => item.id === 'manual-cooling-pipe-01');

  assert.equal(updated.version, 4);
  assert.equal(edited.systemKey, 'heating');
  assert.equal(edited.name, 'Manual heating pipe');
  assert.equal(edited.businessMetadata.estimatedLengthM, 4.47);
  assert.equal(edited.dimensions.estimatedLengthM, 4.47);
  assert.equal(edited.bomMetadata.quantity, 4.47);
  assert.ok(updatedModel.layers.find((item: any) => item.systemKey === 'heating').componentIds.includes(edited.id));

  const deleted = await svc.deleteComponent(user, draft.id, 'manual-cooling-pipe-01');
  const deletedModel = deleted.generatedModel as any;

  assert.equal(deleted.version, 5);
  assert.equal(deletedModel.components.length, initialComponentCount);
  assert.equal(deletedModel.componentSummary.byType['pipe-route'], 3);
  assert.equal(deletedModel.componentSummary.routeSummary.totalLengthM, initialRouteLength);
  assert.equal(deletedModel.components.some((item: any) => item.id === 'manual-cooling-pipe-01'), false);
});

test('viewer draft persists catalog placements with edited defaults and Chinese display names', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectInputs: { name: 'Tool Palette Placement', city: 'Shanghai' },
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' },
  });
  await svc.generateModel(user, draft.id);

  await svc.createComponent(user, draft.id, {
    id: 'placed-window-edited-01',
    type: 'window',
    category: 'window',
    systemKey: 'envelope',
    name: '主卧窗 1800mm',
    displayName: '主卧窗 1800mm',
    sourceTemplateId: 'window-standard-1500',
    dimensions: {
      width: 1.8,
      height: 1.35,
      depth: 0.14,
      widthM: 1.8,
      heightM: 1.35,
      thicknessMm: 140,
    },
    geometry: { kind: 'box', x: 1, y: 0.68, z: 2, width: 1.8, height: 1.35, depth: 0.14 },
    position: { x: 1, y: 0.68, z: 2 },
    businessMetadata: {
      bomMappable: true,
      bomCategory: 'window',
      bomSkuHint: 'WINDOW_STANDARD_1500',
      openingDirection: 'sliding',
      sillHeightM: 0.85,
      templateDefaultOverrides: {
        displayName: '主卧窗 1800mm',
        widthM: 1.8,
        heightM: 1.35,
        thicknessMm: 140,
        openingDirection: 'sliding',
        sillHeightM: 0.85,
      },
    },
    bomMetadata: {
      bomMappable: true,
      bomCategory: 'window',
      bomSkuHint: 'WINDOW_STANDARD_1500',
      quantity: 1,
      unit: 'set',
    },
  });

  await svc.createComponent(user, draft.id, {
    id: 'placed-pipe-edited-01',
    type: 'pipe-route',
    category: 'pipe',
    systemKey: 'cooling',
    name: '冷媒管 DN22',
    displayName: '冷媒管 DN22',
    sourceTemplateId: 'refrigerant-pipe-pair',
    dimensions: { diameterMm: 22, estimatedLengthM: 12, insulationMm: 25 },
    geometry: {
      kind: 'polyline',
      diameterMm: 22,
      points: [
        { x: 0, y: 0.95, z: 0 },
        { x: 12, y: 0.95, z: 0 },
      ],
    },
    businessMetadata: {
      bomMappable: true,
      bomCategory: 'pipe',
      bomSkuHint: 'REFRIGERANT_PIPE_PAIR',
      material: 'copper',
      insulationMm: 25,
      estimatedLengthM: 12,
    },
    bomMetadata: {
      bomMappable: true,
      bomCategory: 'pipe',
      bomSkuHint: 'REFRIGERANT_PIPE_PAIR',
      quantity: 12,
      unit: 'm',
    },
  });

  const reopened = await svc.get(user, draft.id);
  const model = reopened.generatedModel as any;
  const window = model.components.find((item: any) => item.id === 'placed-window-edited-01');
  const pipe = model.components.find((item: any) => item.id === 'placed-pipe-edited-01');

  assert.equal(window.displayName, '主卧窗 1800mm');
  assert.equal(window.visibility, 'visible');
  assert.equal(window.locked, false);
  assert.equal(window.dimensions.width, 1.8);
  assert.equal(window.dimensions.depth, 0.14);
  assert.equal(window.businessMetadata.openingDirection, 'sliding');
  assert.equal(window.businessMetadata.sillHeightM, 0.85);
  assert.equal(window.bomMetadata.bomSkuHint, 'WINDOW_STANDARD_1500');
  assert.equal(pipe.displayName, '冷媒管 DN22');
  assert.equal(pipe.geometry.diameterMm, 22);
  assert.equal(pipe.businessMetadata.material, 'copper');
  assert.equal(pipe.bomMetadata.quantity, 12);
  assert.ok(model.componentSummary.bomMappableComponentIds.includes('placed-window-edited-01'));
  assert.ok(model.componentSummary.bomMappableComponentIds.includes('placed-pipe-edited-01'));
});

test('viewer draft persists floor elevation and install height on component instances', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectInputs: { name: 'Elevated HVAC', city: 'Shanghai' },
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' },
  });
  await svc.generateModel(user, draft.id);

  await svc.createComponent(user, draft.id, {
    id: 'equipment-ceiling-ahu-01',
    type: 'equipment',
    category: 'hvac-equipment',
    systemKey: 'freshAir',
    name: 'Second floor ceiling AHU',
    floor: 2,
    elevation: 3.45,
    installHeight: 0.45,
    dimensions: { width: 1.2, height: 0.8, depth: 0.9 },
    position: { x: 2, y: 0.4, z: 3 },
    businessMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'FA-350' },
    bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'FA-350' },
    geometry: { kind: 'box', x: 2, y: 0.4, z: 3, width: 1.2, height: 0.8, depth: 0.9 },
  });

  const reopened = await svc.get(user, draft.id);
  const model = reopened.generatedModel as any;
  const equipment = model.components.find((item: any) => item.id === 'equipment-ceiling-ahu-01');

  assert.equal(equipment.floor, 2);
  assert.equal(equipment.elevation, 3.45);
  assert.equal(equipment.installHeight, 0.45);
  assert.equal(equipment.position.y, 3.45);
  assert.equal(equipment.geometry.y, 3.45);
  assert.equal(equipment.businessMetadata.floor, 2);
  assert.equal(equipment.businessMetadata.installHeight, 0.45);
  assert.ok(model.componentSummary.bomMappableComponentIds.includes('equipment-ceiling-ahu-01'));
});

test('viewer draft persists accepted logical route shape with floors transitions and backend summary', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-route-1',
    designProjectId: 'design-route-1',
    bimProjectId: 'bim-route-1',
    buildingInputs: { area: 180, floors: 3, floorHeight: 3.2, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);

  await svc.createComponent(user, draft.id, {
    id: 'logical-route-main-01',
    type: 'pipe-route',
    systemKey: 'water',
    name: 'Cross floor water route',
    visibility: 'hidden',
    lockState: 'unlocked',
    dimensions: { diameterMm: 32, estimatedLengthM: 999, insulationMm: 25 },
    businessMetadata: { projectId: 'project-route-1', material: 'ppr', insulationMm: 25 },
    bomMetadata: { bomMappable: true, bomCategory: 'pipe-route', bomSkuHint: 'PPR-DN32', unit: 'm', quantity: 999 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0.123456, y: 1.234567, z: 0.345678 },
        { x: 2.123456, y: 1.234567, z: 0.345678 },
        { x: 2.123456, y: 4.434567, z: 0.345678 },
        { x: 4.123456, y: 4.434567, z: 2.345678 },
      ],
    },
    route: {
      projectId: 'project-route-1',
      floors: [
        { floor: 1, floorId: 'F1', pointIndexes: [0, 1] },
        { floor: 2, floorId: 'F2', pointIndexes: [2, 3] },
      ],
      crossFloorTransitions: [
        { kind: 'riser', fromFloor: 1, toFloor: 2, startPointIndex: 1, endPointIndex: 2 },
      ],
      size: { diameterMm: 32 },
      material: 'ppr',
      insulation: { thicknessMm: 25, material: 'rubber' },
      bendRadius: { radiusMm: 450 },
      endpointRefs: {
        from: { refType: 'equipment', refId: 'pump-01', portKey: 'outlet' },
        to: { refType: 'zone', refId: 'bathroom-02', portKey: 'supply' },
      },
      bomMapping: { bomMappable: true, bomCategory: 'pipe-route', bomSkuHint: 'PPR-DN32', unit: 'm', quantity: 999 },
      summary: { totalLengthM: 999 },
    },
  });

  const reopened = await svc.get(user, draft.id);
  const model = reopened.generatedModel as any;
  const route = model.components.find((item: any) => item.id === 'logical-route-main-01');

  assert.equal(route.visibility, 'hidden');
  assert.equal(route.locked, false);
  assert.equal(route.route.kind, 'logical-route');
  assert.deepEqual(route.route.coordinateSystem, {
    planeAxes: ['x', 'z'],
    elevationAxis: 'y',
    ySemantics: 'absolute-model-elevation-m',
  });
  assert.deepEqual(route.route.points[0], { x: 0.123456, y: 1.234567, z: 0.345678 });
  assert.equal(route.route.floors.length, 2);
  assert.equal(route.route.floors[0].floorId, 'F1');
  assert.deepEqual(route.route.crossFloorTransitions[0], {
    kind: 'riser',
    fromFloor: 1,
    toFloor: 2,
    startPointIndex: 1,
    endPointIndex: 2,
  });
  assert.equal(route.route.size.diameterMm, 32);
  assert.equal(route.route.material, 'ppr');
  assert.equal(route.route.insulation.thicknessMm, 25);
  assert.equal(route.route.bendRadius.radiusM, 0.45);
  assert.equal(route.route.endpointRefs.from.refId, 'pump-01');
  assert.equal(route.route.summary.totalLengthM, 7.64);
  assert.equal(route.dimensions.estimatedLengthM, 7.64);
  assert.equal(route.bomMetadata.estimatedLengthM, 7.64);
  assert.equal(route.bomMetadata.quantity, 7.64);
  assert.equal(model.componentSummary.routeSummary.totalLengthM >= 7.64, true);

  await svc.updateComponent(user, draft.id, 'logical-route-main-01', {
    locked: false,
    lockState: 'unlocked',
    geometry: {
      kind: 'polyline',
      diameterMm: 40,
      points: [
        { x: 0.123456, y: 1.234567, z: 0.345678 },
        { x: 3.123456, y: 1.234567, z: 0.345678 },
        { x: 3.123456, y: 4.434567, z: 0.345678 },
      ],
    },
    route: {
      floors: [1, 2],
      crossFloorTransitions: [
        { fromFloor: 1, toFloor: 2, startPointIndex: 1, endPointIndex: 2 },
      ],
      size: { diameterMm: 40 },
      material: 'ppr',
      bomMapping: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    },
  });
  const updated = await svc.get(user, draft.id);
  const updatedRoute = (updated.generatedModel as any).components.find((item: any) => item.id === 'logical-route-main-01');

  assert.equal(updatedRoute.route.size.diameterMm, 40);
  assert.deepEqual(updatedRoute.route.points[1], { x: 3.123456, y: 1.234567, z: 0.345678 });
  assert.equal(updatedRoute.route.summary.totalLengthM, 6.2);
  assert.equal(updatedRoute.dimensions.estimatedLengthM, 6.2);
  assert.equal(updatedRoute.businessMetadata.estimatedLengthM, 6.2);
  assert.equal(updatedRoute.bomMetadata.quantity, 6.2);
  assert.equal((updated.generatedModel as any).componentSummary.routeSummary.totalLengthM >= 6.2, true);
});

test('viewer draft addRiser appends a vertical segment to the same logical route', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-riser-1',
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);
  await svc.createComponent(user, draft.id, {
    id: 'logical-route-riser-01',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: 'Second floor active route',
    floor: 2,
    elevation: 3.95,
    installHeight: 0.95,
    dimensions: { diameterMm: 32 },
    businessMetadata: { material: 'copper', installHeight: 0.95 },
    bomMetadata: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: -2, y: 3.95, z: 1 },
        { x: 0, y: 3.95, z: 1 },
      ],
    },
    route: { floors: [2], size: { diameterMm: 32 }, bomMapping: { bomMappable: true, unit: 'm' } },
  });

  const saved = await svc.addRiser(user, draft.id, 'logical-route-riser-01', {
    sourceFloor: 2,
    targetFloor: 1,
    point: { x: 1.25, z: -0.5 },
  });
  const route = (saved.generatedModel as any).components.find((item: any) => item.id === 'logical-route-riser-01');
  const points = route.geometry.points;
  const transition = route.route.crossFloorTransitions[0];

  assert.equal(route.id, 'logical-route-riser-01');
  assert.equal(route.floor, 1);
  assert.equal(route.elevation, 0.95);
  assert.deepEqual(points.slice(0, 2), [
    { x: -2, y: 3.95, z: 1 },
    { x: 0, y: 3.95, z: 1 },
  ]);
  assert.deepEqual(points.slice(-2), [
    { x: 1.25, y: 3.95, z: -0.5 },
    { x: 1.25, y: 0.95, z: -0.5 },
  ]);
  assert.equal(transition.kind, 'riser');
  assert.equal(transition.fromFloor, 2);
  assert.equal(transition.toFloor, 1);
  assert.equal(transition.sourceFloorId, 'floor-2');
  assert.equal(transition.targetFloorId, 'floor-1');
  assert.equal(transition.sourceElevation, 3.95);
  assert.equal(transition.targetElevation, 0.95);
  assert.equal(transition.x, 1.25);
  assert.equal(transition.z, -0.5);
  assert.equal(transition.installHeight, 0.95);
  assert.equal(route.route.summary.transitionCount, 1);
  assert.equal(route.route.summary.floorCount, 2);
  assert.equal(route.businessMetadata.routeContinuationFloor, 1);
});

test('viewer draft addRiser rejects invalid floors coordinates locked and non-route components', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);
  await svc.createComponent(user, draft.id, {
    id: 'logical-route-riser-reject',
    type: 'pipe-route',
    systemKey: 'cooling',
    floor: 2,
    elevation: 3.95,
    installHeight: 0.95,
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: -2, y: 3.95, z: 1 },
        { x: 0, y: 3.95, z: 1 },
      ],
    },
    route: { floors: [2], size: { diameterMm: 32 } },
  });
  await svc.createComponent(user, draft.id, {
    id: 'locked-route-riser-reject',
    type: 'pipe-route',
    systemKey: 'cooling',
    lockState: 'locked',
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 0.95, z: 0 },
        { x: 1, y: 0.95, z: 0 },
      ],
    },
    route: { floors: [1], size: { diameterMm: 32 } },
  });
  await svc.createComponent(user, draft.id, {
    id: 'equipment-riser-reject',
    type: 'equipment',
    systemKey: 'cooling',
    geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
  });

  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'logical-route-riser-reject', {
        sourceFloor: 2,
        targetFloor: 2,
        point: { x: 1, z: 1 },
      }),
    /riser target floor must be different/
  );
  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'logical-route-riser-reject', {
        sourceFloor: 2,
        targetFloor: 3,
        point: { x: 1, z: 1 },
      }),
    /riser.targetFloor must reference an existing floor/
  );
  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'logical-route-riser-reject', {
        sourceFloor: 2,
        targetFloor: 1,
        point: { x: Number.POSITIVE_INFINITY, z: 1 },
      }),
    /riser.point.x must be a number/
  );
  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'logical-route-riser-reject', {
        sourceFloor: 2,
        targetFloor: 1,
        point: { x: 1, y: -1, z: 1 },
      }),
    /riser.point.y must be between 0 and 200 meters/
  );
  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'logical-route-riser-reject', {
        sourceFloor: 2,
        targetFloor: 1,
        point: { x: 1, z: 1 },
        sourceElevation: 4.2,
      }),
    /riser.sourceElevation must match derived/
  );
  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'locked-route-riser-reject', {
        sourceFloor: 1,
        targetFloor: 2,
        point: { x: 1, z: 1 },
      }),
    /locked route cannot add riser/
  );
  await assert.rejects(
    () =>
      svc.addRiser(user, draft.id, 'equipment-riser-reject', {
        sourceFloor: 1,
        targetFloor: 2,
        point: { x: 1, z: 1 },
      }),
    /riser can only be added to route components/
  );
});

test('viewer draft rejects locked and protected route update and delete mutations', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 180, floors: 1, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);
  await svc.createComponent(user, draft.id, {
    id: 'locked-route-mutation-reject',
    type: 'pipe-route',
    systemKey: 'cooling',
    lockState: 'locked',
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 0.95, z: 0 },
        { x: 2, y: 0.95, z: 0 },
      ],
    },
    route: { floors: [1], size: { diameterMm: 32 } },
  });
  await svc.createComponent(user, draft.id, {
    id: 'protected-route-mutation-reject',
    type: 'pipe-route',
    systemKey: 'cooling',
    dimensions: { diameterMm: 32 },
    businessMetadata: { protectedGeometry: true },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 0.95, z: 1 },
        { x: 2, y: 0.95, z: 1 },
      ],
    },
    route: { floors: [1], size: { diameterMm: 32 } },
  });

  await assert.rejects(
    () =>
      svc.updateComponent(user, draft.id, 'locked-route-mutation-reject', {
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 0.95, z: 0 },
            { x: 4, y: 0.95, z: 0 },
          ],
        },
      }),
    /locked route cannot update route/
  );
  await assert.rejects(
    () => svc.deleteComponent(user, draft.id, 'locked-route-mutation-reject'),
    /locked route cannot delete route/
  );
  await assert.rejects(
    () =>
      svc.updateComponent(user, draft.id, 'protected-route-mutation-reject', {
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 0.95, z: 1 },
            { x: 4, y: 0.95, z: 1 },
          ],
        },
      }),
    /protected route cannot update route/
  );
  await assert.rejects(
    () => svc.deleteComponent(user, draft.id, 'protected-route-mutation-reject'),
    /protected route cannot delete route/
  );

  const model = (await svc.get(user, draft.id)).generatedModel as any;
  const lockedRoute = model.components.find((item: any) => item.id === 'locked-route-mutation-reject');
  const protectedRoute = model.components.find((item: any) => item.id === 'protected-route-mutation-reject');

  assert.equal(lockedRoute.route.summary.totalLengthM, 2);
  assert.equal(protectedRoute.route.summary.totalLengthM, 2);
  assert.equal(lockedRoute.bomMetadata.quantity, 2);
  assert.equal(protectedRoute.bomMetadata.quantity, 2);
});

test('viewer draft building floor level change marks existing routes stale without moving points', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 180, floors: 2, floorHeight: 3, roomCount: 6 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);
  await svc.createComponent(user, draft.id, {
    id: 'route-floor-level-stale-01',
    type: 'pipe-route',
    systemKey: 'cooling',
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 3.95, z: 0 },
        { x: 1, y: 3.95, z: 0 },
      ],
    },
    route: { floors: [2], size: { diameterMm: 32 } },
  });

  const updated = await svc.save(user, {
    id: draft.id,
    buildingInputs: { area: 180, floors: 2, floorHeight: 3.2, roomCount: 6 },
  });
  const route = (updated.generatedModel as any).components.find((item: any) => item.id === 'route-floor-level-stale-01');

  assert.deepEqual(route.geometry.points, [
    { x: 0, y: 3.95, z: 0 },
    { x: 1, y: 3.95, z: 0 },
  ]);
  assert.equal(route.businessMetadata.floorLevelReviewStatus, 'stale');
  assert.equal(route.businessMetadata.floorLevelReviewReason, 'building-floor-level-data-changed');
});

test('viewer draft persists equipment endpoint refs and follows moved connected equipment', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);

  await svc.createComponent(user, draft.id, {
    id: 'equipment-a',
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Equipment A',
    elevation: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 1, z: 0 },
    geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
    businessMetadata: {
      connectors: [
        {
          id: 'liquid-out',
          systemKey: 'cooling',
          routeType: 'pipe-route',
          offset: { x: 0.5, y: 0, z: 0 },
        },
      ],
    },
  });
  await svc.createComponent(user, draft.id, {
    id: 'equipment-b',
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Equipment B',
    elevation: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 5, y: 1, z: 0 },
    geometry: { kind: 'box', x: 5, y: 1, z: 0, width: 1, height: 1, depth: 1 },
  });
  await svc.createComponent(user, draft.id, {
    id: 'pipe-a-b',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: 'A to B pipe',
    dimensions: { diameterMm: 32 },
    bomMetadata: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0.5, y: 1, z: 0 },
        { x: 5, y: 1, z: 0 },
      ],
    },
    route: {
      floors: [1],
      size: { diameterMm: 32 },
      endpointRefs: {
        from: {
          equipmentId: 'equipment-a',
          attachmentKind: 'connector',
          attachmentId: 'liquid-out',
          status: 'connected',
        },
        to: {
          equipmentId: 'equipment-b',
          attachmentKind: 'anchor',
          attachmentId: 'equipment-anchor:center',
          status: 'connected',
          fallbackReason: 'equipment has no connector metadata; using persisted equipment anchor',
        },
      },
      bomMapping: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    },
  });

  const moved = await svc.updateComponent(user, draft.id, 'equipment-b', {
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Equipment B',
    elevation: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 7, y: 1, z: 0 },
    geometry: { kind: 'box', x: 7, y: 1, z: 0, width: 1, height: 1, depth: 1 },
  });
  const model = moved.generatedModel as any;
  const route = model.components.find((item: any) => item.id === 'pipe-a-b');

  assert.deepEqual(route.geometry.points, [
    { x: 0.5, y: 1, z: 0 },
    { x: 7, y: 1, z: 0 },
  ]);
  assert.equal(route.route.endpointRefs.from.endpointRole, 'source');
  assert.equal(route.route.endpointRefs.from.equipmentId, 'equipment-a');
  assert.equal(route.route.endpointRefs.from.attachmentKind, 'connector');
  assert.equal(route.route.endpointRefs.to.endpointRole, 'target');
  assert.equal(route.route.endpointRefs.to.status, 'connected');
  assert.equal(route.route.summary.totalLengthM, 6.5);
  assert.equal(route.dimensions.estimatedLengthM, 6.5);
  assert.equal(route.businessMetadata.estimatedLengthM, 6.5);
  assert.equal(route.bomMetadata.quantity, 6.5);
  assert.equal(model.componentSummary.routeSummary.totalLengthM >= 6.5, true);
  assert.equal(route.id, 'pipe-a-b');
});

test('viewer draft reload restores one cross-floor logical route with endpoint refs and derived BOM', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-cross-floor-reload',
    buildingInputs: { area: 120, floors: 2, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);

  await svc.createComponent(user, draft.id, {
    id: 'equipment-second-floor',
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Second floor unit',
    floor: 2,
    elevation: 3.95,
    installHeight: 0.95,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 3.95, z: 0 },
    geometry: { kind: 'box', x: 0, y: 3.95, z: 0, width: 1, height: 1, depth: 1 },
    businessMetadata: {
      connectors: [
        {
          id: 'liquid-out',
          systemKey: 'cooling',
          routeType: 'pipe-route',
          offset: { x: 0.5, y: 0, z: 0 },
        },
      ],
    },
  });
  await svc.createComponent(user, draft.id, {
    id: 'equipment-first-floor',
    type: 'equipment',
    systemKey: 'cooling',
    name: 'First floor unit',
    floor: 1,
    elevation: 0.95,
    installHeight: 0.95,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 6, y: 0.95, z: 0 },
    geometry: { kind: 'box', x: 6, y: 0.95, z: 0, width: 1, height: 1, depth: 1 },
  });
  await svc.createComponent(user, draft.id, {
    id: 'cross-floor-pipe-one-route',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: '2F to 1F cooling pipe',
    floor: 2,
    elevation: 3.95,
    installHeight: 0.95,
    visibility: 'visible',
    locked: false,
    dimensions: { diameterMm: 32, estimatedLengthM: 999 },
    businessMetadata: { material: 'copper', bomMappable: true, bomCategory: 'pipe-route' },
    bomMetadata: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm', quantity: 999 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0.5, y: 3.95, z: 0 },
        { x: 3, y: 3.95, z: 0 },
        { x: 3, y: 0.95, z: 0 },
        { x: 6, y: 0.95, z: 0 },
      ],
    },
    route: {
      floors: [2, 1],
      crossFloorTransitions: [
        {
          kind: 'riser',
          fromFloor: 2,
          toFloor: 1,
          startPointIndex: 1,
          endPointIndex: 2,
          sourceFloorId: 'floor-2',
          targetFloorId: 'floor-1',
          sourceElevation: 3.95,
          targetElevation: 0.95,
          x: 3,
          z: 0,
          installHeight: 0.95,
        },
      ],
      size: { diameterMm: 32 },
      material: 'copper',
      endpointRefs: {
        from: {
          equipmentId: 'equipment-second-floor',
          attachmentKind: 'connector',
          attachmentId: 'liquid-out',
          status: 'connected',
        },
        to: {
          equipmentId: 'equipment-first-floor',
          attachmentKind: 'anchor',
          attachmentId: 'equipment-anchor:center',
          status: 'connected',
        },
      },
      bomMapping: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    },
  });

  const reopened = await svc.get(user, draft.id);
  const model = reopened.generatedModel as any;
  const routes = model.components.filter((item: any) => item.id === 'cross-floor-pipe-one-route');
  const route = routes[0];

  assert.equal(routes.length, 1);
  assert.equal(route.id, 'cross-floor-pipe-one-route');
  assert.equal(route.systemKey, 'cooling');
  assert.equal(route.visibility, 'visible');
  assert.equal(route.locked, false);
  assert.deepEqual(route.geometry.points, [
    { x: 0.5, y: 3.95, z: 0 },
    { x: 3, y: 3.95, z: 0 },
    { x: 3, y: 0.95, z: 0 },
    { x: 6, y: 0.95, z: 0 },
  ]);
  assert.deepEqual(route.route.points, route.geometry.points);
  assert.deepEqual(route.route.floors.map((floor: any) => floor.floor), [2, 1]);
  assert.deepEqual(route.route.floors[0].pointIndexes, [0, 1]);
  assert.deepEqual(route.route.floors[1].pointIndexes, [2, 3]);
  assert.equal(route.route.crossFloorTransitions.length, 1);
  assert.equal(route.route.crossFloorTransitions[0].fromFloor, 2);
  assert.equal(route.route.crossFloorTransitions[0].toFloor, 1);
  assert.equal(route.route.size.diameterMm, 32);
  assert.equal(route.route.endpointRefs.from.equipmentId, 'equipment-second-floor');
  assert.equal(route.route.endpointRefs.from.status, 'connected');
  assert.deepEqual(route.route.endpointRefs.from.point, { x: 0.5, y: 3.95, z: 0 });
  assert.equal(route.route.endpointRefs.to.equipmentId, 'equipment-first-floor');
  assert.equal(route.route.endpointRefs.to.status, 'connected');
  assert.equal(route.route.summary.totalLengthM, 8.5);
  assert.equal(route.dimensions.estimatedLengthM, 8.5);
  assert.equal(route.bomMetadata.quantity, 8.5);
  assert.equal(model.componentSummary.routeSummary.crossFloorRouteCount, 1);
  assert.equal(model.componentSummary.routeSummary.crossFloorTransitionCount, 1);
});

test('viewer draft reload marks endpoint stale when connected equipment is missing', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);
  await svc.createComponent(user, draft.id, {
    id: 'equipment-stale-target',
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Stale target',
    elevation: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 4, y: 1, z: 0 },
    geometry: { kind: 'box', x: 4, y: 1, z: 0, width: 1, height: 1, depth: 1 },
  });
  await svc.createComponent(user, draft.id, {
    id: 'pipe-missing-equipment-stale',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: 'Missing equipment route',
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 4, y: 1, z: 0 },
      ],
    },
    route: {
      floors: [1],
      size: { diameterMm: 32 },
      endpointRefs: {
        to: {
          equipmentId: 'equipment-stale-target',
          attachmentKind: 'anchor',
          attachmentId: 'equipment-anchor:center',
          status: 'connected',
        },
      },
      bomMapping: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    },
  });

  await svc.deleteComponent(user, draft.id, 'equipment-stale-target');
  const reopened = await svc.get(user, draft.id);
  const route = (reopened.generatedModel as any).components.find(
    (item: any) => item.id === 'pipe-missing-equipment-stale'
  );

  assert.equal(route.id, 'pipe-missing-equipment-stale');
  assert.deepEqual(route.geometry.points, [
    { x: 0, y: 1, z: 0 },
    { x: 4, y: 1, z: 0 },
  ]);
  assert.equal(route.route.endpointRefs.to.status, 'stale');
  assert.equal(route.route.endpointRefs.to.staleReason, 'connected-equipment-not-found');
  assert.equal(route.businessMetadata.endpointRefs.to.status, 'stale');
});

test('viewer draft marks locked connected route endpoint stale when equipment moves', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);

  await svc.createComponent(user, draft.id, {
    id: 'equipment-locked-route-source',
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Locked route source',
    elevation: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 1, y: 1, z: 1 },
    geometry: { kind: 'box', x: 1, y: 1, z: 1, width: 1, height: 1, depth: 1 },
  });
  await svc.createComponent(user, draft.id, {
    id: 'pipe-locked-stale',
    type: 'pipe-route',
    systemKey: 'cooling',
    name: 'Locked stale pipe',
    lockState: 'locked',
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 1, y: 1, z: 1 },
        { x: 3, y: 1, z: 1 },
      ],
    },
    route: {
      floors: [1],
      size: { diameterMm: 32 },
      endpointRefs: {
        from: {
          equipmentId: 'equipment-locked-route-source',
          attachmentKind: 'anchor',
          attachmentId: 'equipment-anchor:center',
          status: 'connected',
        },
      },
      bomMapping: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
    },
  });

  const moved = await svc.updateComponent(user, draft.id, 'equipment-locked-route-source', {
    type: 'equipment',
    systemKey: 'cooling',
    name: 'Locked route source',
    elevation: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 2, y: 1, z: 2 },
    geometry: { kind: 'box', x: 2, y: 1, z: 2, width: 1, height: 1, depth: 1 },
  });
  const model = moved.generatedModel as any;
  const route = model.components.find((item: any) => item.id === 'pipe-locked-stale');

  assert.deepEqual(route.geometry.points[0], { x: 1, y: 1, z: 1 });
  assert.equal(route.locked, true);
  assert.equal(route.route.endpointRefs.from.status, 'stale');
  assert.equal(route.route.endpointRefs.from.staleReason, 'connected-route-locked-during-equipment-move');
  assert.equal(route.route.summary.totalLengthM, 2);
  assert.equal(route.bomMetadata.quantity, 2);
});

test('viewer draft component contract rejects malformed ids geometry sizes and rotations', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    projectId: 'project-malformed-1',
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);

  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: '../bad-id',
        type: 'wall',
        systemKey: 'envelope',
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 3, depth: 0.2 },
      }),
    /component id is invalid/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-wall-size',
        type: 'wall',
        systemKey: 'envelope',
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: -1, height: 3, depth: 0.2 },
      }),
    /dimensions.width must be a positive number/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-points',
        type: 'pipe-route',
        systemKey: 'cooling',
        geometry: { kind: 'polyline', diameterMm: 32, points: [{ x: 0, y: 1, z: 0 }] },
    }),
    /route geometry must be a polyline/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-coordinate',
        type: 'pipe-route',
        systemKey: 'cooling',
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 1, z: 0 },
            { x: Number.POSITIVE_INFINITY, y: 1, z: 1 },
          ],
        },
        route: { floors: [1], size: { diameterMm: 32 } },
      }),
    /geometry.points\[1\].x must be a number/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-missing-floor',
        type: 'pipe-route',
        systemKey: 'cooling',
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
        },
        route: { size: { diameterMm: 32 } },
      }),
    /route floors are required/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-floor-ref',
        type: 'pipe-route',
        systemKey: 'cooling',
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
        },
        route: { floors: [2], size: { diameterMm: 32 } },
      }),
    /route.floors\[0\] must reference an existing floor/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-same-floor-riser',
        type: 'pipe-route',
        systemKey: 'cooling',
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
        },
        route: {
          floors: [1],
          crossFloorTransitions: [{ kind: 'riser', fromFloor: 1, toFloor: 1 }],
          size: { diameterMm: 32 },
        },
      }),
    /cross-floor transition must connect different floors/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-project',
        type: 'pipe-route',
        systemKey: 'cooling',
        businessMetadata: { projectId: 'project-INTRUDER' },
        geometry: {
          kind: 'polyline',
          diameterMm: 32,
          points: [
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
        },
        route: { floors: [1], size: { diameterMm: 32 } },
      }),
    /route projectId must match viewer draft projectId/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-rotation',
        type: 'equipment',
        systemKey: 'cooling',
        rotation: { x: 0, y: 720, z: 0 },
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /rotation y must be between -360 and 360/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-visibility',
        type: 'equipment',
        systemKey: 'cooling',
        visibility: 'collapsed' as any,
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /component visibility must be visible or hidden/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-locked',
        type: 'equipment',
        systemKey: 'cooling',
        locked: 'yes' as any,
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /component locked must be boolean/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-lock-state',
        type: 'equipment',
        systemKey: 'cooling',
        lockState: 'sealed' as any,
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /component lockState must be locked or unlocked/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-route-dimensions',
        type: 'duct-route',
        systemKey: 'freshAir',
        geometry: {
          kind: 'polyline',
          points: [
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
        },
      }),
    /route dimensions require diameterMm or width\/height/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-floor',
        type: 'equipment',
        systemKey: 'cooling',
        floor: 1.5,
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /floor must be an integer/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-elevation',
        type: 'equipment',
        systemKey: 'cooling',
        elevation: -0.1,
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /elevation must be between 0 and 200 meters/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-install-height',
        type: 'equipment',
        systemKey: 'cooling',
        installHeight: -1,
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /installHeight must be between 0 and 50 meters/
  );
  await assert.rejects(
    () =>
      svc.createComponent(user, draft.id, {
        id: 'bad-position-y',
        type: 'equipment',
        systemKey: 'cooling',
        position: { x: 0, y: -1, z: 0 },
        geometry: { kind: 'box', x: 0, y: -1, z: 0, width: 1, height: 1, depth: 1 },
      }),
    /position.y must be between 0 and 200 meters/
  );
});

test('viewer draft read is scoped by tenant and dealer/store ownership', async () => {
  const { svc } = svcWith([
    {
      id: 'draft-1',
      tenantId: 'tenant-1',
      dealerId: 'dealer-OWNER',
      storeId: 'store-OWNER',
      projectInputs: {},
      buildingInputs: {},
      systemInputs: {},
      version: 1,
      status: 'draft',
    },
  ]);

  await assert.rejects(
    () => svc.get({ ...user, dealerId: 'dealer-INTRUDER', storeId: 'store-INTRUDER' }, 'draft-1'),
    /viewer draft not found/
  );
});

test('viewer draft component writes are scoped by tenant and dealer/store ownership', async () => {
  const { svc } = svcWith();
  const draft = await svc.save(user, {
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Radiators' },
  });
  await svc.generateModel(user, draft.id);

  await assert.rejects(
    () =>
      svc.createComponent(
        { ...user, tenantId: 'tenant-2', dealerId: 'dealer-1', storeId: 'store-1' },
        draft.id,
        {
          id: 'intruder-wall',
          type: 'wall',
          systemKey: 'envelope',
          geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 3, depth: 0.2 },
        }
      ),
    /viewer draft not found/
  );
  await assert.rejects(
    () =>
      svc.createComponent({ ...user, storeId: 'store-INTRUDER' }, draft.id, {
        id: 'intruder-wall',
        type: 'wall',
        systemKey: 'envelope',
        geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 3, depth: 0.2 },
      }),
    /viewer draft not found/
  );
});
