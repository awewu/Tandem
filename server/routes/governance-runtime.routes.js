const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function pickEngine(engines, primary, aliases = []) {
  return [primary, ...aliases].map(name => engines[name]).find(Boolean);
}

async function executeLoadCalculation(engines, roomProfile) {
  const loadEngine = pickEngine(engines, 'loadCalc', ['loadCalculation']);
  if (!loadEngine) throw new Error('负荷计算引擎未初始化');

  if (typeof loadEngine.generateCalculationReport === 'function') {
    return loadEngine.generateCalculationReport(roomProfile, roomProfile.city || '上海');
  }
  if (typeof loadEngine.calculate === 'function') return loadEngine.calculate(roomProfile);
  if (typeof loadEngine.calculateLoad === 'function') return loadEngine.calculateLoad(roomProfile);

  const area = Number(roomProfile.area || roomProfile.totalArea || 100);
  return {
    cooling: { totalCoolingLoad: Math.round(area * 120) },
    heating: { totalHeatingLoad: Math.round(area * 85) },
    fallback: true
  };
}

function executeDeviceSelection(engines, loadResult, roomProfile) {
  const deviceEngine = pickEngine(engines, 'deviceSelect', ['deviceSelection']);
  if (!deviceEngine) throw new Error('设备选型引擎未初始化');

  if (typeof deviceEngine.selectDevices === 'function') return deviceEngine.selectDevices(loadResult, roomProfile);
  if (typeof deviceEngine.select === 'function') return deviceEngine.select(loadResult, roomProfile);

  return {
    systems: [],
    totalPrice: 0,
    recommendations: ['设备选型引擎缺少标准 select/selectDevices 方法']
  };
}

function executeQuotation(engines, solution, devices, roomProfile, painPoints) {
  if (engines.valueQuote && typeof engines.valueQuote.generateValueQuote === 'function') {
    return engines.valueQuote.generateValueQuote(solution, { selected: painPoints }, roomProfile);
  }
  if (engines.quotation && typeof engines.quotation.generateQuote === 'function') {
    return engines.quotation.generateQuote({
      roomProfiles: [roomProfile],
      solution,
      painDiagnosis: { primary: painPoints || [] },
      mode: 'auto'
    });
  }
  return {
    totalPrice: devices && devices.totalPrice ? devices.totalPrice : 0,
    fallback: true
  };
}

async function executeCompleteWorkflow(engines, roomProfile = {}, selectedPainPoints = []) {
  const diagnosis = engines.painDiagnosis.diagnose(roomProfile, selectedPainPoints);
  const solution = engines.painMatching.match(diagnosis, roomProfile);
  const loadCalculation = await executeLoadCalculation(engines, roomProfile);
  const deviceSelection = executeDeviceSelection(engines, loadCalculation, roomProfile);
  const quotation = executeQuotation(
    engines,
    solution,
    deviceSelection,
    roomProfile,
    diagnosis.allTags || selectedPainPoints
  );

  return {
    timestamp: new Date().toISOString(),
    roomProfile,
    steps: [
      { step: 'painDiagnosis', result: diagnosis },
      { step: 'solutionMatching', result: solution },
      { step: 'loadCalculation', result: loadCalculation },
      { step: 'deviceSelection', result: deviceSelection },
      { step: 'quotationGeneration', result: quotation }
    ],
    finalSolution: {
      painDiagnosis: diagnosis,
      solution,
      loadCalculation,
      deviceSelection,
      quotation,
      summary: {
        totalPainPoints: diagnosis.allTags ? diagnosis.allTags.length : selectedPainPoints.length,
        recommendedSystems: solution.systems ? solution.systems.length : 0,
        totalCoolingLoad: loadCalculation.cooling?.totalCoolingLoad || loadCalculation.coolingLoad || 0,
        totalHeatingLoad: loadCalculation.heating?.totalHeatingLoad || loadCalculation.heatingLoad || 0,
        deviceCount: deviceSelection.systems ? deviceSelection.systems.length : 0,
        totalPrice: quotation.totalPrice || quotation.total || deviceSelection.totalPrice || 0,
        keyFeatures: solution.features || [],
        priorityRecommendations: solution.priorityRecommendations || []
      }
    },
    success: true,
    errors: []
  };
}

function createGovernanceRuntimeRouter(engines) {
  const router = express.Router();

  router.post('/api/workflow/complete', async (req, res) => {
    try {
      const { roomProfile, selectedPainPoints } = req.body || {};
      if (engines.workflowOrchestrator && typeof engines.workflowOrchestrator.executeCompleteWorkflow === 'function') {
        const result = await engines.workflowOrchestrator.executeCompleteWorkflow(roomProfile, selectedPainPoints);
        if (result && result.success !== false) return res.json({ success: true, data: result });
      }

      const result = await executeCompleteWorkflow(engines, roomProfile, selectedPainPoints);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/workflow/quick', async (req, res) => {
    try {
      const { roomProfile, selectedPainPoints } = req.body || {};
      if (!engines.workflowOrchestrator) {
        return res.status(500).json({ success: false, error: '工作流程编排器未初始化' });
      }
      const result = await engines.workflowOrchestrator.executeQuickWorkflow(roomProfile, selectedPainPoints);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/workflow/status', (req, res) => {
    try {
      if (!engines.workflowOrchestrator) {
        return res.json({ success: false, error: '工作流程编排器未初始化' });
      }
      res.json({ success: true, data: engines.workflowOrchestrator.getWorkflowStatus() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/self-check/run', async (req, res) => {
    try {
      if (!engines.selfCheckOrchestrator) {
        return res.json({ success: false, error: '自检编排器未初始化' });
      }
      res.json({ success: true, data: await engines.selfCheckOrchestrator.runCompleteSelfCheck() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/self-check/status', (req, res) => {
    try {
      if (!engines.selfCheckOrchestrator) {
        return res.json({ success: false, error: '自检编排器未初始化' });
      }
      res.json({ success: true, data: engines.selfCheckOrchestrator.getStatus() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/self-check/auto-fix', (req, res) => {
    try {
      if (!engines.selfCheckOrchestrator) {
        return res.json({ success: false, error: '自检编排器未初始化' });
      }
      const { enabled } = req.body || {};
      engines.selfCheckOrchestrator.setAutoFix(enabled !== false);
      res.json({ success: true, data: { autoFixEnabled: engines.selfCheckOrchestrator.autoFixEnabled } });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/evolution/status', (req, res) => {
    try {
      res.json({ success: true, data: engines.evolution.getEvolutionStatus() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/evolution/self-check', async (req, res) => {
    try {
      res.json({ success: true, data: engines.evolution.runFullSelfCheck() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/evolution/improvement', async (req, res) => {
    try {
      const { checkResult } = req.body || {};
      const improvementResult = await engines.evolution.runClosedLoopImprovement(checkResult);
      res.json({ success: true, data: improvementResult });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/evolution/start', async (req, res) => {
    try {
      res.json({ success: true, data: await engines.evolution.runEvolution() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/evolution/report', (req, res) => {
    try {
      const fs = require('fs');
      const reportPath = './EVOLUTION-REPORT.json';
      if (fs.existsSync(reportPath)) {
        return res.json({ success: true, data: JSON.parse(fs.readFileSync(reportPath, 'utf8')) });
      }
      res.json({ success: false, error: '进化报告不存在' });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createGovernanceRuntimeRouter;
