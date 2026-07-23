import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPlacementPointerOffset,
  appendManualRiserToRouteDraft,
  appendOrthogonalRouteDraftPoint,
  buildLogicalRouteShapeFromDraft,
  componentPlacementAnchor,
  componentPayloadFromCatalogTemplate,
  constrainPlacementPoint,
  deleteIntermediateRoutePoint,
  findRouteEndpointSnapCandidate,
  insertRoutePointOnSegment,
  installHeightFromElevation,
  moveRoutePoint,
  normalizedOutsidePlacementMargin,
  parseTemplateDropData,
  parseTemplateDropId,
  placementElevationFrom,
  placementPointerOffset,
  routeEndpointRefsWithCandidate,
  routeDraftCanFinish,
} from '../src/app/viewer/viewer-component-placement';
import type {
  GeneratedHvacComponent,
  GeneratedHvacModel,
  ViewerComponentCatalogTemplate,
} from '../src/lib/api';

const wallTemplate: ViewerComponentCatalogTemplate = {
  id: 'wall-standard-200',
  category: 'wall',
  type: 'wall',
  label: '200mm wall',
  description: 'Wall',
  systemKey: 'envelope',
  defaultDimensions: { lengthM: 3.6, heightM: 3, thicknessMm: 200 },
  editableProperties: [],
  bomMapping: {
    category: 'wall',
    skuPrefix: 'WALL_STANDARD_200',
    quantityUnit: 'm2',
    measurementKey: 'areaM2',
    notes: [],
  },
};

const equipmentTemplate: ViewerComponentCatalogTemplate = {
  id: 'ahu-horizontal',
  category: 'hvac-equipment',
  type: 'equipment',
  label: 'AHU',
  description: 'Air handling unit',
  systemKey: 'freshAir',
  defaultDimensions: { widthM: 1.6, depthM: 0.9, heightM: 0.8, airflowM3h: 1200 },
  editableProperties: [],
  bomMapping: {
    category: 'hvac-equipment',
    skuPrefix: 'AHU_HORIZONTAL',
    quantityUnit: 'set',
    measurementKey: 'quantity',
    notes: [],
  },
};

const windowTemplate: ViewerComponentCatalogTemplate = {
  id: 'window-standard-1500',
  category: 'window',
  type: 'window',
  label: '窗 1500mm',
  description: 'Window',
  systemKey: 'envelope',
  defaultDimensions: { widthM: 1.5, heightM: 1.5, sillHeightM: 0.9, thicknessMm: 120 },
  editableProperties: [],
  bomMapping: {
    category: 'window',
    skuPrefix: 'WINDOW_STANDARD_1500',
    quantityUnit: 'set',
    measurementKey: 'quantity',
    notes: [],
  },
};

const pipeTemplate: ViewerComponentCatalogTemplate = {
  id: 'refrigerant-pipe-pair',
  category: 'pipe',
  type: 'pipe-route',
  label: 'Refrigerant pipe',
  description: 'Pipe route',
  systemKey: 'cooling',
  defaultDimensions: { diameterMm: 19.05, insulationMm: 20, estimatedLengthM: 8 },
  editableProperties: [],
  bomMapping: {
    category: 'pipe',
    skuPrefix: 'REFRIGERANT_PIPE_PAIR',
    quantityUnit: 'm',
    measurementKey: 'estimatedLengthM',
    notes: [],
  },
};

test('drag payload converts a wall template into a persisted box component at the drop point', () => {
  const payload = componentPayloadFromCatalogTemplate(wallTemplate, { x: 2.25, y: 0, z: -1.5 });

  assert.equal(payload.type, 'wall');
  assert.equal(payload.systemKey, 'envelope');
  assert.equal(payload.displayName, '200mm wall');
  assert.equal(payload.sourceTemplateId, 'wall-standard-200');
  assert.deepEqual(payload.rotation, { x: 0, y: 0, z: 0 });
  assert.equal(payload.visibility, 'visible');
  assert.equal(payload.locked, false);
  assert.deepEqual(payload.geometry, {
    kind: 'box',
    x: 2.25,
    y: 1.5,
    z: -1.5,
    width: 3.6,
    height: 3,
    depth: 0.2,
  });
  assert.equal(payload.bomMetadata?.quantity, 10.8);
  assert.equal(payload.bomMetadata?.unit, 'm2');
});

