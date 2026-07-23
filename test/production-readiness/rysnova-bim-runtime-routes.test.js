const express = require('express');
const request = require('./helpers/in-process-request');

const createRysnovaRuntimeRouter = require('../../server/routes/rysnova-bim-runtime.routes');
const { RYSNOVA_RUNTIME_BOUNDARY } = createRysnovaRuntimeRouter;

function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

function makeEngines() {
  return {
    multiDiscipline: {
      coordinate: jest.fn().mockReturnValue({
        crossConflicts: { total: 2 },
        complianceCheck: { complianceRate: '96%' }
      })
    },
    revitSync: {
      getSyncHistory: jest.fn().mockReturnValue([{ id: 'sync-1' }])
    },
    rysnovaBimBIM: {
      runCFDSimulation: jest.fn().mockReturnValue({
        qualityScore: { grade: 'A' },
        fields: { airflow: [] }
      })
    },
    waterSystem: {
      generateDesign: jest.fn().mockReturnValue({ system: 'water' })
    },
    heatingSystem: {
      generateDesign: jest.fn().mockReturnValue({ system: 'heating' })
    },
    airConditioning: {
      generateDesign: jest.fn().mockReturnValue({ system: 'airConditioning' })
    },
    hvac3DVisualization: {
      generate3DVisualization: jest.fn().mockReturnValue({ scene: '3d' })
    },
    bimExport: {
      exportDesign: jest.fn((design, format) => ({ format, ok: true }))
    }
  };
}

function makeClassLoader() {
  class RysnovaAgent {
    async initialize() {
      return { status: 'ready' };
    }

    async executeDesignWorkflow() {
      return {
        id: 'wf-1',
        duration: 12,
        report: { title: 'report' },
        stages: [{ name: 'BIM导入', result: { status: 'success' } }]
      };
    }
  }

  class RysnovaCalcEngine {
    async performCompleteCalculation() {
      return { load: { cooling: 100 }, energy: { annual: 2000 } };
    }
  }

  class RysnovaCodeEngine {
    async performCodeComplianceCheck() {
      return {
        report: { status: 'pass' },
        compliance: { percentage: 98, grade: 'A', overallStatus: 'pass' }
      };
    }
  }

  class RysnovaBIMEngine {
    async executeBIMWorkflow() {
      return {
        stages: [
          { name: 'import', result: { status: 'success' } },
          { stage: 'export', status: 'success', exports: { ifc: { filePath: '/exports/model.ifc' } } }
        ]
      };
    }
  }

  class Rysnova3DEngine {
    async detectCollisions() {
      return { summary: { total: 0, hard: 0, soft: 0 } };
    }
  }

  return (requestedPath) => {
    if (requestedPath.includes('RysnovaAgent')) return RysnovaAgent;
    if (requestedPath.includes('RysnovaCalcEngine')) return RysnovaCalcEngine;
    if (requestedPath.includes('RysnovaCodeEngine')) return RysnovaCodeEngine;
    if (requestedPath.includes('RysnovaBIMEngine')) return RysnovaBIMEngine;
    if (requestedPath.includes('Rysnova3DEngine')) return Rysnova3DEngine;
    throw new Error(`Unexpected class request: ${requestedPath}`);
  };
}

