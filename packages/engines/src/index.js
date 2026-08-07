/**
 * @rhautt/engines — 精算引擎共享表面（Strangler 收口点）。
 *
 * 目的：NestJS 目标端通过 `require('@rhautt/engines')` 干净消费计算引擎，
 * 取代散落在各服务里的深层相对 require（`../../../../../server/core/X`）。
 *
 * 实现：引擎已迁入本包（cutover M1），不再依赖 legacy `server/`。
 * legacy `server/` 内部仍保留各自副本供其自用，随 server/ 退役(M4)一并清除。
 */
const ExportEngine = require('./ExportEngine');
const PromotionEngine = require('./PromotionEngine');
const EconetPricingEngine = require('./EconetPricingEngine');

module.exports = {
  ExportEngine,
  PromotionEngine,
  EconetPricingEngine,
};