test('drag payload applies edited default parameters before placement', () => {
  const payload = componentPayloadFromCatalogTemplate(
    wallTemplate,
    { x: 0, y: 0, z: 0 },
    undefined,
    {
      displayName: '客厅背景墙 240mm',
      systemKey: 'envelope',
      lengthM: 4.2,
      heightM: 2.8,
      thicknessMm: 240,
    }
  );

  assert.equal(payload.displayName, '客厅背景墙 240mm');
  assert.equal(payload.name, '客厅背景墙 240mm');
  assert.equal(payload.systemKey, 'envelope');
  assert.equal(payload.dimensions?.width, 4.2);
  assert.equal(payload.dimensions?.height, 2.8);
  assert.equal(payload.dimensions?.depth, 0.24);
  assert.equal(payload.businessMetadata?.lengthM, 4.2);
  assert.equal(payload.businessMetadata?.thicknessMm, 240);
  assert.deepEqual(payload.businessMetadata?.templateDefaultOverrides, {
    displayName: '客厅背景墙 240mm',
    systemKey: 'envelope',
    lengthM: 4.2,
    heightM: 2.8,
    thicknessMm: 240,
  });
});

test('drag payload applies edited door and window defaults as dimensions and business metadata', () => {
  const payload = componentPayloadFromCatalogTemplate(
    windowTemplate,
    { x: 1.5, y: 0, z: 2.5 },
    undefined,
    {
      displayName: '主卧窗 1800mm',
      widthM: 1.8,
      heightM: 1.35,
      thicknessMm: 140,
      openingDirection: 'sliding',
      sillHeightM: 0.85,
    }
  );

  assert.equal(payload.displayName, '主卧窗 1800mm');
  assert.equal(payload.type, 'window');
  assert.equal(payload.dimensions?.width, 1.8);
  assert.equal(payload.dimensions?.height, 1.35);
  assert.equal(payload.dimensions?.depth, 0.14);
  assert.equal(payload.elevation, 0.68);
  assert.equal(payload.businessMetadata?.openingDirection, 'sliding');
  assert.equal(payload.businessMetadata?.sillHeightM, 0.85);
  assert.equal(payload.bomMetadata?.bomCategory, 'window');
});

test('drag payload applies edited equipment defaults and keeps business/BOM fields', () => {
  const payload = componentPayloadFromCatalogTemplate(
    equipmentTemplate,
    { x: -2, y: 0, z: 3 },
    undefined,
    {
      displayName: '新风主机 AHU-1200',
      systemKey: 'freshAir',
      widthM: 1.8,
      depthM: 1,
      heightM: 0.9,
      modelSku: 'AHU-1200-CN',
      installMethod: 'ceiling',
    }
  );

  assert.equal(payload.displayName, '新风主机 AHU-1200');
  assert.equal(payload.systemKey, 'freshAir');
  assert.equal(payload.dimensions?.width, 1.8);
  assert.equal(payload.dimensions?.height, 0.9);
  assert.equal(payload.dimensions?.depth, 1);
  assert.equal(payload.businessMetadata?.modelSku, 'AHU-1200-CN');
  assert.equal(payload.businessMetadata?.installMethod, 'ceiling');
  assert.equal(payload.businessMetadata?.bomSkuHint, 'AHU_HORIZONTAL');
  assert.equal(payload.bomMetadata?.unit, 'set');
});

