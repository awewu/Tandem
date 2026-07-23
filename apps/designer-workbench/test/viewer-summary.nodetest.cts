import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildViewerDesignSummary,
  selectViewerSummaryModel,
} from '../src/app/viewer/viewer-summary';

const project = { name: 'Villa A', city: 'Shanghai' };
const building = { area: 180, floors: 2, floorHeight: 3, roomCount: 6 };
const systems = { coolingSystem: 'VRF + fresh air', heatingSystem: 'Radiant floor heating' };

test('viewer summary recalculates cooling and heating load from building parameters', () => {
  const small = buildViewerDesignSummary({ project, building, systems });
  const large = buildViewerDesignSummary({
    project,
    building: { ...building, area: 260, floors: 3 },
    systems,
  });

  assert.equal(small.trustStatus, 'estimate');
  assert.ok(large.calculationSummary.coolingLoadKw > small.calculationSummary.coolingLoadKw);
  assert.ok(large.calculationSummary.heatingLoadKw > small.calculationSummary.heatingLoadKw);
});

test('viewer summary builds equipment rows from selected systems', () => {
  const withHeating = buildViewerDesignSummary({ project, building, systems });
  const noHeating = buildViewerDesignSummary({
    project,
    building,
    systems: { coolingSystem: 'Ducted split system', heatingSystem: 'No heating' },
  });

  assert.deepEqual(
    withHeating.equipmentSummary.rows.map((row) => row.systemKey),
    ['cooling', 'freshAir', 'heating']
  );
  assert.deepEqual(
    noHeating.equipmentSummary.rows.map((row) => row.systemKey),
    ['cooling']
  );
});

test('viewer summary links equipment and pipe stats to generated model component ids', () => {
  const summary = buildViewerDesignSummary({
    project,
    building,
    systems,
    draftId: 'draft-1',
    generatedModel: {
      id: 'model-1',
      modelVersion: 4,
      components: [
        {
          id: 'cooling-equipment-1',
          type: 'equipment',
          systemKey: 'cooling',
          businessMetadata: {},
        },
        {
          id: 'heating-equipment-1',
          type: 'equipment',
          systemKey: 'heating',
          businessMetadata: {},
        },
        {
          id: 'pipe-1',
          type: 'pipe-route',
          systemKey: 'cooling',
          displayName: '冷媒管 DN32',
          businessMetadata: { estimatedLengthM: 44, material: '铜管', insulationMm: 25 },
          dimensions: { diameterMm: 32 },
        },
        {
          id: 'pipe-2',
          type: 'pipe-route',
          systemKey: 'heating',
          businessMetadata: { estimatedLengthM: 31 },
        },
        {
          id: 'duct-1',
          type: 'duct-route',
          systemKey: 'freshAir',
          bomMetadata: { estimatedLengthM: 12 },
        },
        {
          id: 'pipe-deleted',
          type: 'pipe-route',
          systemKey: 'cooling',
          dimensions: { estimatedLengthM: 99 },
          status: 'deleted',
        },
      ],
    },
  });

  assert.equal(summary.modelId, 'model-1');
  assert.equal(summary.modelVersion, 4);
  assert.equal(summary.equipmentSummary.rows[0].linkedComponentId, 'cooling-equipment-1');
  assert.equal(summary.pipeSummary.source, 'model');
  assert.equal(summary.pipeSummary.totalLengthM, 87);
  assert.deepEqual(summary.pipeSummary.linkedComponentIds, ['pipe-1', 'pipe-2', 'duct-1']);
  assert.equal(summary.pipeSummary.routes[0].name, '冷媒管 DN32');
  assert.equal(summary.pipeSummary.routes[0].material, '铜管');
  assert.equal(summary.pipeSummary.routes[0].diameterMm, 32);
  assert.equal(summary.pipeSummary.routes[0].insulationMm, 25);
});

