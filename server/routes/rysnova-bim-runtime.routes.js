const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function requireDefault(pathValue) {
  return require(pathValue);
}

const RYSNOVA_RUNTIME_BOUNDARY = {
  surface: 'rysnova-bim-compatibility-runtime',
  status: 'compatibility-preserved-not-production-artifact-trunk',
  productionArtifactApi: '/api/v2/rysnova-bim',
  deliverableArtifactsApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
  signoffPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
  customerPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
  storageBoundary: 'artifact-contract-and-object-storage-required-for-production',
  migrationRule: 'legacy BIM/CFD/calculation routes must not replace v2 Rysnova artifact, deliverable-artifacts, signoff-package, customer-package, capacity, or object-storage evidence'
};

function createRysnovaRuntimeRouter(engines, options = {}) {
  const router = express.Router();
  const authenticateToken = options.authenticateToken || ((req, res, next) => next());
  const checkRole = options.checkRole || (() => (req, res, next) => next());
  const loadClass = options.loadClass || requireDefault;
  const runtimeBoundary = RYSNOVA_RUNTIME_BOUNDARY;

  router.get('/api/rysnova-bim/runtime-boundary', (req, res) => {
    res.json({
      success: true,
      data: runtimeBoundary
    });
  });

  router.post('/api/rysnova-bim-bim/multi-discipline', (req, res) => {
    try {
      const result = engines.multiDiscipline.coordinate(req.body || {});
      res.json({
        success: true,
        data: result,
        runtimeBoundary,
        engine: 'MultiDisciplineEngine v1.0',
        message: `多专业协同分析完成（${result.crossConflicts.total}个跨专业冲突,合规率${result.complianceCheck.complianceRate}）`
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/rysnova-bim-bim/projects/:projectId/history', (req, res) => {
    try {
      const history = engines.revitSync.getSyncHistory(req.params.projectId);
      res.json({ success: true, data: history, runtimeBoundary });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/rysnova-bim-bim/cfd-simulation', (req, res) => {
    try {
      const { layout, roomConfig, options: simulationOptions } = req.body || {};
      const result = engines.rysnovaBimBIM.runCFDSimulation(
        layout || { devices: [], pipes: [] },
        roomConfig || {},
        simulationOptions || {}
      );
      res.json({
        success: true,
        data: result,
        runtimeBoundary,
        engine: 'CFDSimulationEngine v1.0 + RysnovaBIM Integration',
        message: `CFD仿真完成,质量等级${result.qualityScore.grade}`
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/rysnova-bim/design-workflow', authenticateToken, checkRole(['designer', 'store_admin']), async (req, res) => {
    try {
      const RysnovaAgent = loadClass('../../.windsurf/skills/rysnova-bim/RysnovaAgent');
      const rysnovaBim = new RysnovaAgent({
        lod: req.body.lod || 300,
        precision: 0.95,
        codes: ['GB 55015-2021', 'GB 55020-2021', 'GB 50736-2012', 'ASHRAE 55-2023', 'ASHRAE 62.1-2022']
      });

      await rysnovaBim.initialize();
      const result = await rysnovaBim.executeDesignWorkflow({
        name: req.body.projectName,
        building: req.body.buildingModel,
        systems: req.body.hvacSystems,
        equipment: req.body.equipmentList,
        pipes: req.body.pipeSpecs,
        climateZone: req.body.climateZone,
        exports: req.body.exports || ['IFC', 'DWG']
      });

      res.json({
        success: true,
        data: result.report,
        runtimeBoundary,
        workflow: {
          id: result.id,
          duration: result.duration,
          stages: (result.stages || []).map(s => ({ name: s.name, status: s.result?.status || 'completed' }))
        },
        engine: 'RysnovaAgent v1.0 - 3D暖通专业架构'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/rysnova-bim/calculation', authenticateToken, async (req, res) => {
    try {
      const RysnovaCalcEngine = loadClass('../../.windsurf/skills/rysnova-bim/core/RysnovaCalcEngine');
      const calcEngine = new RysnovaCalcEngine();
      const result = await calcEngine.performCompleteCalculation({
        building: req.body.building,
        hvacSystems: req.body.systems,
        rooms: req.body.rooms,
        climateZone: req.body.climateZone,
        occupancy: req.body.occupancy
      });

      res.json({
        success: true,
        data: result,
        runtimeBoundary,
        calculations: {
          load: 'Radiance光热耦合',
          hydraulic: 'EPANET管网分析',
          cfd: 'CFD气流组织',
          noise: 'NC曲线评价',
          energy: 'EnergyPlus全年8760h'
        },
        engine: 'RysnovaCalcEngine v1.0'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/rysnova-bim/code-check', authenticateToken, async (req, res) => {
    try {
      const RysnovaCodeEngine = loadClass('../../.windsurf/skills/rysnova-bim/core/RysnovaCodeEngine');
      const codeEngine = new RysnovaCodeEngine();
      const result = await codeEngine.performCodeComplianceCheck({
        projectName: req.body.projectName,
        buildingType: req.body.buildingType,
        area: req.body.area,
        hvacSystem: req.body.system,
        calculations: req.body.calculations,
        indoorParams: req.body.indoorParams,
        climateZone: req.body.climateZone
      });

      res.json({
        success: true,
        data: result.report,
        runtimeBoundary,
        compliance: {
          overall: result.compliance?.percentage || 0,
          grade: result.compliance?.grade || 'N/A',
          status: result.compliance?.overallStatus || 'unknown'
        },
        standards: [
          'GB 55015-2021',
          'GB 55020-2021',
          'GB 5749-2022',
          'GB 50736-2012',
          'ASHRAE 55-2023',
          'ASHRAE 62.1-2022',
          'ASHRAE 90.1-2022'
        ],
        engine: 'RysnovaCodeEngine v1.0'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/rysnova-bim/bim-integration', authenticateToken, checkRole(['designer', 'store_admin']), async (req, res) => {
    try {
      const RysnovaBIMEngine = loadClass('../../.windsurf/skills/rysnova-bim/core/RysnovaBIMEngine');
      const bimEngine = new RysnovaBIMEngine();
      const result = await bimEngine.executeBIMWorkflow({
        buildingModel: req.body.building,
        hvacDesign: req.body.hvacDesign,
        exports: req.body.exports || { formats: ['IFC', 'DWG'] },
        schedule: req.body.schedule
      });
      const stages = result.stages || [];

      res.json({
        success: true,
        data: result,
        runtimeBoundary,
        stages: stages.map(s => ({ name: s.name || s.stage, status: s.result?.status || s.status })),
        exports: stages.find(s => s.name === 'export' || s.stage === 'export')?.result?.exports ||
          stages.find(s => s.stage === 'export')?.exports ||
          {},
        engine: 'RysnovaBIMEngine v1.0'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/rysnova-bim/clash-detection', authenticateToken, async (req, res) => {
    try {
      const Rysnova3DEngine = loadClass('../../.windsurf/skills/rysnova-bim/core/Rysnova3DEngine');
      const engine3D = new Rysnova3DEngine();
      const result = await engine3D.detectCollisions({
        equipment: req.body.equipment,
        pipes: req.body.pipes,
        building: req.body.building
      });

      res.json({
        success: true,
        data: result,
        runtimeBoundary,
        summary: result.summary,
        collisionTypes: ['硬碰撞', '软碰撞', '间距不足'],
        engine: 'Rysnova3DEngine v1.0'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/export/complete', async (req, res) => {
    try {
      const { houseType, area, city, residents, ...otherParams } = req.body || {};
      const waterDesign = engines.waterSystem.generateDesign({
        houseType, area, residents, ...(otherParams.water || {})
      });
      const heatingDesign = engines.heatingSystem.generateDesign({
        houseType, area, city, ...(otherParams.heating || {})
      });
      const acDesign = engines.airConditioning.generateDesign({
        houseType, area, city, ...(otherParams.ac || {})
      });
      const designData = {
        waterSystem: waterDesign,
        heatingSystem: heatingDesign,
        airConditioning: acDesign,
        houseType,
        area
      };
      const visualization3D = engines.hvac3DVisualization.generate3DVisualization(designData);
      const bimExport = engines.bimExport.exportDesign(designData, 'dxf');
      const materialList = engines.bimExport.exportDesign(designData, 'csv');
      const pdfDrawing = engines.bimExport.exportDesign(designData, 'pdf');

      res.json({
        success: true,
        data: {
          design: designData,
          visualization3D,
          bimExport,
          materialList,
          pdfDrawing,
          summary: {
            houseType,
            area,
            totalSystems: 3,
            exportFormats: ['DXF', '3D-JSON', 'CSV', 'PDF-Content'],
            exportTime: new Date().toISOString()
          }
        },
        runtimeBoundary,
        engines: {
          water: 'WaterSystemEngine v1.0',
          heating: 'HeatingSystemEngine v1.0',
          ac: 'AirConditioningEngine v1.0',
          visualization3D: 'HVAC3DVisualizationEngine v1.0',
          bimExport: 'BIMExportEngine v1.0'
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createRysnovaRuntimeRouter;
module.exports.RYSNOVA_RUNTIME_BOUNDARY = RYSNOVA_RUNTIME_BOUNDARY;