test('drag payload converts an equipment template with defaults and BOM metadata', () => {
  const payload = componentPayloadFromCatalogTemplate(equipmentTemplate, { x: -3, y: 0, z: 4 });

  assert.equal(payload.type, 'equipment');
  assert.equal(payload.systemKey, 'freshAir');
  assert.equal(payload.geometry?.kind, 'box');
  assert.equal(payload.dimensions?.width, 1.6);
  assert.equal(payload.dimensions?.height, 0.8);
  assert.equal(payload.businessMetadata?.bomSkuHint, 'AHU_HORIZONTAL');
  assert.equal(payload.businessMetadata?.placedBy, 'viewer-drag-to-place');
  assert.equal(payload.bomMetadata?.quantity, 1);
  assert.equal(payload.bomMetadata?.unit, 'set');
});

test('drag payload creates a route with at least two stable 3D points', () => {
  const payload = componentPayloadFromCatalogTemplate(pipeTemplate, { x: 1, y: 0, z: 2 });
  const points = payload.geometry?.points as Array<{ x: number; y: number; z: number }>;

  assert.equal(payload.type, 'pipe-route');
  assert.equal(payload.geometry?.kind, 'polyline');
  assert.equal(payload.geometry?.diameterMm, 19.05);
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], { x: 1, y: 0.95, z: 2 });
  assert.deepEqual(points[1], { x: 9, y: 0.95, z: 2 });
  assert.equal(payload.dimensions?.estimatedLengthM, 8);
  assert.equal(payload.bomMetadata?.quantity, 8);
});

test('drag payload applies edited pipe defaults to route geometry metadata and BOM quantity', () => {
  const payload = componentPayloadFromCatalogTemplate(
    pipeTemplate,
    { x: 1, y: 0, z: 2 },
    undefined,
    {
      displayName: '冷媒管 DN22',
      systemKey: 'cooling',
      diameterMm: 22,
      material: 'copper',
      estimatedLengthM: 12,
      insulationMm: 25,
    }
  );
  const points = payload.geometry?.points as Array<{ x: number; y: number; z: number }>;

  assert.equal(payload.displayName, '冷媒管 DN22');
  assert.equal(payload.systemKey, 'cooling');
  assert.equal(payload.geometry?.diameterMm, 22);
  assert.deepEqual(points[1], { x: 13, y: 0.95, z: 2 });
  assert.equal(payload.dimensions?.diameterMm, 22);
  assert.equal(payload.dimensions?.estimatedLengthM, 12);
  assert.equal(payload.businessMetadata?.material, 'copper');
  assert.equal(payload.businessMetadata?.insulationMm, 25);
  assert.equal(payload.bomMetadata?.quantity, 12);
  assert.equal(payload.bomMetadata?.unit, 'm');
});

test('orthogonal route draft appends ordered X/Z right-angle legs with absolute y elevation', () => {
  let points = appendOrthogonalRouteDraftPoint([], { x: 0, y: 3.45, z: 0 });
  points = appendOrthogonalRouteDraftPoint(points, { x: 4, y: 3.45, z: 3 });
  points = appendOrthogonalRouteDraftPoint(points, { x: 1, y: 3.45, z: 6 });

  assert.deepEqual(points, [
    { x: 0, y: 3.45, z: 0 },
    { x: 4, y: 3.45, z: 0 },
    { x: 4, y: 3.45, z: 3 },
    { x: 1, y: 3.45, z: 3 },
    { x: 1, y: 3.45, z: 6 },
  ]);
  assert.equal(routeDraftCanFinish(points), true);
});

test('orthogonal route draft ignores zero-length duplicate segments and can continue after undo', () => {
  let points = appendOrthogonalRouteDraftPoint([], { x: 0, y: 0.95, z: 0 });
  points = appendOrthogonalRouteDraftPoint(points, { x: 0, y: 0.95, z: 0 });
  points = appendOrthogonalRouteDraftPoint(points, { x: 2, y: 0.95, z: 0 });
  const afterUndo = points.slice(0, -1);
  const continued = appendOrthogonalRouteDraftPoint(afterUndo, { x: 2, y: 0.95, z: 2 });

  assert.deepEqual(points, [
    { x: 0, y: 0.95, z: 0 },
    { x: 2, y: 0.95, z: 0 },
  ]);
  assert.equal(routeDraftCanFinish(afterUndo), false);
  assert.deepEqual(continued, [
    { x: 0, y: 0.95, z: 0 },
    { x: 2, y: 0.95, z: 0 },
    { x: 2, y: 0.95, z: 2 },
  ]);
});

