/**
 * 施工图纸 API（SVG 真实渲染）
 *  POST /api/drawings/generate - 基于三档结果生成 5 张 SVG 图纸
 *  GET  /api/drawings/:id      - 读取已生成的图纸清单
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const drawingGen = getRuntimeEngine('drawingSvgRenderer');
const threeTier = getRuntimeEngine('threeTier');

/**
 * POST /api/drawings/generate
 * Body: { result?, tier?, area?, city?, painPoints?, project? }
 *  - 若未带 result，用 ThreeTierEngine 现场生成
 */
router.post('/generate', (req, res) => {
  try {
    let result = req.body.result;
    if (!result || !result.tiers) {
      if (!req.body.area) {
        return res.status(400).json({ success: false, message: '缺少 result 或 area 入参' });
      }
      result = threeTier.generate(req.body);
    }
    const out = drawingGen.generate({
      result,
      tier: req.body.tier || result.recommendation?.recommendedTier || 'comfort',
      project: req.body.project || {}
    });
    res.json({ success: true, data: out });
  } catch (e) {
    return errorResponse(res, e);
  }
});

/** GET /api/drawings/:id - 读取图纸清单 */
router.get('/:id', (req, res) => {
  const m = drawingGen.getManifest(req.params.id);
  if (!m) return res.status(404).json({ success: false, message: '图纸不存在' });
  res.json({ success: true, data: m });
});

module.exports = router;