test('viewer summary includes manual equipment rows with component BOM metadata', () => {
  const summary = buildViewerDesignSummary({
    project,
    building,
    systems,
    draftId: 'draft-manual-equipment',
    generatedModel: {
      id: 'model-manual-equipment',
      modelVersion: 6,
      components: [
        {
          id: 'hvac-v6-cooling-equipment',
          type: 'equipment',
          systemKey: 'cooling',
          modelId: 'model-manual-equipment',
          modelVersion: 6,
          version: 6,
          businessMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'COOLING-GEN' },
          bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'COOLING-GEN' },
        },
        {
          id: 'manual-freshair-erv-01',
          type: 'equipment',
          systemKey: 'freshAir',
          name: 'Manual ERV 350',
          displayName: '新风主机 ERV-350',
          modelId: 'model-manual-equipment',
          modelVersion: 6,
          version: 7,
          dimensions: { length: 1.2, width: 0.8, height: 0.45 },
          businessMetadata: { capacityKw: 2.4, modelSku: 'ERV-350', editedBy: 'viewer-component-crud' },
          bomMetadata: {
            bomMappable: true,
            bomCategory: 'equipment',
            bomSkuHint: 'ERV-350',
            quantity: 2,
            unit: 'set',
          },
        },
      ],
    },
  });
  const manual = summary.equipmentSummary.rows.find(
    (row) => row.linkedComponentId === 'manual-freshair-erv-01' && row.source === 'model-component'
  );

  assert.ok(manual);
  assert.equal(manual.source, 'model-component');
  assert.equal(manual.name, '新风主机 ERV-350');
  assert.equal(manual.quantity, 2);
  assert.equal(manual.loadKw, 2.4);
  assert.equal(manual.linkedModelId, 'model-manual-equipment');
  assert.equal(manual.linkedModelVersion, 6);
  assert.equal(manual.componentVersion, 7);
  assert.deepEqual(manual.dimensions, { length: 1.2, width: 0.8, height: 0.45 });
  assert.deepEqual(manual.bomMetadata, {
    bomMappable: true,
    bomCategory: 'equipment',
    bomSkuHint: 'ERV-350',
    quantity: 2,
    unit: 'set',
  });
});

test('viewer summary keeps hidden and locked components commercial but excludes deleted components', () => {
  const summary = buildViewerDesignSummary({
    project,
    building,
    systems,
    draftId: 'draft-hidden-locked',
    generatedModel: {
      id: 'model-hidden-locked',
      modelVersion: 9,
      components: [
        {
          id: 'manual-equipment-hidden',
          type: 'equipment',
          systemKey: 'water',
          displayName: '隐藏但计价的水泵',
          visibility: 'hidden',
          dimensions: { length: 0.6, width: 0.35, height: 0.4 },
          businessMetadata: { capacityKw: 0.8, modelSku: 'PUMP-HIDDEN' },
          bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'PUMP-HIDDEN' },
        },
        {
          id: 'manual-equipment-locked',
          type: 'equipment',
          systemKey: 'smartControl',
          displayName: '锁定但计价的控制箱',
          locked: true,
          businessMetadata: { capacityKw: 0.2, modelSku: 'CTRL-LOCKED' },
          bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'CTRL-LOCKED' },
        },
        {
          id: 'manual-pipe-hidden',
          type: 'pipe-route',
          systemKey: 'water',
          displayName: '隐藏但计价的给水管',
          visibility: 'hidden',
          geometry: {
            kind: 'polyline',
            diameterMm: 25,
            points: [
              { x: 0, y: 1, z: 0 },
              { x: 3, y: 1, z: 4 },
            ],
          },
          businessMetadata: { material: 'PPR', insulationMm: 15 },
          bomMetadata: { bomMappable: true, bomCategory: 'pipe', bomSkuHint: 'PPR-DN25' },
        },
        {
          id: 'manual-pipe-locked',
          type: 'pipe-route',
          systemKey: 'cooling',
          displayName: '锁定但计价的冷媒管',
          locked: true,
          businessMetadata: { estimatedLengthM: 7, material: '铜管' },
          dimensions: { diameterMm: 22 },
        },
        {
          id: 'manual-equipment-deleted',
          type: 'equipment',
          systemKey: 'freshAir',
          displayName: '已删除设备',
          status: 'deleted',
          bomMetadata: { bomMappable: true, bomSkuHint: 'DELETED-EQ' },
        },
        {
          id: 'manual-pipe-deleted',
          type: 'pipe-route',
          systemKey: 'cooling',
          displayName: '已删除管线',
          status: 'deleted',
          businessMetadata: { estimatedLengthM: 99 },
        },
      ],
    },
  });

  const linkedEquipment = summary.equipmentSummary.rows
    .map((row) => row.linkedComponentId)
    .filter(Boolean);
  assert.ok(linkedEquipment.includes('manual-equipment-hidden'));
  assert.ok(linkedEquipment.includes('manual-equipment-locked'));
  assert.equal(linkedEquipment.includes('manual-equipment-deleted'), false);
  assert.equal(summary.pipeSummary.routeCount, 2);
  assert.equal(summary.pipeSummary.totalLengthM, 12);
  assert.deepEqual(summary.pipeSummary.linkedComponentIds, [
    'manual-pipe-hidden',
    'manual-pipe-locked',
  ]);
  assert.equal(summary.pipeSummary.routes[0].name, '隐藏但计价的给水管');
  assert.equal(summary.pipeSummary.routes[0].lengthM, 5);
  assert.equal(summary.pipeSummary.routes[1].name, '锁定但计价的冷媒管');
});