test('route draft shape maps to the I2 logical route contract without changing point precision', () => {
  const points = [
    { x: 0.123456, y: 3.456789, z: 0.345678 },
    { x: 2.123456, y: 3.456789, z: 0.345678 },
    { x: 2.123456, y: 3.456789, z: 2.345678 },
    { x: 5.123456, y: 3.456789, z: 2.345678 },
  ];
  const route = buildLogicalRouteShapeFromDraft({
    points,
    floorHeight: 3,
    systemKey: 'cooling',
    routeType: 'pipe-route',
    size: { diameterMm: 32 },
    material: 'copper',
    insulation: { thicknessMm: 20, material: 'rubber' },
    bendRadius: { radiusM: 0.45 },
    bomMapping: { bomMappable: true, bomCategory: 'pipe-route', unit: 'm' },
  });

  assert.equal(route.kind, 'logical-route');
  assert.deepEqual(route.coordinateSystem.planeAxes, ['x', 'z']);
  assert.equal(route.coordinateSystem.elevationAxis, 'y');
  assert.equal(route.coordinateSystem.ySemantics, 'absolute-model-elevation-m');
  assert.deepEqual(route.points, points);
  assert.deepEqual(route.floors, [
    {
      floor: 2,
      floorId: 'floor-2',
      pointIndexes: [0, 1, 2, 3],
      elevationMin: 3,
      elevationMax: 6,
    },
  ]);
  assert.deepEqual(route.crossFloorTransitions, []);
  assert.deepEqual(route.size, { diameterMm: 32 });
  assert.equal(route.summary.pointCount, 4);
  assert.equal(route.summary.totalLengthM, 6.61);
  assert.equal(route.bomMapping.quantity, 6.61);
});

test('route draft shape normalizes millimeter bend radius to accepted meters metadata', () => {
  const route = buildLogicalRouteShapeFromDraft({
    points: [
      { x: 0, y: 0.95, z: 0 },
      { x: 3, y: 0.95, z: 0 },
      { x: 3, y: 0.95, z: 3 },
    ],
    floorHeight: 3,
    systemKey: 'cooling',
    routeType: 'pipe-route',
    size: { diameterMm: 32 },
    bendRadius: { radiusMm: 500 },
  });

  assert.deepEqual(route.bendRadius, { radiusM: 0.5 });
  assert.equal(route.summary.totalLengthM, 5.79);
});

test('manual riser draft appends constant x/z vertical points without reordering horizontals', () => {
  const horizontal = [
    { x: -2, y: 3.95, z: 1 },
    { x: 0, y: 3.95, z: 1 },
  ];
  const points = appendManualRiserToRouteDraft({
    points: horizontal,
    sourceFloor: 2,
    targetFloor: 1,
    point: { x: 1.25, z: -0.5 },
    installHeight: 0.95,
    floorHeight: 3,
  });

  assert.deepEqual(points.slice(0, 2), horizontal);
  assert.deepEqual(points.slice(-2), [
    { x: 1.25, y: 3.95, z: -0.5 },
    { x: 1.25, y: 0.95, z: -0.5 },
  ]);
  assert.equal(points[2].x, points[3].x);
  assert.equal(points[2].z, points[3].z);
  assert.notEqual(points[2].y, points[3].y);
});

test('install height derives from authoritative absolute y and active floor level', () => {
  assert.equal(installHeightFromElevation({ floor: 2, elevation: 3.95, floorHeight: 3 }), 0.95);
  assert.equal(installHeightFromElevation({ floor: 1, elevation: 0.95, floorHeight: 3 }), 0.95);
});

