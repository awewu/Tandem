/** Rhautt Nexus HVAC Calculation Kernels */
module.exports = {
  hotWater:         require('./hot-water'),
  heating:          require('./heating'),
  airConditioning:  require('./air-conditioning'),
  freshAir:         require('./fresh-air'),
  loadCalculation:  require('./load-calculation'),
  hydraulic:        require('./hydraulic'),
  quotation:        require('./quotation'),
  noise:            require('./noise'),
  water:            require('./water-system'),
};
