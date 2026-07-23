const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('unified viewer component catalog contract', () => {
  test('left panel switches between project parameters and backend component catalog', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');

    expect(shell).toContain("leftPanelMode, setLeftPanelMode");
    expect(shell).toContain('data-left-panel-switch="viewer-parameters-catalog"');
    expect(shell).toContain('项目参数');
    expect(shell).toContain('构件库');
    expect(shell).toContain('data-left-panel-mode="component-catalog"');
    expect(shell).toContain('viewerComponentCatalog');
    expect(shell).toContain('.list()');
    expect(api).toContain('/api/v2/rysnova-bim/component-catalog');
  });

  test('backend seed catalog exposes required categories and route registration', () => {
    const service = read('services/api/src/modules/rysnova-bim/viewer-component-catalog.service.ts');
    const controller = read(
      'services/api/src/modules/rysnova-bim/viewer-component-catalog.controller.ts'
    );
    const module = read('services/api/src/modules/rysnova-bim/rysnova-bim.module.ts');

    for (const category of ['wall', 'door', 'window', 'room-zone', 'hvac-equipment', 'pipe']) {
      expect(service).toContain(`'${category}'`);
    }
    expect(service).toContain("source: 'seed-global-defaults'");
    expect(service).toContain('tenant-editable catalog rows');
    expect(controller).toContain("@Controller('rysnova-bim/component-catalog')");
    expect(module).toContain('ViewerComponentCatalogController');
    expect(module).toContain('ViewerComponentCatalogService');
  });

  test('catalog contains full HVAC and pipe template set with editable BOM mapping metadata', () => {
    const service = read('services/api/src/modules/rysnova-bim/viewer-component-catalog.service.ts');

    for (const label of [
      '空气源热泵',
      '燃气壁挂炉',
      '风机盘管 FCU',
      '散热器',
      '地暖盘管',
      '新风主机 AHU',
      '风口',
      '温控器',
      '分集水器',
      '冷媒管',
      '风管',
      '地暖管',
      '冷凝水管',
    ]) {
      expect(service).toContain(label);
    }
    expect(service).toContain('defaultDimensions');
    expect(service).toContain('editableProperties');
    expect(service).toContain('bomMapping');
    expect(service).toContain('skuPrefix');
    expect(service).toContain('measurementKey');
    expect(service).toContain('openingDirection');
    expect(service).toContain('installMethod');
    expect(service).toContain('material');
  });

  test('tool palette exposes Chinese design categories and editable default state', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(shell).toContain("type ToolPaletteMode = 'layout' | 'equipment' | 'pipe' | 'annotation' | 'edit'");
    expect(shell).toContain('data-tool-palette-rail="viewer-component-library"');
    expect(shell).toContain('data-tool-palette-segmented="布局,设备,管路,标注,编辑"');
    expect(shell).toContain("label: '布局'");
    expect(shell).toContain("label: '设备'");
    expect(shell).toContain("label: '管路'");
    expect(shell).toContain("label: '标注'");
    expect(shell).toContain("label: '编辑'");
    expect(shell).toContain('data-template-default-editor');
    expect(shell).toContain('data-template-click-place');
    expect(shell).toContain('放置到视图中心');
    expect(shell).toContain('templateDefaultOverrides');
    expect(shell).toContain('onUpdateTemplateDefault');
    expect(shell).toContain('onPlaceTemplate');
    expect(shell).toContain('templateDefaultSummary(template, overrides)');
    expect(shell).toContain('displayTemplateName(template, overrides)');
    expect(shell).not.toContain('来源：{props.catalog.source}');
    expect(shell).not.toContain('templatePlacementHint(template)');
    expect(shell).not.toContain('拖入视图');
    expect(shell).not.toContain(" / BOM{' '}");
    expect(shell).not.toContain('BOM {template.bomMapping.skuPrefix}');
  });

  test('template cards expose stable selection and drag identifiers for placement', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');
    const placement = read('apps/designer-workbench/src/app/viewer/viewer-component-placement.ts');

    expect(shell).toContain('data-selected-template-id');
    expect(shell).toContain('data-component-template-id');
    expect(shell).toContain('data-component-template-type');
    expect(shell).toContain('data-component-template-system');
    expect(shell).toContain('data-template-model-glyph');
    expect(shell).toContain('data-template-drag-model-preview');
    expect(shell).toContain('setDragImage(renderTemplateDragPreview(template)');
    expect(shell).toContain('application/x-rysnova-component-template');
    expect(shell).toContain('event.dataTransfer.setData');
    expect(shell).toContain('onTemplateDrop={placeCatalogTemplateInViewport}');
    expect(shell).toContain('viewerDrafts.createComponent(draftId, payload)');
    expect(shell).toContain('setSelectedComponent(placed)');
    expect(viewport).toContain('pointOnPipePlane(raycaster,');
    expect(viewport).toContain('new THREE.Plane(new THREE.Vector3(0, 1, 0), -dropElevation)');
    expect(viewport).toContain('dataset.lastDropPoint');
    expect(viewport).toContain('constrainPlacementPoint');
    expect(viewport).toContain('dataset.placementCandidate');
    expect(viewport).toContain('dataset.placementConstraintState');
    expect(viewport).toContain('onTemplateDropRef.current?.(transfer, constrainedPoint)');
    expect(viewport).toContain('addComponentModelDetails(group, component');
    expect(viewport).toContain("component.type === 'equipment'");
    expect(placement).toContain('componentPayloadFromCatalogTemplate');
    expect(placement).toContain("placedBy: 'viewer-drag-to-place'");
    expect(placement).toContain("sourceTemplateId: template.id");
    expect(placement).toContain('bomMetadata');
    expect(placement).toContain('CatalogTemplateDefaultOverrides');
    expect(placement).toContain('templateWithDefaultOverrides');
    expect(placement).toContain('templateDefaultOverrides: defaultOverrides');
    expect(shell).toContain('templateDefaultOverrides[template.id] ?? {}');
    expect(shell).toContain('void placeCatalogTemplateInViewport(template.id, { x: 0, y: 0, z: 0 })');
  });

  test('backend catalog preserves required starter cards for the formal palette', () => {
    const service = read('services/api/src/modules/rysnova-bim/viewer-component-catalog.service.ts');

    for (const label of ['200mm 标准墙体', '900mm 单开门', '1500mm 标准窗', '客餐厅热区']) {
      expect(service).toContain(label);
    }
  });
});
