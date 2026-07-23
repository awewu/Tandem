const fs = require('fs');
const path = require('path');
const REPO_ROOT = path.resolve(__dirname);
const root = path.join(REPO_ROOT, 'archive', 'legacy-ui', 'public');
const files = fs.readdirSync(root, { recursive: true })
  .filter(f => f.endsWith('.html'))
  .map(f => path.relative(REPO_ROOT, path.join(root, f)).replace(/\\/g, '/'))
  .sort();
const active = new Set([
  'archive/legacy-ui/public/business-console.html',
  'archive/legacy-ui/public/consent.html',
  'archive/legacy-ui/public/customer-view.html',
  'archive/legacy-ui/public/designer.html',
  'archive/legacy-ui/public/index-ready.html',
  'archive/legacy-ui/public/index.html',
  'archive/legacy-ui/public/pain-diagnosis.html',
  'archive/legacy-ui/public/privacy.html',
  'archive/legacy-ui/public/rysnova-bim-designer.html'
]);
const migrationCandidate = new Set([
  'archive/legacy-ui/public/construction-management.html',
  'archive/legacy-ui/public/designer-legacy.html',
  'archive/legacy-ui/public/quotation-pro.html',
  'archive/legacy-ui/public/smart-routing.html',
  'archive/legacy-ui/public/solution-view.html',
  'archive/legacy-ui/public/technical-drawings.html',
  'archive/legacy-ui/public/technical-manual.html',
  'archive/legacy-ui/public/technical-support.html',
  'archive/legacy-ui/public/workorders.html'
]);
const archive = new Set([
  'archive/legacy-ui/public/admin-dashboard.html',
  'archive/legacy-ui/public/analytics.html',
  'archive/legacy-ui/public/delivery-center.html',
  'archive/legacy-ui/public/design-review.html',
  'archive/legacy-ui/public/drawing-engine.html',
  'archive/legacy-ui/public/floorplan-bim.html',
  'archive/legacy-ui/public/growth-hub.html',
  'archive/legacy-ui/public/index-portal-legacy.html'
]);
const staticInventory = new Set([
  'archive/legacy-ui/public/admin/marketing.html',
  'archive/legacy-ui/public/admin/products.html'
]);
const manifest = {
  generatedBy: 'archive/legacy-ui/public/legacy-surface-manifest.json (reconciled after migration to archive/legacy-ui)',
  policy: 'Only active pages may appear in default production navigation. Non-active pages stay behind productionStaticSurfaceGuard until migrated or archived.',
  surfaces: {
    active: files.filter(f => active.has(f)),
    'migration-candidate': files.filter(f => migrationCandidate.has(f)),
    archive: files.filter(f => archive.has(f)),
    'static-inventory': files.filter(f => staticInventory.has(f))
  }
};
for (const f of files) {
  if (!active.has(f) && !migrationCandidate.has(f) && !archive.has(f) && !staticInventory.has(f)) {
    manifest.surfaces.archive.push(f);
  }
}
fs.writeFileSync(path.join(REPO_ROOT, 'archive', 'legacy-ui', 'public', 'legacy-surface-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('wrote', files.length, 'html files');
