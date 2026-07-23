/**
 * 套餐购买 API 路由
 * POST /api/package/quote  - 按档次+面积+上下文 得到套餐价+促销预估
 * POST /api/package/order  - 生成订单对象（当前返回 draft，不直接写库）
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function getPackagePurchaseFlow() {
  return getRuntimeEngine('packagePurchaseFlow');
}

function getTechnicalDeliveryGenerator() {
  return getRuntimeEngine('technicalDelivery');
}

/**
 * POST /api/package/quote
 * Body: { tier, area, city?, painPoints?, houseType?, hasElderly?, hasChildren?, customer? }
 */
router.post('/quote', async (req, res) => {
  try {
    const data = getPackagePurchaseFlow().quote(req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    if (/必填|必须/.test(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return errorResponse(res, error);
  }
});

/**
 * POST /api/package/order
 * Body: quote 入参 + customer { name, phone, address, ... }
 * 返回订单草稿（含 orderNo/systems/quote）
 */
router.post('/order', async (req, res) => {
  try {
    const order = getPackagePurchaseFlow().buildOrder(req.body || {});
    // 自动生成交付文档（签单前即可预览，付款后正式启用）
    let delivered = null;
    try {
      const pre = getTechnicalDeliveryGenerator().generate({ ...order, signedAt: new Date().toISOString().slice(0, 10) });
      delivered = { manifestUrl: `/api/delivery/${order.orderNo}/docs`, docCount: pre.documents.length };
    } catch (_) { /* 不阻塞下单 */ }
    res.json({ success: true, data: { ...order, delivery: delivered }, message: '订单已生成（待付款），技术交付文档已预置' });
  } catch (error) {
    if (/必填|必须/.test(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return errorResponse(res, error);
  }
});

module.exports = router;
