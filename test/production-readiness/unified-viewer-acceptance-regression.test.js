const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

describe('unified viewer final acceptance and regression QA contract', () => {
  test('browser acceptance smoke covers desktop and narrow viewer rendering quality', () => {
    const script = read('apps/designer-workbench/scripts/viewer-acceptance-smoke.js');
    const pkg = JSON.parse(read('apps/designer-workbench/package.json'));

    expect(pkg.scripts['acceptance:viewer']).toBe('node scripts/viewer-acceptance-smoke.js');
    expect(script).toContain("BASE_URL = process.env.VIEWER_ACCEPTANCE_BASE_URL || 'http://127.0.0.1:4003'");
    expect(script).toContain("{ name: 'desktop', width: 1440, height: 980 }");
    expect(script).toContain("{ name: 'narrow', width: 390, height: 844 }");
    expect(script).toContain('/viewer');
    expect(script).toContain('[data-viewer-shell="unified-dark-three-column"]');
    expect(script).toContain('panelsOverlap');
    expect(script).toContain('viewer canvas appears blank');
    expect(script).toContain('narrow viewer overflows horizontally');
    expect(script).toContain('viewer-two-floor-riser.fixture.json');
    expect(script).toContain('viewer-two-floor-riser-${viewport.name}.png');
    expect(script).toContain('webglCanvasProbe');
    expect(script).toContain('gl.readPixels');
    expect(script).toContain('inspectSideElevationRiserVisibility');
    expect(script).toContain('side-elevation-vertical-riser-projection');
    expect(script).toContain('inspectFloorIsolationRiserSmoke');
    expect(script).toContain('pipe-logical-two-floor-route');
    expect(script).toContain('riser-down marker');
    expect(script).toContain('riser-up marker');
    expect(script).toContain('all-floor logical route did not preserve the vertical riser segment');
  });

  test('two-floor riser fixture is available for viewer visual acceptance prep', () => {
    const fixture = JSON.parse(read('apps/designer-workbench/fixtures/viewer-two-floor-riser.fixture.json'));
    const fixtureTest = read('apps/designer-workbench/test/viewer-two-floor-riser-fixture.nodetest.cts');

    expect(fixture.acceptancePath).toEqual([
      'equipment-2f-indoor',
      'pipe-2f-horizontal',
      'pipe-vertical-riser',
      'pipe-1f-horizontal',
      'equipment-1f-utility',
    ]);
    expect(fixture.expectedVerticalSegment).toEqual(expect.objectContaining({
      componentId: 'pipe-vertical-riser',
      axis: 'y',
      minDeltaM: expect.any(Number),
      fromFloor: 2,
      toFloor: 1,
    }));
    expect(fixture.model.components.some((component) => component.locked)).toBe(true);
    expect(fixture.model.componentSummary.bomMappableComponentIds).toContain('pipe-vertical-riser');
    expect(fixture.model.components.find((component) => component.id === 'pipe-logical-two-floor-route').route)
      .toEqual(expect.objectContaining({
        kind: 'logical-route',
        crossFloorTransitions: [expect.objectContaining({ kind: 'riser', fromFloor: 2, toFloor: 1 })],
      }));
    expect(fixtureTest).toContain('two-floor riser fixture preserves the acceptance path ordering');
    expect(fixtureTest).toContain('two-floor riser fixture includes a vertical pipe segment visible from elevation views');
    expect(fixtureTest).toContain('two-floor riser fixture includes a single logical route for floor isolation markers');
  });

  test('Chinese browser rendering contract rejects mojibake and requires a Chinese-capable font stack', () => {
    const script = read('apps/designer-workbench/scripts/viewer-acceptance-smoke.js');
    const layout = read('apps/designer-workbench/src/app/layout.tsx');
    const nav = read('apps/designer-workbench/src/components/NavBar.tsx');
    const auth = read('apps/designer-workbench/src/components/AuthProvider.tsx');
    const renderedSources = [layout, nav, auth].join('\n');

    expect(layout).toContain('<html lang="zh-CN">');
    expect(layout).toContain('PingFang SC');
    expect(layout).toContain('设计师工作台 · 瑞诺瓦');
    expect(nav).toContain('瑞诺瓦 · 设计师工作台');
    expect(auth).toContain('正在跳转统一登录入口…');
    expect(script).toContain('Chinese-capable font stack missing');
    expect(script).toContain('rendered text contains mojibake or missing-glyph markers');
    expect(renderedSources).not.toMatch(/(?:鐟|鈥|鍥|璁|鏂|涓|绋|绠|甯|閫|闂|煎|濂|�|\ufffd)/);
  });

  test('IFC model loading remains covered through the shared viewer file-input boundary', () => {
    const viewer = read('packages/bim-viewer/index.tsx');
    const script = read('apps/designer-workbench/scripts/viewer-acceptance-smoke.js');
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(viewer).toContain("import { IfcAPI } from 'web-ifc'");
    expect(viewer).toContain("accept=\".ifc,.glb,.gltf\"");
    expect(viewer).toContain('loadIfcBuffer');
    expect(viewer).toContain('onModelEvent?.({ phase:');
    expect(shell).toContain('handleModelEvent');
    expect(script).toContain('local IFC loading boundary is missing file input support');
    expect(script).toContain("includes('.ifc')");
  });

  test('IFC/GLB imported model viewing controls and recoverable errors stay protected', () => {
    const viewer = read('packages/bim-viewer/index.tsx');
    const script = read('apps/designer-workbench/scripts/viewer-acceptance-smoke.js');
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(viewer).toContain('GLTFLoader');
    expect(viewer).toContain('OrbitControls');
    expect(viewer).toContain('controls.target.copy(center)');
    expect(viewer).toContain('onClick={fitCamera}');
    expect(viewer).toContain('载入失败：${message}');
    expect(viewer).toContain('成果载入失败：${message}');
    expect(viewer).toContain("phase: 'error'");
    expect(viewer).toContain('旋转、缩放、平移');
    expect(shell).toContain('IFC/GLB 导入模型');
    expect(shell).toContain('modelSourceName(source)');
    expect(shell).toContain("event.phase === 'error' && event.modelType === 'unknown'");
    expect(script).toContain('local GLB loading boundary is missing file input support');
    expect(script).toContain('model object tree panel is missing');
    expect(script).toContain('imported model fit view control is missing');
  });

  test('generated HVAC viewport recovers camera control after property and drag interactions', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');

    expect(shell).toContain('clearPropertyEditing');
    expect(shell).toContain('rotateSelectedComponentBy');
    expect(shell).toContain('saveSelectedComponentProperties');
    expect(viewport).toContain('restoreCameraControls');
    expect(viewport).toContain('pointercancel');
    expect(viewport).toContain('pointerCaptureReleased');
    expect(viewport).toContain('cameraControlsRestored');
    expect(viewport).toContain('dragend');
    expect(viewport).toContain('document.activeElement.blur()');
  });

  test('generated HVAC viewport supports multi-point logical route drafting controls', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');
    const placement = read('apps/designer-workbench/src/app/viewer/viewer-component-placement.ts');

    expect(shell).toContain('draftRoutePoints');
    expect(shell).toContain('data-route-draft-controls="true"');
    expect(shell).toContain('Finish route');
    expect(shell).toContain('Undo point');
    expect(shell).toContain('Cancel route');
    expect(shell).toContain('buildLogicalRouteShapeFromDraft');
    expect(shell).toContain('routeDraftCanFinish(draftRoutePoints)');
    expect(viewport).toContain('appendOrthogonalRouteDraftPoint');
    expect(viewport).toContain('pendingDraftRoutePoint');
    expect(viewport).not.toContain('let drawingStart');
    expect(viewport).toContain('routeDraftPointAtPointer');
    expect(viewport).toContain("component.type === 'equipment'");
    expect(viewport).toContain('routeDraftPlane');
    expect(viewport).toContain('routeDraftPointCount');
    expect(viewport).toContain('route-bend-point-handle');
    expect(viewport).toContain('route-segment-insert-handle');
    expect(viewport).toContain('deleteIntermediateRoutePoint');
    expect(viewport).toContain('insertRoutePointOnSegment');
    expect(viewport).toContain('moveRoutePoint');
    expect(shell).toContain('data-active-route-floor-select="true"');
    expect(shell).toContain('data-route-riser-confirm="true"');
    expect(shell).toContain('routeContinuationComponentId');
    expect(shell).toContain('viewerDrafts.addRiser');
    expect(viewport).toContain("editModeRef.current === 'add-riser'");
    expect(viewport).toContain('dataset.lastRiserPoint');
    expect(placement).toContain('crossFloorTransitions: []');
    expect(placement).toContain("planeAxes: ['x', 'z']");
    expect(placement).toContain("ySemantics: 'absolute-model-elevation-m'");
  });

  test('viewer acceptance smoke exercises route mode undo finish and refresh persistence seam', () => {
    const script = read('apps/designer-workbench/scripts/viewer-acceptance-smoke.js');

    expect(script).toContain('inspectRouteDraftAuthoringSmoke');
    expect(script).toContain('[data-route-draft-controls="true"]');
    expect(script).toContain('Finish route');
    expect(script).toContain('Undo point');
    expect(script).toContain('routeDraftPointCount');
    expect(script).toContain('created-route-smoke-01');
    expect(script).toContain('moveSelectedRoutePointSmoke');
    expect(script).toContain('insertSelectedRoutePointSmoke');
    expect(script).toContain('deleteSelectedIntermediateRoutePointSmoke');
    expect(script).toContain('addManualRiserContinuationSmoke');
    expect(script).toContain('[data-pipe-edit-mode="add-riser"]');
    expect(script).toContain('[data-route-riser-confirm="true"]');
    expect(script).toContain('manual riser continuation did not preserve a constant x/z vertical segment');
    expect(script).toContain('selectedRoutePoints2d');
    expect(script).toContain('route edit smoke geometry was not preserved after refresh');
    expect(script).toContain('route refresh did not preserve smoke-created route');
    expect(script).toContain('inspectRouteConnectionSmoke');
    expect(script).toContain('routeConnectionStatus');
    expect(script).toContain('route connection smoke did not preserve endpoint refs after refresh');
    expect(script).toContain('route connection smoke did not follow moved equipment endpoint after refresh');
  });

  test('PE1 viewport toolbar owns floor isolation and edit tool state order', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(shell).toContain('data-viewer-viewport-toolbar="true"');
    expect(shell).toContain('sticky top-0 z-20');
    expect(shell).toContain('overflow-x-auto');
    for (const order of [
      '01-undo',
      '02-redo',
      '03-floor',
      '04-single-floor',
      '05-all-floors',
      '06-select',
      '07-draw-pipe',
      '08-move-component',
      '09-edit-pipe',
      '10-add-riser',
      '11-delete',
    ]) {
      expect(shell).toContain(`data-viewer-toolbar-order={props.order}`);
      expect(shell).toContain(`order="${order}"`);
    }
    expect(shell).toContain('data-active-route-floor-select="true"');
    expect(shell).toContain('data-floor-isolation-controls="true"');
    expect(shell).toContain('aria-label={props.tooltip}');
    expect(shell).toContain('title={props.tooltip}');
    expect(shell).toContain('focus-visible:ring-2');
    expect(shell).toContain('data-toolbar-busy={props.busy ?');
    expect(shell).toContain('hasValidRiserTargetFloor');
    expect(shell).toContain('canAddRiserFromToolbar');
    expect(shell).toContain('canDeleteSelectedEditableObject');
    expect(shell).toContain("(selectedComponent.status ?? 'active') !== 'deleted'");
    expect(shell).toContain('data-toolbar-group="delete"');
    expect(shell).toContain('border-l border-red-200');
    expect(shell).toContain('disabled={props.busy || !props.canAddRiser}');
    expect(shell).toContain('disabled={props.busy || !props.canDeleteSelected}');
  });

  test('database-backed draft model summary and downstream handoff regressions are covered', () => {
    for (const rel of [
      'test/production-readiness/unified-viewer-shell.test.js',
      'test/production-readiness/unified-viewer-summary.test.js',
      'test/production-readiness/unified-viewer-model-crud.test.js',
      'test/production-readiness/unified-viewer-handoff.test.js',
      'test/production-readiness/unified-viewer-selected-component-editing.test.js',
      'services/api/src/modules/rysnova-bim/viewer-draft.nodetest.ts',
      'services/api/src/modules/rysnova-bim/viewer-model-source.nodetest.ts',
      'services/api/src/modules/rysnova-bim/viewer-summary.nodetest.ts',
    ]) {
      expect(exists(rel)).toBe(true);
    }

    const handoff = read('test/production-readiness/unified-viewer-handoff.test.js');
    const summary = read('test/production-readiness/unified-viewer-summary.test.js');
    const crud = read('test/production-readiness/unified-viewer-model-crud.test.js');

    expect(summary).toContain('calculation_summary jsonb');
    expect(summary).toContain('equipment_summary jsonb');
    expect(summary).toContain('pipe_summary jsonb');
    expect(crud).toContain('record_status');
    expect(handoff).toContain('viewerDrafts.get(nextDraftId)');
    expect(handoff).toContain('viewerSummaries.get(nextSummaryId)');
    expect(handoff).toContain('quotation.generate');
  });

  test('legacy 4001 designer URL remains redirect-only and viewer implementation uses no iframe', () => {
    const consumerRedirect = read('apps/consumer-diagnosis/public/rysnova-bim-designer.html');
    const archiveRedirect = read('archive/legacy-ui/public/rysnova-bim-designer.html');
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    for (const html of [consumerRedirect, archiveRedirect]) {
      expect(html).toContain("new URL('/viewer'");
      expect(html).toContain("target.port = '4003'");
      expect(html).toContain('window.location.replace(redirectUrl)');
      expect(html).toContain('projectId');
      expect(html).toContain('contractId');
      expect(html).toContain('opportunityId');
      expect(html).toContain('artifactId');
      expect(html).not.toContain('<iframe');
      expect(html).not.toContain('new THREE.WebGLRenderer');
    }

    expect(shell).toContain('data-viewer-shell="unified-dark-three-column"');
    expect(shell).not.toContain('<iframe');
  });
});
