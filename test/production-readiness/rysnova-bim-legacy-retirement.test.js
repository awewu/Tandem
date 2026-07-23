const express = require('express');
const request = require('./helpers/in-process-request');

const createBusinessDomainRouter = require('../../server/routes/business-domain');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(createBusinessDomainRouter({
    contracts: [],
    crm: { opportunities: [], interactions: [], campaigns: [], coupons: [] },
    operation: { devices: [], readings: [], predictions: {} },
    acceptance: [],
    settlement: [],
    products: [],
    promotions: []
  }));
  return app;
}

describe('Rysnova legacy deliverable route retirement', () => {
  test('does not expose the old four-piece generator as a production deliverable path', async () => {
    const res = await request(makeApp())
      .post('/api/rysnova-bim/generate-deliverables')
      .send({ contractId: 'CNT-LEGACY-001' })
      .expect(410);

    expect(res.body).toEqual(expect.objectContaining({
      success: false,
      code: 'RYSNOVA_LEGACY_DELIVERABLES_RETIRED'
    }));
    expect(res.body.migration).toEqual(expect.objectContaining({
      method: 'POST',
      path: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      projectIdHint: 'CNT-LEGACY-001'
    }));
    expect(res.body.migration.requiredEvidence).toEqual(expect.arrayContaining([
      'tenant bearer token',
      'audit log',
      'object storage evidence',
      'quoteCostSummary',
      'quantityTakeoffSummary',
      'standardsSummary',
      'customerReportSummary'
    ]));
  });

  test.each([
    'design-proposal.pdf',
    'system-diagram.svg',
    'construction-drawing.dwg',
    'material-bom.xlsx'
  ])('retires legacy generated download route %s in favor of v2 artifact storage evidence', async fileName => {
    const res = await request(makeApp())
      .get(`/rysnova-bim-deliverables/CNT-LEGACY-001/${fileName}`)
      .expect(410);

    expect(res.body).toEqual(expect.objectContaining({
      success: false,
      code: 'RYSNOVA_LEGACY_DOWNLOAD_RETIRED'
    }));
    expect(res.body.migration).toEqual(expect.objectContaining({
      contractId: 'CNT-LEGACY-001',
      legacyFileName: fileName,
      customerPackage: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      deliverableArtifacts: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'
    }));
    expect(res.body.migration.requiredEvidence).toEqual(expect.arrayContaining([
      'customer-visible approved/shared artifact',
      'object storage evidence',
      'integrity passed',
      'no internal fields leaked'
    ]));
  });
});
