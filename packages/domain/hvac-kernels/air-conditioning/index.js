const { AirConditioningEngine } = require('./AirConditioningEngine');
const engine = new AirConditioningEngine();

function designAirConditioning(params) { return engine.generateDesign(params); }
function calculateCoolingLoad(params) { return engine.calculateCoolingLoad(params); }
function calculateHeatingLoad(params) { return engine.calculateHeatingLoad(params); }

module.exports = { designAirConditioning, calculateCoolingLoad, calculateHeatingLoad, AirConditioningEngine };