test('route point edits preserve y elevation while moving x/z and compact duplicate segments', () => {
  const moved = moveRoutePoint(
    [
      { x: 0, y: 3.45, z: 0 },
      { x: 2, y: 3.45, z: 0 },
      { x: 2, y: 3.45, z: 2 },
      { x: 5, y: 3.45, z: 2 },
    ],
    2,
    { x: 4.25, y: 0, z: 3.75 }
  );

  assert.deepEqual(moved[2], { x: 4.25, y: 3.45, z: 3.75 });
  assert.equal(routeDraftCanFinish(moved), true);

  const compacted = moveRoutePoint(
    [
      { x: 0, y: 0.95, z: 0 },
      { x: 2, y: 0.95, z: 0 },
      { x: 2, y: 0.95, z: 2 },
    ],
    1,
    { x: 0, y: 99, z: 0 }
  );

  assert.deepEqual(compacted, [
    { x: 0, y: 0.95, z: 0 },
    { x: 2, y: 0.95, z: 2 },
  ]);
});

test('route segment insertion and intermediate deletion preserve ordered valid route geometry', () => {
  const points = [
    { x: 0, y: 0.95, z: 0 },
    { x: 4, y: 0.95, z: 0 },
    { x: 4, y: 0.95, z: 3 },
  ];
  const inserted = insertRoutePointOnSegment(points, 0, { x: 2, y: 50, z: 0 });
  const deleted = deleteIntermediateRoutePoint(inserted, 1);

  assert.deepEqual(inserted, [
    { x: 0, y: 0.95, z: 0 },
    { x: 2, y: 0.95, z: 0 },
    { x: 4, y: 0.95, z: 0 },
    { x: 4, y: 0.95, z: 3 },
  ]);
  assert.deepEqual(deleted, points);
  assert.equal(deleteIntermediateRoutePoint(inserted, 0), null);
  assert.equal(deleteIntermediateRoutePoint(inserted, inserted.length - 1), null);
});

test('template drag parser accepts both legacy id text and structured transfer data', () => {
  assert.equal(parseTemplateDropId('ahu-horizontal'), 'ahu-horizontal');
  assert.equal(
    parseTemplateDropId('{"id":"wall-standard-200","type":"wall"}'),
    'wall-standard-200'
  );
  assert.deepEqual(parseTemplateDropData('{"id":"ahu-horizontal","floor":2,"installHeight":0.45}'), {
    id: 'ahu-horizontal',
    type: undefined,
    systemKey: undefined,
    floor: 2,
    elevation: undefined,
    installHeight: 0.45,
  });
});

test('height-aware placement plane uses y elevation from floor and install height', () => {
  assert.equal(placementElevationFrom({ floor: 2, installHeight: 0.45, floorHeight: 3 }), 3.45);
  assert.equal(
    placementElevationFrom({
      floor: 2,
      elevation: 4.2,
      installHeight: 0.45,
      floorHeight: 3,
    }),
    4.2
  );
  assert.equal(placementElevationFrom({ fallbackElevation: 0.95 }), 0.95);
});

test('pointer offset keeps component anchor stable during height-aware drag', () => {
  const anchor = { x: 5, y: 3.45, z: -2 };
  const pointerAtDragStart = { x: 4.4, y: 3.45, z: -2.5 };
  const offset = placementPointerOffset(anchor, pointerAtDragStart);

  assert.deepEqual(offset, { x: 0.6, y: 0, z: 0.5 });
  assert.deepEqual(applyPlacementPointerOffset({ x: 10, y: 3.45, z: 1 }, offset), {
    x: 10.6,
    y: 3.45,
    z: 1.5,
  });
});