test('viewer summary updates downstream equipment and pipe rollups after manual edits and deletes', () => {
  const edited = buildViewerDesignSummary({
    project,
    building,
    systems,
    draftId: 'draft-edit-delete',
    generatedModel: {
      id: 'model-edit-delete',
      modelVersion: 8,
      components: [
        {
          id: 'manual-ahu-deleted',
          type: 'equipment',
          systemKey: 'freshAir',
          name: 'Deleted AHU',
          status: 'deleted',
          bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'STALE-AHU' },
        },
        {
          id: 'manual-ahu-active',
          type: 'equipment',
          systemKey: 'freshAir',
          name: 'Active AHU',
          bomMetadata: { bomMappable: true, bomCategory: 'equipment', bomSkuHint: 'ACTIVE-AHU' },
        },
        {
          id: 'manual-pipe-edited',
          type: 'pipe-route',
          systemKey: 'cooling',
          businessMetadata: { estimatedLengthM: 18 },
          bomMetadata: { bomMappable: true, bomCategory: 'pipe-route', estimatedLengthM: 18 },
        },
        {
          id: 'manual-duct-edited',
          type: 'duct-route',
          systemKey: 'freshAir',
          dimensions: { estimatedLengthM: 9 },
        },
        {
          id: 'manual-pipe-deleted',
          type: 'pipe-route',
          systemKey: 'cooling',
          status: 'deleted',
          businessMetadata: { estimatedLengthM: 99 },
        },
      ],
    },
  });

  assert.equal(
    edited.equipmentSummary.rows.some((row) => row.linkedComponentId === 'manual-ahu-deleted'),
    false
  );
  assert.ok(
    edited.equipmentSummary.rows.some((row) => row.linkedComponentId === 'manual-ahu-active')
  );
  assert.equal(edited.pipeSummary.routeCount, 2);
  assert.equal(edited.pipeSummary.totalLengthM, 27);
  assert.deepEqual(edited.pipeSummary.linkedComponentIds, [
    'manual-pipe-edited',
    'manual-duct-edited',
  ]);
});

test('viewer summary model selection ignores an empty draft model and preserves loaded model context', () => {
  const selected = selectViewerSummaryModel(
    {},
    null,
    {
      id: 'loaded-source-1',
      modelVersion: 2,
      components: [
        {
          id: 'loaded-pipe-1',
          type: 'pipe-route',
          systemKey: 'cooling',
          dimensions: { estimatedLengthM: 18 },
        },
      ],
    }
  );

  const summary = buildViewerDesignSummary({
    project,
    building,
    systems,
    draftId: 'draft-1',
    generatedModel: selected,
  });

  assert.equal(summary.modelId, 'loaded-source-1');
  assert.equal(summary.modelVersion, 2);
  assert.equal(summary.pipeSummary.source, 'model');
  assert.equal(summary.pipeSummary.totalLengthM, 18);
  assert.deepEqual(summary.pipeSummary.linkedComponentIds, ['loaded-pipe-1']);
});
