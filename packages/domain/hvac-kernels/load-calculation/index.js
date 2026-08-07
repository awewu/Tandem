const LoadCalculationEngineV3 = require('./LoadCalculationEngineV3');
const engine = new LoadCalculationEngineV3();

/**
 * 负荷计算 facade。
 *
 * ⚠️ 历史缺陷（2026-08-04 修复）：引擎签名为
 *     calculate(params, city, method, hourly8760)   ← city 是**第 2 个位置参数**
 * 而本 facade 原本只传 `params`，city 恒为 undefined，
 * 引擎第一步取气候数据即抛「未找到城市 undefined 的气候数据」——
 * **负荷内核经 facade 调用时永远失败**，且失败被上游静默吞掉，长期无人察觉。
 *
 * 现在：city 可来自第 2 个参数，或从 params.city 回落，兼容两种调用风格。
 * 这是内核入参契约的一部分（宪章 §5.4-A 铁律 2）。
 *
 * @param {Object} params 建筑参数（含 area / country 等；city 可放这里）
 * @param {String} [city] 城市；缺省时取 params.city
 * @param {String} [method] 计算方法
 * @param {Boolean} [hourly8760] 是否 8760 小时模拟
 */
function calculateLoad(params, city, method, hourly8760) {
  if (!engine.calculate) return engine;
  const resolvedCity = city || (params && params.city);
  return method === undefined
    ? engine.calculate(params, resolvedCity)
    : engine.calculate(params, resolvedCity, method, hourly8760);
}

module.exports = { calculateLoad, LoadCalculationEngineV3 };
