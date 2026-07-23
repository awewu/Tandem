const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('unified viewer database-backed downstream handoff contract', () => {
  test('viewer keeps downstream handoff identifiers without rendering database context cards', () => {
    const shell = read('apps/designer-workbench/src/app/viewer/ViewerParams.tsx');

    expect(shell).not.toContain('数据库上下文联动');
    expect(shell).not.toContain('/floor-plan?');
    expect(shell).not.toContain('/bom?handoff=bom');
    expect(shell).not.toContain('/bom?handoff=quote');
    expect(shell).toContain('persistViewerSummary');
    expect(shell).toContain('viewerSummaries.save');
    expect(shell).toContain('modelBinding');
    expect(shell).toContain('modelSources.save');
    expect(shell).toContain('...modelBinding');
  });

  test('2D page reloads viewer context through v2 APIs and surfaces stale or missing state', () => {
    const floorPlan = read('apps/designer-workbench/src/app/floor-plan/page.tsx');
    const api = read('apps/designer-workbench/src/lib/api.ts');

    expect(api).toContain('viewerSummaries = {');
    expect(api).toContain('viewer-summaries/${encodeURIComponent(id)}');
    expect(floorPlan).toContain('viewerDrafts.get(nextDraftId)');
    expect(floorPlan).toContain('viewerSummaries.get(nextSummaryId)');
    expect(floorPlan).toContain('viewerSummaries.latest(nextDraftId)');
    expect(floorPlan).toContain('modelSources.get(nextModelSourceId)');
    expect(floorPlan).toContain('Database context');
    expect(floorPlan).toContain('Back to viewer');
    expect(floorPlan).toContain('viewerReturnHref');
    expect(floorPlan).toContain('Missing draftId');
    expect(floorPlan).toContain('summary may be stale');
    expect(floorPlan).not.toContain('localStorage');
  });

  test('BOM and quote page derives payloads from persisted summary and model context', () => {
    const bom = read('apps/designer-workbench/src/app/bom/page.tsx');
    const bomSheet = read('apps/designer-workbench/components/BomSheet.tsx');

    expect(bom).toContain("params.get('handoff') === 'quote'");
    expect(bom).toContain('viewerDrafts.get(nextDraftId)');
    expect(bom).toContain('viewerSummaries.get(nextSummaryId)');
    expect(bom).toContain('modelSources.get(nextModelSourceId)');
    expect(bom).toContain('equipmentSummary');
    expect(bom).toContain('calculationSummary');
    expect(bom).toContain('quotePayloadFromContext');
    expect(bom).toContain('quotation.generate');
    expect(bom).toContain('Generate quote preview');
    expect(bom).toContain('Database context');
    expect(bom).toContain('viewerReturnHref');
    expect(bom).toContain("row.source === 'model-component'");
    expect(bom).toContain('bomMetadata.bomSkuHint');
    expect(bom).toContain('linkedComponentId');
    expect(bom).toContain("component.type === 'duct-route'");
    expect(bom).toContain('componentBomRollup');
    expect(bom).toContain('componentPipeRollup');
    expect(bom).toContain('pipeRows(summary)');
    expect(bom).toContain('dimensions: asRecord(row.dimensions)');
    expect(bom).toContain('businessMetadata: asRecord(row.businessMetadata)');
    expect(bom).toContain('businessMetadata.material');
    expect(bom).toContain('businessMetadata.insulationMm');
    expect(bomSheet).toContain("positive(d.params?.quantity, 1)");
    expect(bomSheet).toContain('d.productAssetRef ?? bomSkuHint');
    expect(bom).not.toContain('localStorage');
  });
});
