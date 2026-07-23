const { FreshAirProEngine } = require('./FreshAirProEngine');
const DOASComplianceEngine = require('./DOASComplianceEngine');
const freshAirEngine = new FreshAirProEngine();
const doasEngine = new DOASComplianceEngine();

/** 常规新风 / DOAS 统一入口，level='standard'|'doas' */
function designFreshAir(params) { return freshAirEngine.generateDesign(params); }
function checkDOASCompliance(design) { return doasEngine.checkDOASCompliance(design); }
function calculateAirVolume(area, peopleCount, rooms, standard) {
  return freshAirEngine.calculateAirVolume(area, peopleCount, rooms, standard);
}

module.exports = { designFreshAir, checkDOASCompliance, calculateAirVolume, FreshAirProEngine, DOASComplianceEngine };
