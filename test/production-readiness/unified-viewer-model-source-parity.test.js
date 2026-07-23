const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Issue 04 - IFC/GLB source parity and model records', () => {
  test('shared BIM viewer treats explicit artifact modelType as first-class IFC/GLB metadata', () => {
    const viewer = read('packages/bim-viewer/index.tsx');

    expect(viewer).toContain("lowerName === 'ifc'");
    expect(viewer).toContain("lowerName === 'glb'");
    expect(viewer).toContain("lowerName === 'gltf'");
    expect(viewer).toContain('payload?.sourceMetadata?.modelType');
    expect(viewer).toContain('GLTFLoader');
    expect(viewer).toContain('accept=".ifc,.glb,.gltf"');
    expect(viewer).toContain('onModelEvent?.({');
  });

  test('viewer model-source persistence keeps generated local-upload and artifact sources comparable', () => {
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const service = read('services/api/src/modules/rysnova-bim/viewer-model-source.service.ts');
    const migration = read('database/postgres/migrations/043_viewer_model_sources.sql');

    expect(api).toContain(
      "export type ViewerModelSourceType = 'generated' | 'local-upload' | 'artifact'"
    );
    expect(api).toContain("export type ViewerModelType = 'ifc' | 'glb' | 'generated' | 'unknown'");
    expect(service).toContain('inferModelType');
    expect(service).toContain("sourceType === 'artifact'");
    expect(service).toContain("sourceType === 'local-upload'");
    expect(migration).toContain(
      "source_type text NOT NULL CHECK (source_type IN ('generated','local-upload','artifact'))"
    );
    expect(migration).toContain(
      "model_type text NOT NULL DEFAULT 'unknown' CHECK (model_type IN ('ifc','glb','generated','unknown'))"
    );
    expect(migration).toContain('artifact_id text');
    expect(migration).toContain('upload_reference jsonb');
    expect(migration).toContain('load_status text NOT NULL DEFAULT');
  });

  test('IFC/GLB imported sources appear as object-tree source nodes without loader rewrites', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const viewer = read('packages/bim-viewer/index.tsx');

    expect(shell).toContain('data-model-object-tree-panel="true"');
    expect(shell).toContain('IFC/GLB 导入模型');
    expect(shell).toContain('modelSourceName(source)');
    expect(shell).toContain('source.modelType === \'ifc\'');
    expect(shell).toContain('source.modelType === \'glb\'');
    expect(shell).toContain("source.sourceType === 'local-upload'");
    expect(shell).toContain("source.sourceType === 'artifact' && source.modelType !== 'generated'");
    expect(shell).toContain('componentSummary?.objectCount ?? 0');
    expect(shell).toContain('记录 ${source.id.slice(0, 8)}');
    expect(shell).toContain('isInternalIdLabel(rawName)');
    expect(shell).toContain('name: event.name');
    expect(shell).toContain("event.phase === 'error' && event.modelType === 'unknown'");
    expect(shell).toContain('ID ${component.id.slice(0, 8)}');
    expect(viewer).toContain('loadModelBuffer');
    expect(viewer).not.toContain('buildModelObjectTree');
    expect(viewer).not.toContain('viewerDrafts.updateComponent');
  });
});
