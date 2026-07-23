const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('unified viewer model CRUD workflow contract', () => {
  test('viewer exposes model create open save duplicate rename archive and delete actions', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    for (const label of ['新建', '保存', '重命名', '复制', '归档', '删除']) {
      expect(shell).toContain(`label="${label}"`);
    }
    expect(shell).toContain('模型库');
    expect(shell).toContain('openModelRecord');
    expect(shell).toContain('includeArchivedModels');
    expect(shell).toContain('generatedModelSnapshot');
    expect(shell).toContain('modelFromModelSource(opened)');
    expect(shell).toContain('setGeneratedModel(openedGeneratedModel)');
  });

  test('viewer replaces source debug card with model object tree layer management', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(shell).toContain('data-model-object-tree-panel="true"');
    expect(shell).toContain('模型对象树 / 图层');
    for (const group of [
      '当前项目',
      '生成模型',
      '手工构件',
      '墙体',
      '门窗',
      '房间/区域',
      '设备',
      '管线',
      'IFC/GLB 导入模型',
    ]) {
      expect(shell).toContain(group);
    }
    expect(shell).toContain('componentBusinessName(component)');
    expect(shell).toContain('modelSourceName(source)');
    expect(shell).toContain('onSelectComponent={selectComponentFromTree}');
    expect(shell).toContain('onOpenSource={openModelRecord}');
    expect(shell).toContain("visibility: component.visibility === 'hidden' ? 'visible' : 'hidden'");
    expect(shell).toContain('{ locked: !component.locked }');
    expect(shell).toContain('viewerDrafts.updateComponent(draftId, component.id');
    expect(shell).toContain('isImportedModelSource');
    expect(shell).toContain('source.modelType === \'ifc\'');
    expect(shell).toContain('source.modelType === \'glb\'');
    expect(shell).toContain('ID ${component.id.slice(0, 8)}');
  });

  test('model source API exposes full CRUD endpoints and audit guards', () => {
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const controller = read(
      'services/api/src/modules/rysnova-bim/viewer-model-source.controller.ts'
    );
    const service = read('services/api/src/modules/rysnova-bim/viewer-model-source.service.ts');

    expect(api).toContain('/api/v2/rysnova-bim/model-sources');
    expect(api).toContain('duplicate:');
    expect(api).toContain('rename:');
    expect(api).toContain('archive:');
    expect(api).toContain('delete:');
    expect(controller).toContain("@Post(':id/duplicate')");
    expect(controller).toContain("@Patch(':id/name')");
    expect(controller).toContain("@Post(':id/archive')");
    expect(controller).toContain("@Delete(':id')");
    expect(service).toContain('isAuditProtected');
    expect(service).toContain('audit-linked model sources must be archived');
  });

  test('PostgreSQL model records include CRUD status and archival timestamps', () => {
    const entity = read('services/api/src/modules/rysnova-bim/viewer-model-source.entity.ts');
    const migration = read('database/postgres/migrations/045_viewer_model_crud_columns.sql');

    expect(entity).toContain(
      "export type ViewerModelRecordStatus = 'active' | 'archived' | 'deleted'"
    );
    expect(entity).toContain('name: string | null');
    expect(entity).toContain('recordStatus');
    expect(entity).toContain('archivedAt');
    expect(entity).toContain('deletedAt');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS name text');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS record_status text NOT NULL DEFAULT');
    expect(migration).toContain("CHECK (record_status IN ('active','archived','deleted'))");
  });
});
