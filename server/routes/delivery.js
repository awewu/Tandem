/**
 * 技术交付 API 路由
 * POST /api/delivery/generate         - 生成交付文档（通常在签单时触发）
 *   Body: order 对象（来自套餐下单或定制报价）
 * GET  /api/delivery/:orderNo/docs    - 获取指定订单的交付文档清单
 * 静态文档通过 /exports/delivery/<orderNo>/<type>.html 直接访问（server/index.js 已挂载 /exports）
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function getTechnicalDeliveryGenerator() {
  return getRuntimeEngine('technicalDelivery');
}

/**
 * POST /api/delivery/generate
 * Body: { order: {...} }  或直接把订单字段打平传入
 */
router.post('/generate', async (req, res) => {
  try {
    const order = req.body.order || req.body;
    if (!order.orderNo) {
      return res.status(400).json({ success: false, message: 'order.orderNo 必填' });
    }
    // 若未 signedAt，默认现在
    if (!order.signedAt) order.signedAt = new Date().toISOString().slice(0, 10);

    const result = getTechnicalDeliveryGenerator().generate(order);
    res.json({
      success: true,
      message: `已生成 ${result.documents.length} 份交付文档`,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/delivery/:orderNo/docs
 */
router.get('/:orderNo/docs', (req, res) => {
  const manifest = getTechnicalDeliveryGenerator().getManifest(req.params.orderNo);
  if (!manifest) {
    return res.status(404).json({ success: false, message: '交付文档未生成。请先调用 POST /api/delivery/generate' });
  }
  res.json({ success: true, data: manifest });
});

module.exports = router;
