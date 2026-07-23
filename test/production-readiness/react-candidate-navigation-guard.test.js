const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const reportPath = path.join(ROOT, 'audit', 'architecture-harness-report.json');
const ACTIVE_PAGES = [
  'public/index.html',
  'public/index-ready.html',
  'public/pain-diagnosis.html',
  'public/customer-share.html',
  'public/customer-view.html',
  'public/designer.html',
  'public/rysnova-bim-designer.html',
  'public/staff-portal.html',
  'public/business-console.html',
  'public/login.html'
];

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

describe('React candidate production navigation guard', () => {
  test('architecture harness keeps React candidate surface out of active production navigation', () => {
    execSync('node audit/architecture-harness.js', {
      cwd: ROOT,
      stdio: 'pipe'
    });

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.summary.productionReactCandidateReferences).toBe(0);
    expect(report.frontendApi.reactCandidateProductionReferences).toEqual([]);
    expect(report.contractScopes.reactServiceLayer).toContain('candidate');
  });

  test('active HTML href/src attributes do not point at React/Vite candidate assets', () => {
    const offenders = [];
    for (const page of ACTIVE_PAGES) {
      const abs = path.join(ROOT, page);
      if (!fs.existsSync(abs)) continue;
      for (const ref of extractAssetReferences(fs.readFileSync(abs, 'utf8'))) {
        if (isReactCandidateReference(ref)) offenders.push({ page, ref });
      }
    }

    expect(offenders).toEqual([]);
  });
});
