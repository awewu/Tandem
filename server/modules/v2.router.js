// ⚠️ DEPRECATED / FROZEN（2026-07-06 架构收敛裁定）
// 真相源已统一为 NestJS 服务（services/api，端口 3300，前缀 /api/v2）。
// 本 Express `/api/v2/*` 实现进入冻结期：只做兼容维持，不再接受新增域/新端点。
// 所有 apps/* 前端已通过各自 next.config.js 的 rewrites 指向 3300。
// 退场计划见 docs/ARCHITECTURE-BLUEPRINT.md §迁移路线。
const express = require('express');
const createAuditRoutes = require('./audit/audit.routes');
const createContractsRoutes = require('./contracts/contracts.routes');
const createHealthRoutes = require('./health/health.routes');
const createSystemPacksRoutes = require('./system-packs/system-packs.routes');
const createAnalyticsRoutes = require('./analytics/analytics.routes');
const createDevicesCandidateRoutes = require('./react-candidate/devices-candidate.routes');
const createProjectsCandidateRoutes = require('./react-candidate/projects-candidate.routes');

const REACT_CANDIDATE_ROUTES = [
  { path: '/devices', name: 'devices', factory: createDevicesCandidateRoutes, optionKey: 'devicesCandidate' },
  { path: '/projects', name: 'projects', factory: createProjectsCandidateRoutes, optionKey: 'projectsCandidate' }
];

function isReactCandidateEnabled(options = {}) {
  if (typeof options.enableReactCandidate === 'boolean') return options.enableReactCandidate;
  if (options.reactCandidate?.enabled === true) return true;
  return process.env.ENABLE_REACT_CANDIDATE === 'true';
}

function createV2Router(options = {}) {
  const router = express.Router();
  const reactCandidateEnabled = isReactCandidateEnabled(options);

  router.use('/audit', createAuditRoutes(options.audit || options));
  router.use('/contracts', createContractsRoutes(options.contracts || options));
  router.use('/system-packs', createSystemPacksRoutes(options.systemPacks || options));
  router.use('/analytics', createAnalyticsRoutes(options.analytics || options));
  router.use('/health', createHealthRoutes(options.health || options));

  router.get('/react-candidate/status', (req, res) => {
    res.json({
      success: true,
      data: {
        enabled: reactCandidateEnabled,
        status: reactCandidateEnabled ? 'enabled-for-contract-validation' : 'frozen',
        routes: REACT_CANDIDATE_ROUTES.map(route => ({
          name: route.name,
          path: `/api/v2${route.path}`,
          mounted: reactCandidateEnabled
        }))
      }
    });
  });

  if (reactCandidateEnabled) {
    for (const route of REACT_CANDIDATE_ROUTES) {
      router.use(route.path, route.factory(options[route.optionKey] || options.reactCandidate || options));
    }
  }

  return router;
}

module.exports = createV2Router;
module.exports.isReactCandidateEnabled = isReactCandidateEnabled;
module.exports.REACT_CANDIDATE_ROUTES = REACT_CANDIDATE_ROUTES;
