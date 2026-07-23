const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('legacy designer 2D to 3D conversion contract', () => {
  test('legacy designer 2D source shape is documented before conversion code', () => {
    const doc = read('docs/dev/legacy-designer-2d-data-shape.md');

    expect(doc).toContain('apps/consumer-diagnosis/public/designer.html');
    expect(doc).toContain('GRID = 50');
    expect(doc).toContain('walls: Array<{ id: string; points: number[] }>');
    expect(doc).toContain('devices: Array<{ id: string; type: string; x: number; y: number; rotation?: number }>');
    expect(doc).toContain('pipes: Array<{ id: string; type: string; points: number[] }>');
    expect(doc).toContain('does not depend on `4003/floor-plan`');
  });

  test('backend conversion uses viewer draft storage and expanded component contract', () => {
    const service = read('services/api/src/modules/rysnova-bim/viewer-draft.service.ts');
    const controller = read('services/api/src/modules/rysnova-bim/viewer-draft.controller.ts');
    const converter = read('services/api/src/modules/rysnova-bim/legacy-designer-2d-converter.ts');

    expect(controller).toContain("@Post(':id/legacy-designer-2d-conversion')");
    expect(service).toContain('convertLegacyDesigner2d');
    expect(service).toContain('draft.generatedModel = model');
    expect(service).toContain('stampComponentContext(item, draft, model, nextVersion)');
    for (const type of ['wall', 'door', 'window', 'room-zone', 'equipment', 'pipe-route', 'duct-route']) {
      expect(converter).toContain(type);
    }
    expect(converter).not.toContain('floor-plan');
  });

  test('viewer exposes migrated 2D drawing selection flow without using floor-plan page', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');

    expect(shell).toContain('data-legacy-designer-2d-import="true"');
    expect(shell).toContain('导入 4001 2D 图纸');
    expect(shell).toContain('importLegacyDesigner2d');
    expect(shell).toContain('convertLegacyDesigner2d');
    expect(api).toContain('/legacy-designer-2d-conversion');
    const conversionBlock = shell.slice(
      shell.indexOf('const importLegacyDesigner2d'),
      shell.indexOf('const handleModelEvent')
    );
    expect(conversionBlock).not.toContain('/floor-plan');
  });
});