test('component placement anchor follows the persisted y-axis height convention', () => {
  assert.deepEqual(
    componentPlacementAnchor({
      id: 'equipment-ceiling-ahu-01',
      draftId: 'draft-1',
      modelId: 'model-1',
      modelSourceId: null,
      sourceTemplateId: 'ahu-horizontal',
      type: 'equipment',
      category: 'hvac-equipment',
      systemKey: 'freshAir',
      modelVersion: 1,
      version: 1,
      name: 'AHU',
      displayName: 'AHU',
      floor: 2,
      elevation: 3.45,
      installHeight: 0.45,
      dimensions: { width: 1.2, height: 0.8, depth: 0.9 },
      position: { x: 2, y: 3.45, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      visibility: 'visible',
      locked: false,
      businessMetadata: {},
      bomMetadata: {},
      status: 'active',
      geometry: { kind: 'box', x: 2, y: 3.45, z: 3, width: 1.2, height: 0.8, depth: 0.9 },
    }),
    { x: 2, y: 3.45, z: 3 }
  );
});

test('route endpoint snapping prefers compatible connector metadata over fallback anchor', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  model.components.push(
    equipmentComponent('equipment-a', {
      systemKey: 'cooling',
      elevation: 0.95,
      installHeight: 0.95,
      geometry: { kind: 'box', x: 2, y: 0.95, z: 2, width: 1, height: 1, depth: 1 },
      position: { x: 2, y: 0.95, z: 2 },
      businessMetadata: {
        connectors: [
          {
            id: 'liquid-out',
            systemKey: 'cooling',
            routeType: 'pipe-route',
            offset: { x: 0.35, y: 0, z: 0 },
          },
        ],
      },
    })
  );

  const candidate = findRouteEndpointSnapCandidate({
    model,
    point: { x: 2.37, y: 0.95, z: 2 },
    systemKey: 'cooling',
    routeType: 'pipe-route',
    endpointKey: 'from',
    maxDistanceM: 0.5,
  });

  assert.equal(candidate?.attachmentKind, 'connector');
  assert.equal(candidate?.attachmentId, 'liquid-out');
  assert.deepEqual(candidate?.point, { x: 2.35, y: 0.95, z: 2 });
  assert.equal(candidate?.endpointRole, 'source');
  assert.equal(candidate?.status, 'connected');
});

test('route endpoint snapping uses documented equipment anchor fallback only without connectors', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  model.components.push(
    equipmentComponent('equipment-b', {
      systemKey: 'freshAir',
      elevation: 2.4,
      installHeight: 2.4,
      geometry: { kind: 'box', x: -1, y: 2.4, z: 1, width: 1, height: 1, depth: 1 },
      position: { x: -1, y: 2.4, z: 1 },
    })
  );

  const candidate = findRouteEndpointSnapCandidate({
    model,
    point: { x: -1.1, y: 2.4, z: 1.05 },
    systemKey: 'freshAir',
    routeType: 'duct-route',
    endpointKey: 'to',
    maxDistanceM: 0.4,
  });

  assert.equal(candidate?.attachmentKind, 'anchor');
  assert.equal(candidate?.attachmentId, 'equipment-anchor:center');
  assert.equal(candidate?.fallbackReason?.includes('no connector metadata'), true);
  assert.deepEqual(candidate?.point, { x: -1, y: 2.4, z: 1 });
  assert.equal(candidate?.endpointRole, 'target');
});

test('route endpoint snapping ignores far incompatible locked and protected equipment', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  model.components.push(
    equipmentComponent('equipment-far', {
      systemKey: 'cooling',
      geometry: { kind: 'box', x: 5, y: 1, z: 5, width: 1, height: 1, depth: 1 },
      position: { x: 5, y: 1, z: 5 },
    }),
    equipmentComponent('equipment-incompatible', {
      systemKey: 'heating',
      geometry: { kind: 'box', x: 0.1, y: 1, z: 0.1, width: 1, height: 1, depth: 1 },
      position: { x: 0.1, y: 1, z: 0.1 },
    }),
    equipmentComponent('equipment-locked', {
      systemKey: 'cooling',
      locked: true,
      geometry: { kind: 'box', x: 0.2, y: 1, z: 0.2, width: 1, height: 1, depth: 1 },
      position: { x: 0.2, y: 1, z: 0.2 },
    }),
    equipmentComponent('equipment-protected', {
      systemKey: 'cooling',
      modelSourceId: 'ifc-source-1',
      businessMetadata: { sourceType: 'artifact', modelType: 'ifc' },
      geometry: { kind: 'box', x: 0.3, y: 1, z: 0.3, width: 1, height: 1, depth: 1 },
      position: { x: 0.3, y: 1, z: 0.3 },
    })
  );

  const candidate = findRouteEndpointSnapCandidate({
    model,
    point: { x: 0, y: 1, z: 0 },
    systemKey: 'cooling',
    routeType: 'pipe-route',
    endpointKey: 'from',
    maxDistanceM: 0.5,
  });

  assert.equal(candidate, null);
});

