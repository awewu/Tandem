#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRODUCT_HARNESS = path.join(__dirname, 'product-consolidation-harness.js');
const PRODUCT_REPORT = path.join(__dirname, 'product-consolidation-report.json');
const REPORT_JSON = path.join(__dirname, 'architecture-harness-report.json');
const REPORT_MD = path.join(__dirname, 'architecture-harness-report.md');

const ACTIVE_PAGES = [
  'archive/legacy-ui/public/index.html',
  'archive/legacy-ui/public/index-ready.html',
  'archive/legacy-ui/public/privacy.html',
  'archive/legacy-ui/public/consent.html'
];

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function extractAssetReferences(html) {
  const refs = [];
  const regex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html))) refs.push(match[1]);
  return refs;
}

function isReactCandidateReference(ref) {
  if (!ref || /^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(ref)) return false;
  return [
    /^\/?src\//,
    /^\/?@vite\//,
    /^\/?node_modules\//,
    /^\/?(dist|build)\/assets\/.*\.(js|css)$/i,
    /^\/?(index|app)\.[jt]sx?$/i,
    /^\/?src\/main\.[jt]sx?$/i
  ].some(pattern => pattern.test(ref));
}

function activeReactCandidateReferences() {
  const offenders = [];
  for (const page of ACTIVE_PAGES) {
    const abs = path.join(ROOT, page);
    if (!fs.existsSync(abs)) continue;
    for (const ref of extractAssetReferences(read(abs))) {
      if (isReactCandidateReference(ref)) offenders.push({ page, ref });
    }
  }
  return offenders;
}

function main() {
  execFileSync(process.execPath, [PRODUCT_HARNESS], {
    cwd: ROOT,
    stdio: 'inherit'
  });

  const consolidation = JSON.parse(read(PRODUCT_REPORT));
  const reactCandidateProductionReferences = activeReactCandidateReferences();
  const summary = {
    routeDefinitions: consolidation.summary.routeDefinitions,
    duplicateRouteGroups: consolidation.summary.duplicateRouteGroups,
    unassignedRouteGroups: consolidation.summary.unassignedRouteGroups,
    unmatchedActiveFrontendApiCalls: consolidation.summary.unmatchedActiveFrontendApiCalls,
    productionReactCandidateReferences: reactCandidateProductionReferences.length,
    activePages: ACTIVE_PAGES.filter(file => fs.existsSync(path.join(ROOT, file))).length
  };

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    routes: {
      routeDefinitions: summary.routeDefinitions,
      duplicateRouteGroups: consolidation.duplicateRouteGroups || [],
      unassignedRouteGroups: consolidation.unassignedRouteGroups || [],
      phase1BackendCleanupMatrix: consolidation.phase1BackendCleanupMatrix || []
    },
    frontendApi: {
      activePages: ACTIVE_PAGES,
      activeFrontendApiCalls: consolidation.activeFrontendApiCalls || [],
      unmatchedActiveFrontendApiCalls: consolidation.unmatchedActiveFrontendApiCalls || [],
      reactCandidateProductionReferences
    },
    contractScopes: {
      productionApi: 'active /api and retained /api/v2 route ownership',
      reactServiceLayer: 'candidate - excluded from production navigation until contract and visual evidence pass'
    }
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, [
    '# Architecture Harness Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Route definitions: ${summary.routeDefinitions}`,
    `- Duplicate route groups: ${summary.duplicateRouteGroups}`,
    `- Unassigned route groups: ${summary.unassignedRouteGroups}`,
    `- Unmatched active frontend API calls: ${summary.unmatchedActiveFrontendApiCalls}`,
    `- Production React candidate references: ${summary.productionReactCandidateReferences}`,
    ''
  ].join('\n'));

  console.log(`Architecture Harness: routes = ${summary.routeDefinitions}, duplicates = ${summary.duplicateRouteGroups}, unassigned = ${summary.unassignedRouteGroups}, unmatched = ${summary.unmatchedActiveFrontendApiCalls}, reactCandidateRefs = ${summary.productionReactCandidateReferences}`);

  if (
    summary.duplicateRouteGroups > 0 ||
    summary.unassignedRouteGroups > 0 ||
    summary.unmatchedActiveFrontendApiCalls > 0 ||
    summary.productionReactCandidateReferences > 0
  ) {
    process.exit(1);
  }
}

main();
