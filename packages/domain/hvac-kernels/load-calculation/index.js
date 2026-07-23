const LoadCalculationEngineV3 = require('./LoadCalculationEngineV3');
const engine = new LoadCalculationEngineV3();
function calculateLoad(params) { return engine.calculate ? engine.calculate(params) : engine; }
module.exports = { calculateLoad, LoadCalculationEngineV3 };