test('route endpoint refs preserve connected status and mark moved-away endpoint disconnected', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  model.components.push(
    equipmentComponent('equipment-a', {
      systemKey: 'cooling',
      geometry: { kind: 'box', x: 1, y: 1, z: 1, width: 1, height: 1, depth: 1 },
      position: { x: 1, y: 1, z: 1 },
    })
  );
  const candidate = findRouteEndpointSnapCandidate({
    model,
    point: { x: 1.1, y: 1, z: 1 },
    systemKey: 'cooling',
    routeType: 'pipe-route',
    endpointKey: 'from',
  });
  const connected = routeEndpointRefsWithCandidate({}, 'from', candidate);
  const disconnected = routeEndpointRefsWithCandidate(connected, 'from', null);

  assert.equal(connected.from?.equipmentId, 'equipment-a');
  assert.equal(connected.from?.status, 'connected');
  assert.equal(disconnected.from?.status, 'disconnected');
  assert.equal(disconnected.from?.staleReason, 'route-endpoint-moved-without-compatible-equipment');
});

test('indoor placement clamps x/z to the active floor footprint without changing y', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  const result = constrainPlacementPoint({
    model,
    point: { x: 9.2, y: 3.45, z: -7.6 },
    template: equipmentTemplate,
    defaultOverrides: {},
  });

  assert.equal(result.installClass, 'indoor');
  assert.equal(result.valid, false);
  assert.equal(result.state, 'ready');
  assert.deepEqual(result.point, { x: 5, y: 3.45, z: -4 });
});

test('outdoor equipment placement allows finite project margin and reports candidate validity', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  const result = constrainPlacementPoint({
    model,
    point: { x: 6.5, y: 0.45, z: 0 },
    template: equipmentTemplate,
    defaultOverrides: { installLocation: 'outdoor' },
    outsidePlacementMarginM: 2.5,
  });

  assert.equal(result.installClass, 'outdoor');
  assert.equal(result.marginM, 2.5);
  assert.equal(result.valid, true);
  assert.deepEqual(result.point, { x: 6.5, y: 0.45, z: 0 });

  const clamped = constrainPlacementPoint({
    model,
    point: { x: 9, y: 0.45, z: 0 },
    template: equipmentTemplate,
    defaultOverrides: { installClass: 'outdoor' },
    outsidePlacementMarginM: 2.5,
  });

  assert.equal(clamped.valid, false);
  assert.deepEqual(clamped.point, { x: 7.5, y: 0.45, z: 0 });
});

test('missing equipment installation classification is treated as indoor', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  const result = constrainPlacementPoint({
    model,
    point: { x: 6.5, y: 0.45, z: 0 },
    template: equipmentTemplate,
    outsidePlacementMarginM: 2.5,
  });

  assert.equal(result.installClass, 'indoor');
  assert.equal(result.marginM, 0);
  assert.equal(result.valid, false);
  assert.deepEqual(result.point, { x: 5, y: 0.45, z: 0 });
});

test('bad or missing building outline uses deterministic generated-building fallback', () => {
  const model = generatedModelWithOutline({ width: Number.NaN, depth: 0, area: 180 });
  const result = constrainPlacementPoint({
    model,
    point: { x: 20, y: 1.2, z: -20 },
    template: wallTemplate,
  });

  assert.equal(result.state, 'degraded');
  assert.deepEqual(result.bounds, { minX: -8, maxX: 8, minZ: -5.5, maxZ: 5.5 });
  assert.deepEqual(result.point, { x: 8, y: 1.2, z: -5.5 });
});

