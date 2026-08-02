#!/usr/bin/env node

const { MODULES, MODULE_IDS } = require('../../server/modules/productModules/product-module-registry');

const failures = [];
if (!MODULES.rysnova) failures.push('consumer Rysnova module is missing');
if (MODULES.rysnovaBim) failures.push('retired Rysnova BIM module must not be registered');
if (MODULE_IDS.RYSNOVA_ENGINEERING_SUPPORT) failures.push('retired Rysnova BIM module id must not be registered');
if (MODULES.rysnova?.apiNamespace !== '/api/v2/diagnosis') {
  failures.push('consumer Rysnova module must remain owned by /api/v2/diagnosis');
}

if (failures.length) {
  console.error(`Module Independence Check: failures = ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Module Independence Check: consumer module retained; Rysnova BIM retired');
