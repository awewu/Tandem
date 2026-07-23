const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('unified viewer summary persistence contract', () => {
  test('viewer right panel hides persistent summary cards while summary contract remains available', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');
    const summary = read('apps/designer-workbench/src/app/viewer/viewer-summary.ts');
    const rightInspector = shell.slice(shell.lastIndexOf('<aside'), shell.lastIndexOf('</aside>'));

    expect(rightInspector).not.toContain('负荷计算');
    expect(rightInspector).not.toContain('冷负荷');
    expect(rightInspector).not.toContain('热负荷');
    expect(rightInspector).not.toContain('设备清单');
    expect(rightInspector).not.toContain('管道统计');
    expect(rightInspector).toContain('规范合规');
    expect(summary).toContain("export type SummaryTrustStatus = 'estimate' | 'verified'");
    expect(summary).toContain(
      "export type ComplianceState = 'pending' | 'warning' | 'failed' | 'passed'"
    );
    expect(summary).toContain('calculationSummary');
    expect(summary).toContain('equipmentSummary');
    expect(summary).toContain('pipeSummary');
  });

  test('summary persistence API and migration store all database-backed summary sections', () => {
    const api = read('apps/designer-workbench/src/lib/api.ts');
    const service = read('services/api/src/modules/rysnova-bim/viewer-summary.service.ts');
    const migration = read('database/postgres/migrations/044_viewer_design_summaries.sql');

    expect(api).toContain('/api/v2/rysnova-bim/viewer-summaries');
    expect(service).toContain('withRlsTransaction');
    expect(service).toContain('ViewerDesignDraftEntity');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS rhautt_nexus.viewer_design_summaries');
    expect(migration).toContain('draft_version integer');
    expect(migration).toContain('model_version integer');
    expect(migration).toContain('calculation_summary jsonb');
    expect(migration).toContain('equipment_summary jsonb');
    expect(migration).toContain('pipe_summary jsonb');
    expect(migration).toContain('compliance_summary jsonb');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
  });

  test('equipment rows preserve linked component ids when generated model components exist', () => {
    const summary = read('apps/designer-workbench/src/app/viewer/viewer-summary.ts');

    expect(summary).toContain('linkedComponentId');
    expect(summary).toContain("component.status !== 'deleted'");
    expect(summary).toContain('rollupComponents');
    expect(summary).toContain('Hidden only affects viewer display');
    expect(summary).toContain("findComponent(activeComponents, 'cooling', 'equipment')");
    expect(summary).toContain("component.type === 'pipe-route'");
    expect(summary).toContain("component.type === 'duct-route'");
    expect(summary).toContain('component.bomMetadata?.estimatedLengthM');
    expect(summary).toContain('component.dimensions?.estimatedLengthM');
    expect(summary).toContain('linkedComponentIds');
    expect(summary).toContain('routes: ViewerPipeRouteRow[]');
    expect(summary).toContain('pipeRouteRowFromComponent');
  });

  test('manual component BOM metadata is summarized for persisted downstream handoff', () => {
    const summary = read('apps/designer-workbench/src/app/viewer/viewer-summary.ts');
    const viewer = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(summary).toContain("source: 'model-component'");
    expect(summary).toContain('equipmentRowFromComponent');
    expect(summary).toContain('linkedModelId');
    expect(summary).toContain('linkedModelVersion');
    expect(summary).toContain('componentVersion');
    expect(summary).toContain('name: componentDisplayName(component)');
    expect(summary).toContain('dimensions: component.dimensions');
    expect(summary).toContain('businessMetadata.capacityKw');
    expect(summary).toContain('bomMetadata: component.bomMetadata');
    expect(summary).toContain('businessMetadata: component.businessMetadata');
    expect(summary).toContain('isGeneratedPrimaryEquipment');
    expect(viewer).toContain('bomMetadata: {');
    expect(viewer).toContain("quantity: lengthM");
    expect(viewer).toContain("unit: 'm'");
  });

  test('normal modeling inspector no longer renders equipment summary rows', () => {
    const viewer = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(viewer).not.toContain('displayEquipmentRowName(row)');
    expect(viewer).not.toContain('displayEquipmentRowStatus(row)');
    expect(viewer).toContain('isTechnicalEquipmentLabel');
    expect(viewer).toContain('/^(manual|hvac|component|template|bom)[-_]/i.test(text)');
    expect(viewer).toContain('isInternalIdLabel(text)');
    expect(viewer).not.toContain('已关联构件 ${row.linkedComponentId}');
  });
});