test('floor-specific footprint constrains placement on the requested floor', () => {
  const model = generatedModelWithOutline({ width: 10, depth: 8 });
  model.components.push(
    buildingOutlineComponent('outline-floor-2', {
      floor: 2,
      x: 10,
      z: 0,
      width: 4,
      depth: 4,
    })
  );

  const result = constrainPlacementPoint({
    model,
    point: { x: 14, y: 3.45, z: 3 },
    template: wallTemplate,
    floor: 2,
  });

  assert.deepEqual(result.bounds, { minX: 8, maxX: 12, minZ: -2, maxZ: 2 });
  assert.deepEqual(result.point, { x: 12, y: 3.45, z: 2 });
});

test('outside placement margin defaults to 2m unless project value is finite and non-negative', () => {
  assert.equal(normalizedOutsidePlacementMargin(undefined), 2);
  assert.equal(normalizedOutsidePlacementMargin(Number.POSITIVE_INFINITY), 2);
  assert.equal(normalizedOutsidePlacementMargin(-1), 2);
  assert.equal(normalizedOutsidePlacementMargin(0), 0);
  assert.equal(normalizedOutsidePlacementMargin(1.234), 1.23);
});

function generatedModelWithOutline(input: {
  width: number;
  depth: number;
  area?: number;
}): GeneratedHvacModel {
  const components = [
    buildingOutlineComponent('outline-floor-1', {
      floor: 1,
      x: 0,
      z: 0,
      width: input.width,
      depth: input.depth,
    }),
  ];
  return {
    id: 'model-1',
    sourceType: 'generated',
    modelType: 'parametric-hvac',
    modelVersion: 1,
    draftId: 'draft-1',
    projectId: null,
    generatedAt: '2026-07-21T00:00:00.000Z',
    layers: [],
    components,
    componentSummary: {
      total: components.length,
      byType: { 'building-outline': components.length },
      bySystem: { envelope: components.length },
      byStatus: { active: components.length },
      bomMappableComponentIds: [],
    },
    inputs: {
      project: {},
      building: { area: input.area ?? 180, floors: 2, floorHeight: 3 },
      systems: {},
    },
  };
}

function buildingOutlineComponent(
  id: string,
  geometry: { floor: number; x: number; z: number; width: number; depth: number }
): GeneratedHvacComponent {
  return {
    id,
    draftId: 'draft-1',
    modelId: 'model-1',
    modelSourceId: null,
    sourceTemplateId: null,
    type: 'building-outline',
    category: 'building-envelope',
    systemKey: 'envelope',
    modelVersion: 1,
    version: 1,
    name: id,
    displayName: id,
    floor: geometry.floor,
    elevation: 1.5,
    installHeight: 1.5,
    dimensions: { width: geometry.width, height: 3, depth: geometry.depth },
    position: { x: geometry.x, y: 1.5, z: geometry.z },
    rotation: { x: 0, y: 0, z: 0 },
    visibility: 'visible',
    locked: false,
    businessMetadata: { floor: geometry.floor },
    bomMetadata: {},
    status: 'active',
    geometry: {
      kind: 'box',
      x: geometry.x,
      y: 1.5,
      z: geometry.z,
      width: geometry.width,
      height: 3,
      depth: geometry.depth,
    },
  };
}

function equipmentComponent(
  id: string,
  patch: Partial<GeneratedHvacComponent>
): GeneratedHvacComponent {
  return {
    id,
    draftId: 'draft-1',
    modelId: 'model-1',
    modelSourceId: null,
    sourceTemplateId: null,
    type: 'equipment',
    category: 'hvac-equipment',
    systemKey: 'cooling',
    modelVersion: 1,
    version: 1,
    name: id,
    displayName: id,
    floor: 1,
    elevation: 1,
    installHeight: 1,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    visibility: 'visible',
    locked: false,
    businessMetadata: {},
    bomMetadata: {},
    status: 'active',
    geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
    ...patch,
  };
}
