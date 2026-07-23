const { HeatingSystemEngine } = require('./HeatingSystemEngine');
const engine = new HeatingSystemEngine();
function designHeatingSystem(params) { return engine.generateDesign(params); }
function calculateHeatLoad(area, floorArea, insulation, city) { return engine.calculateHeatLoad(area, floorArea, insulation, city); }
module.exports = { designHeatingSystem, calculateHeatLoad, HeatingSystemEngine };
