/**
 * 热水系统计算内核 Facade
 * 纯函数入口，脱离 HTTP/租户上下文
 */

const HotWaterEngine = require('./HotWaterEngine');

const engine = new HotWaterEngine();

/**
 * 计算住宅热水负荷
 * @param {Object} params - {area, persons, city, floors, bathrooms?, hasBathtub?}
 * @returns {Object} - {hourlyHeatLoad, dailyUsage, heaterSelection, circulationFlow, pipeSizing}
 */
function calculateResidentialHotWater(params) {
  return engine.calculateResidential(params);
}

/**
 * 计算商业热水负荷
 * @param {Object} params - {buildingType, beds?, seats?, area}
 * @returns {Object}
 */
function calculateCommercialHotWater(params) {
  return engine.calculateCommercial(params);
}

module.exports = {
  calculateResidentialHotWater,
  calculateCommercialHotWater,
  // 保留原类导出给需要直接用的地方
  HotWaterEngine
};
