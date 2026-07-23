/**
 * 质量保证 (QA) Router (factory pattern)
 * 挂载前缀: /api/qa
 * 依赖: qualityAssurance engine
 * 2026-04-22 从 server-production.js 抽出
 *
 * 注意: /api/qa/config 在 P0 已被 adminGuard 兜底保护
 */
const express = require('express');
const { asyncRoute } = require('../utils/sanitize-error');

module.exports = function createQaRouter(qualityAssurance) {
  const router = express.Router();

  router.post('/assess-risk', asyncRoute(async (req, res) => {
    const { componentName, metrics } = req.body;
    const data = qualityAssurance.assessComponentRisk(componentName, metrics);
    res.json({ success: true, data });
  }));

  router.post('/risk-report', asyncRoute(async (req, res) => {
    const data = qualityAssurance.generateRiskReport(req.body.components);
    res.json({ success: true, data });
  }));

  router.post('/ai-prioritize', asyncRoute(async (req, res) => {
    const { tests, historicalData } = req.body;
    const data = qualityAssurance.aiPrioritizeTests(tests, historicalData);
    res.json({ success: true, data });
  }));

  router.post('/monitor-production', asyncRoute(async (req, res) => {
    const data = qualityAssurance.monitorProductionBehavior(req.body);
    res.json({ success: true, data });
  }));

  router.post('/maturity-assessment', asyncRoute(async (req, res) => {
    const data = qualityAssurance.assessTestingMaturity(req.body);
    res.json({ success: true, data });
  }));

  router.get('/config', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      data: {
        riskLevels: qualityAssurance.riskLevels,
        componentRisks: qualityAssurance.componentRisks,
        testStrategy: qualityAssurance.testStrategy
      }
    });
  }));

  return router;
};
