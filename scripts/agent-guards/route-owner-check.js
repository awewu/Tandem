#!/usr/bin/env node

const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const harness = path.join(root, 'audit', 'product-consolidation-harness.js');
const reportPath = path.join(root, 'audit', 'product-consolidation-report.json');

execFileSync(process.execPath, [harness], {
  cwd: root,
  stdio: 'inherit'
});

delete require.cache[require.resolve(reportPath)];
const report = require(reportPath);

const unassigned = report.summary?.unassignedRouteGroups || 0;
const duplicates = report.summary?.duplicateRouteGroups || 0;
const unmatchedActive = report.summary?.unmatchedActiveFrontendApiCalls || 0;
const activePages = report.summary?.activePages || 0;

console.log(`Route Surface Check: active pages = ${activePages}, duplicate route groups = ${duplicates}, unassigned route groups = ${unassigned}, unmatched active API calls = ${unmatchedActive}`);

if (unassigned > 0) {
  console.error('Route owner registry is incomplete. Run npm run harness:consolidation and update server/modules/routeOwnership.js.');
  process.exit(1);
}

if (duplicates > 0) {
  console.error('Production route surface contains duplicate route definitions. Consolidate shadowed routes before release.');
  process.exit(1);
}

if (unmatchedActive > 0) {
  console.error('Active product pages call APIs that are not mounted in production. Fix frontend/backend contract before release.');
  process.exit(1);
}
