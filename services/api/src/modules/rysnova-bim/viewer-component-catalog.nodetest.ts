import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ViewerComponentCatalogService } from './viewer-component-catalog.service';

test('viewer component catalog exposes seedable 3D defaults with required categories', () => {
  const catalog = new ViewerComponentCatalogService().list();

  assert.equal(catalog.source, 'seed-global-defaults');
  assert.deepEqual(
    catalog.categories.map((item) => item.key),
    ['wall', 'door', 'window', 'room-zone', 'hvac-equipment', 'pipe']
  );
  assert.ok(catalog.extensionPoint.includes('tenant-editable catalog rows'));
});

test('viewer component catalog keeps required presentation names for core starter templates', () => {
  const catalog = new ViewerComponentCatalogService().list();
  const starterLabels = catalog.templates.slice(0, 4).map((item) => item.label);

  assert.deepEqual(starterLabels, ['200mm 标准墙体', '900mm 单开门', '1500mm 标准窗', '客餐厅热区']);
});

test('viewer component catalog includes required HVAC equipment templates', () => {
  const catalog = new ViewerComponentCatalogService().list();
  const hvacLabels = catalog.templates
    .filter((item) => item.category === 'hvac-equipment')
    .map((item) => item.label);

  assert.deepEqual(hvacLabels, [
    '空气源热泵',
    '燃气壁挂炉',
    '风机盘管 FCU',
    '散热器',
    '地暖盘管',
    '新风主机 AHU',
    '风口',
    '温控器',
    '分集水器',
  ]);
});

test('viewer component catalog includes pipe route templates and BOM hints', () => {
  const catalog = new ViewerComponentCatalogService().list();
  const pipeTemplates = catalog.templates.filter((item) => item.category === 'pipe');

  assert.deepEqual(
    pipeTemplates.map((item) => item.label),
    ['冷媒管', '风管', '地暖管', '冷凝水管']
  );
  for (const item of catalog.templates) {
    assert.ok(item.systemKey);
    assert.ok(Object.keys(item.defaultDimensions).length > 0);
    assert.ok(item.editableProperties.length > 0);
    assert.ok(item.bomMapping.category);
    assert.ok(item.bomMapping.skuPrefix);
    assert.ok(item.bomMapping.measurementKey);
  }
});
