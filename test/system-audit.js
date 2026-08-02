#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const requiredFiles = [
  'server-production.js',
  'server/modules/productionAppFactory.js',
  'server/modules/productionRouteCatalog.js',
  'server/modules/routeOwnership.js',
  'server/routes/marketing.js',
  'server/routes/products.js',
  'services/api/src/modules/auth/auth.controller.ts',
  'services/api/src/modules/module-boundary.ts',
  'contracts/openapi/rhautt-nexus-v2.openapi.json'
];
const retiredFiles = [
  'server/routes/supreme-api.js',
  'server/routes/revit-integration.js',
  'server/routes/workflows.js',
  'server/routes/hotwater.js',
  'server/routes/design.js',
  'server/routes/bim-export.js',
  'server/routes/econet.routes.js',
  'server/modules/design/design.routes.js',
];

const failures = [];
for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) failures.push(`missing required file: ${relativePath}`);
}
for (const relativePath of retiredFiles) {
  if (fs.existsSync(path.join(ROOT, relativePath))) failures.push(`retired file still exists: ${relativePath}`);
}

const catalog = fs.readFileSync(path.join(ROOT, 'server/modules/productionRouteCatalog.js'), 'utf8');
for (const retiredToken of ['supreme-api', 'revit-integration', '../routes/workflows', '../routes/hotwater', 'econet.routes']) {
  if (catalog.includes(retiredToken)) failures.push(`production catalog still references: ${retiredToken}`);
}

console.log(`System audit: required=${requiredFiles.length}, retired=${retiredFiles.length}, failures=${failures.length}`);
if (failures.length > 0) {
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
