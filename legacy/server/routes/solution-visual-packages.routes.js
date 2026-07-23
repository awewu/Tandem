const express = require('express');
const SolutionVisualPackageService = require('../modules/solution-visuals/solution-visual-package.service');
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function createSolutionVisualPackagesRouter(options = {}) {
  const router = express.Router();
  const threeTier = options.threeTier || getRuntimeEngine('threeTier', options);
  const service = options.service || new SolutionVisualPackageService({
    drawingRenderer: options.drawingRenderer || getRuntimeEngine('drawingSvgRenderer', options),
    renderer3D: options.renderer3D || getRuntimeEngine('renderer3D', options),
    now: options.now
  });

  function ensureResult(body = {}) {
    if (body.result && body.result.solutions) return body.result;
    if (body.area) return threeTier.generate(body);
    const err = new Error('缺少 result 或 area 入参');
    err.status = 400;
    throw err;
  }

  router.post('/generate', (req, res) => {
    try {
      const result = ensureResult(req.body || {});
      const visualPackages = service.generate(result);
      res.json({ success: true, data: visualPackages });
    } catch (error) {
      if (error.status === 400 || /必填|必须|缺少/.test(error.message)) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createSolutionVisualPackagesRouter;
