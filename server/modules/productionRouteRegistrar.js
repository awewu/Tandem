const { mountProductionRouteCatalog } = require('./productionRouteCatalog');

function registerProductionRoutes(app, context) {
  const {
    authenticateToken,
    checkRole,
    engines,
    logger = console
  } = context;

  engines.houseTypeLibrary.loadData();
  logger.log('OK house type library loaded; API exposed by core-api (/api/house-types)');

  mountProductionRouteCatalog(app, {
    ...context,
    adminGuard: [authenticateToken, checkRole(['store_admin', 'rheem_admin'])],
    logger
  });

  logger.log('OK production route registrar complete');
}

module.exports = {
  registerProductionRoutes
};