describe('rysnova-bim runtime route module', () => {
  test('exposes compatibility boundary so legacy BIM runtime cannot replace the v2 artifact trunk', async () => {
    const app = makeApp(createRysnovaRuntimeRouter(makeEngines()));

    const res = await request(app)
      .get('/api/rysnova-bim/runtime-boundary')
      .expect(200);

    expect(res.body.data).toEqual(expect.objectContaining({
      surface: 'rysnova-bim-compatibility-runtime',
      status: 'compatibility-preserved-not-production-artifact-trunk',
      productionArtifactApi: '/api/v2/rysnova-bim',
      deliverableArtifactsApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      signoffPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      customerPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      storageBoundary: 'artifact-contract-and-object-storage-required-for-production'
    }));
    expect(res.body.data).toEqual(expect.objectContaining(RYSNOVA_RUNTIME_BOUNDARY));
    expect(res.body.data.migrationRule).toContain('must not replace v2 Rysnova artifact');
    expect(res.body.data.migrationRule).toContain('signoff-package');
  });

  test('preserves BIM coordination, history, CFD, and full export contracts', async () => {
    const engines = makeEngines();
    const app = makeApp(createRysnovaRuntimeRouter(engines));

    const multi = await request(app)
      .post('/api/rysnova-bim-bim/multi-discipline')
      .send({ projectId: 'p1' })
      .expect(200);
    expect(multi.body.message).toContain('2个跨专业冲突');
    expect(multi.body.runtimeBoundary.customerPackageApi).toBe('/api/v2/rysnova-bim/projects/{projectId}/customer-package');
    expect(multi.body.runtimeBoundary.signoffPackageApi).toBe('/api/v2/rysnova-bim/projects/{projectId}/signoff-package');

    const history = await request(app)
      .get('/api/rysnova-bim-bim/projects/project-1/history')
      .expect(200);
    expect(history.body.data).toEqual([{ id: 'sync-1' }]);
    expect(history.body.runtimeBoundary.status).toBe('compatibility-preserved-not-production-artifact-trunk');

    const cfd = await request(app)
      .post('/api/rysnova-bim-bim/cfd-simulation')
      .send({ layout: { devices: [] } })
      .expect(200);
    expect(cfd.body.message).toContain('质量等级A');
    expect(cfd.body.runtimeBoundary.productionArtifactApi).toBe('/api/v2/rysnova-bim');

    const exported = await request(app)
      .post('/api/export/complete')
      .send({ houseType: 'villa', area: 220, city: '上海', residents: 4 })
      .expect(200);
    expect(exported.body.data.summary.exportFormats).toContain('DXF');
    expect(exported.body.runtimeBoundary.storageBoundary).toBe('artifact-contract-and-object-storage-required-for-production');
    expect(engines.bimExport.exportDesign).toHaveBeenCalledTimes(3);
  });

  test('preserves Rysnova workflow, calculation, code-check, BIM integration, and clash contracts', async () => {
    const engines = makeEngines();
    const auth = jest.fn((req, res, next) => next());
    const app = makeApp(createRysnovaRuntimeRouter(engines, {
      authenticateToken: auth,
      checkRole: () => (req, res, next) => next(),
      loadClass: makeClassLoader()
    }));

    const workflow = await request(app)
      .post('/api/rysnova-bim/design-workflow')
      .send({ projectName: 'P1', exports: ['IFC'] })
      .expect(200);
    expect(workflow.body.workflow.stages[0]).toEqual({ name: 'BIM导入', status: 'success' });
    expect(workflow.body.runtimeBoundary.productionArtifactApi).toBe('/api/v2/rysnova-bim');

    const calc = await request(app)
      .post('/api/rysnova-bim/calculation')
      .send({ building: {}, systems: [] })
      .expect(200);
    expect(calc.body.calculations.energy).toContain('EnergyPlus');
    expect(calc.body.runtimeBoundary.status).toBe('compatibility-preserved-not-production-artifact-trunk');

    const code = await request(app)
      .post('/api/rysnova-bim/code-check')
      .send({ projectName: 'P1' })
      .expect(200);
    expect(code.body.compliance.grade).toBe('A');
    expect(code.body.standards).toEqual(expect.arrayContaining([
      'GB 55015-2021',
      'GB 55020-2021',
      'ASHRAE 55-2023',
      'ASHRAE 62.1-2022'
    ]));
    expect(code.body.runtimeBoundary.migrationRule).toContain('customer-package');

    const bim = await request(app)
      .post('/api/rysnova-bim/bim-integration')
      .send({ building: { format: 'IFC' }, hvacDesign: {}, exports: { formats: ['IFC'] } })
      .expect(200);
    expect(bim.body.stages).toEqual(expect.arrayContaining([
      { name: 'export', status: 'success' }
    ]));
    expect(bim.body.exports.ifc.filePath).toBe('/exports/model.ifc');
    expect(bim.body.runtimeBoundary.storageBoundary).toBe('artifact-contract-and-object-storage-required-for-production');

    const clash = await request(app)
      .post('/api/rysnova-bim/clash-detection')
      .send({ equipment: [], pipes: [], building: {} })
      .expect(200);
    expect(clash.body.summary.total).toBe(0);
    expect(clash.body.runtimeBoundary.surface).toBe('rysnova-bim-compatibility-runtime');
    expect(auth).toHaveBeenCalled();
  });
});
