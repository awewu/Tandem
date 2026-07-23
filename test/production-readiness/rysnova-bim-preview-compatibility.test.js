const express = require('express');
const request = require('./helpers/in-process-request');

const rysnovaBimPreviewRouter = require('../../server/routes/rysnova-bim-simple');
const { RYSNOVA_PREVIEW_RUNTIME_BOUNDARY } = rysnovaBimPreviewRouter;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rysnova-bim', rysnovaBimPreviewRouter);
  return app;
}

describe('rysnova-bim preview compatibility runtime', () => {
  test('health route exposes preview-only boundary and points production traffic to v2 artifact trunk', async () => {
    const app = makeApp();

    const res = await request(app)
      .get('/api/rysnova-bim/health')
      .expect(200);

    expect(res.body.runtimeBoundary).toEqual(expect.objectContaining({
      surface: 'rysnova-bim-3d-preview-compatibility-runtime',
      status: 'preview-compatibility-not-production-artifact-trunk',
      productionArtifactApi: '/api/v2/rysnova-bim',
      deliverableArtifactsApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      signoffPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      customerPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      storageBoundary: 'artifact-contract-and-object-storage-required-for-production'
    }));
    expect(res.body.runtimeBoundary).toEqual(expect.objectContaining(RYSNOVA_PREVIEW_RUNTIME_BOUNDARY));
    expect(res.body.runtimeBoundary.migrationRule).toContain('production Rysnova deliverables must use v2');
    expect(res.body.runtimeBoundary.migrationRule).toContain('signoff-package');
  });

  test('quick design and complete design remain preview runtime and do not create production artifacts', async () => {
    const app = makeApp();

    const quick = await request(app)
      .post('/api/rysnova-bim/quick-design')
      .send({
        city: '上海',
        building: { area: 120, type: 'residential' },
        systems: { cooling: true, heating: true }
      })
      .expect(200);

    expect(quick.body.mode).toBe('quick');
    expect(quick.body.estimate.load).toEqual(expect.objectContaining({
      cooling: expect.any(Number),
      heating: expect.any(Number),
      totalCoolingLoad: expect.any(Number),
      totalHeatingLoad: expect.any(Number)
    }));
    expect(quick.body.runtimeBoundary.status).toBe('preview-compatibility-not-production-artifact-trunk');
    expect(quick.body.runtimeBoundary.deliverableArtifactsApi).toBe('/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts');
    expect(quick.body.runtimeBoundary.signoffPackageApi).toBe('/api/v2/rysnova-bim/projects/{projectId}/signoff-package');

    const complete = await request(app)
      .post('/api/rysnova-bim/complete-design')
      .send({
        projectName: 'Preview',
        city: '上海',
        building: { area: 120, floors: 1, height: 2.8, type: 'residential' },
        rooms: [{ name: '客厅', area: 30 }],
        systems: { cooling: true, heating: true, freshAir: true }
      })
      .expect(200);

    expect(complete.body.design.load).toEqual(expect.objectContaining({
      cooling: expect.any(Number),
      heating: expect.any(Number)
    }));
    expect(complete.body.design.layout3D.equipment.length).toBeGreaterThan(0);
    expect(complete.body.runtimeBoundary.productionArtifactApi).toBe('/api/v2/rysnova-bim');
    expect(complete.body.runtimeBoundary.migrationRule).toContain('object-storage');
  });

  test('complete design preview is deterministic for the same engineering input', async () => {
    const app = makeApp();
    const payload = {
      projectName: 'Preview Deterministic',
      city: '上海',
      building: { area: 168, floors: 1, height: 2.8, type: 'residential' },
      rooms: [{ name: '客厅', area: 36 }, { name: '主卧', area: 24 }],
      systems: { cooling: true, heating: true, freshAir: true }
    };

    const first = await request(app)
      .post('/api/rysnova-bim/complete-design')
      .send(payload)
      .expect(200);
    const second = await request(app)
      .post('/api/rysnova-bim/complete-design')
      .send(payload)
      .expect(200);

    expect(second.body.design.layout3D.pipes).toEqual(first.body.design.layout3D.pipes);
    expect(second.body.design.hydraulic).toEqual(first.body.design.hydraulic);
  });

  test('preview export is explicitly not object-storage production evidence', async () => {
    const app = makeApp();

    const exported = await request(app)
      .post('/api/rysnova-bim/export')
      .send({ design: { id: 'preview-design' }, formats: ['ifc'] })
      .expect(200);

    expect(exported.body.exports.ifc.note).toContain('预览兼容层模拟导出');
    expect(exported.body.storageEvidence).toEqual(expect.objectContaining({
      status: 'not-produced-by-preview-runtime',
      requiredProductionApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      supportingProductionApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'
    }));
    expect(exported.body.runtimeBoundary.signoffPackageApi).toBe('/api/v2/rysnova-bim/projects/{projectId}/signoff-package');
    expect(exported.body.runtimeBoundary.customerPackageApi).toBe('/api/v2/rysnova-bim/projects/{projectId}/customer-package');
    expect(exported.body.runtimeBoundary.storageBoundary).toBe('artifact-contract-and-object-storage-required-for-production');
  });

  test('load calculation keeps preview boundary visible for designer diagnostics', async () => {
    const app = makeApp();

    const calc = await request(app)
      .post('/api/rysnova-bim/load-calculation')
      .send({
        city: '杭州',
        building: { area: 160 },
        rooms: [{ name: '主卧', area: 22 }]
      })
      .expect(200);

    expect(calc.body.calculation.rooms[0]).toEqual(expect.objectContaining({
      name: '主卧',
      coolingLoad: expect.any(String),
      heatingLoad: expect.any(String)
    }));
    expect(calc.body.runtimeBoundary.surface).toBe('rysnova-bim-3d-preview-compatibility-runtime');
    expect(calc.body.note).toContain('生产交付请使用 v2 artifact contract');
    expect(calc.body.note).toContain('signoff-package');
  });
});
