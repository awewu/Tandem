const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('unified 4003 viewer shell contract', () => {
  test('/viewer renders the unified dark three-column React workbench first', () => {
    const page = read('apps/designer-workbench/src/app/viewer/page.tsx');
    const layout = read('apps/designer-workbench/src/app/layout.tsx');
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(page).toContain('<ViewerParams />');
    expect(page).toContain('bg-[#f7f9fc]');
    for (const font of [
      'PingFang SC',
      'Microsoft YaHei',
      'Noto Sans CJK SC',
      'Source Han Sans SC',
      'sans-serif',
    ]) {
      expect(layout).toContain(font);
    }
    expect(shell).toContain('data-viewer-shell="unified-dark-three-column"');
    expect(shell).toContain('grid-cols-[300px_minmax(0,1fr)_320px]');
    expect(shell).toContain('项目信息');
    expect(shell).toContain('构件检查器');
  });

  test('viewer inputs and persisted draft API cover project, building and system state', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const service = read('services/api/src/modules/rysnova-bim/viewer-draft.service.ts');
    const migration = read('database/postgres/migrations/042_viewer_design_drafts.sql');

    for (const field of [
      '项目名称',
      '城市',
      '建筑面积',
      '楼层数',
      '层高',
      '房间数',
      '制冷系统',
      '采暖系统',
    ]) {
      expect(shell).toContain(field);
    }
    expect(api).toContain('/api/v2/rysnova-bim/viewer-drafts');
    expect(service).toContain('withRlsTransaction');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS rhautt_nexus.viewer_design_drafts');
    expect(migration).toContain('project_inputs jsonb');
    expect(migration).toContain('building_inputs jsonb');
    expect(migration).toContain('system_inputs jsonb');
    expect(migration).toContain('generated_model jsonb');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
  });

  test('viewer can generate persisted selectable HVAC model layers', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewport = read('apps/designer-workbench/src/app/viewer/GeneratedHvacViewport.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const service = read('services/api/src/modules/rysnova-bim/viewer-draft.service.ts');

    expect(shell).toContain('生成暖通模型');
    expect(shell).toContain('<GeneratedHvacViewport');
    expect(shell).toContain('生成模型控制');
    expect(shell).toContain('选中构件属性');
    expect(shell).toContain('制冷');
    expect(shell).toContain('采暖');
    expect(shell).toContain('新风');
    expect(shell).toContain('管道');
    expect(shell).toContain('设备');
    expect(viewport).toContain('data-generated-hvac-viewport');
    expect(viewport).toContain('Raycaster');
    expect(viewport).toContain("component.type === 'pipe-route'");
    expect(viewport).toContain("component.type === 'equipment'");
    expect(api).toContain('/generated-model');
    expect(service).toContain('generateParametricHvacModel');
    expect(service).toContain('bomMappableComponentIds');
    expect(service).toContain("systemKey: 'cooling'");
    expect(service).toContain("systemKey: 'heating'");
    expect(service).toContain("systemKey: 'freshAir'");
  });

  test('IFC loading remains inside React through the shared BIM viewer boundary', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewer = read('packages/bim-viewer/index.tsx');

    expect(shell).toContain("from '@rhautt/bim-viewer'");
    expect(shell).toContain('<BimViewer');
    expect(shell).toContain('artifactId={artifactId}');
    expect(shell).not.toContain('<iframe');
    expect(viewer).toContain('type="file"');
    expect(viewer).toContain('accept=".ifc,.glb,.gltf"');
    expect(viewer).toContain("artifactEndpoint = '/api/v2/file-artifact/{id}/base64'");
  });

  test('IFC/GLB model-source parity is persisted and surfaced in the unified viewer', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewer = read('packages/bim-viewer/index.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const service = read('services/api/src/modules/rysnova-bim/viewer-model-source.service.ts');
    const migration = read('database/postgres/migrations/043_viewer_model_sources.sql');

    expect(viewer).toContain('GLTFLoader');
    expect(viewer).toContain("return 'ifc'");
    expect(viewer).toContain("return 'glb'");
    expect(viewer).toContain('onModelEvent');
    expect(shell).toContain('handleModelEvent');
    expect(shell).toContain('模型来源');
    expect(shell).toContain('模型对象');
    expect(api).toContain('/api/v2/rysnova-bim/model-sources');
    expect(service).toContain('withRlsTransaction');
    expect(service).toContain('inferModelType');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS rhautt_nexus.viewer_model_sources');
    expect(migration).toContain("source_type text NOT NULL CHECK (source_type IN ('generated','local-upload','artifact'))");
    expect(migration).toContain("model_type text NOT NULL DEFAULT 'unknown' CHECK (model_type IN ('ifc','glb','generated','unknown'))");
    expect(migration).toContain('component_summary jsonb');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
  });
});
