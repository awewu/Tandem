/**
 * @rhautt/engines — 精算引擎共享表面（Strangler 收口点）。
 *
 * 目的：NestJS 目标端通过 `require('@rhautt/engines')` 干净消费计算引擎，
 * 取代散落在各服务里的深层相对 require（`../../../../../server/core/X`）。
 *
 * 当前实现：从 legacy `server/core` / `server/engines` 重导出——单一收口点。
 * 后续：引擎逐个迁入本包，重导出替换为真实实现（消费方 import 路径不变）。
 */
const ExportEngine = require('../../../server/core/ExportEngine');
const PromotionEngine = require('../../../server/core/PromotionEngine');
const EconetPricingEngine = require('../../../server/engines/EconetPricingEngine');

module.exports = {
  ExportEngine,
  PromotionEngine,
  EconetPricingEngine,
};
