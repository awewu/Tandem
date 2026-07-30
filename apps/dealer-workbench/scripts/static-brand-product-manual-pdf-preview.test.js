const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourcePath = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'comfort',
  '[[...section]]',
  'BrandSiteConsoleShell.tsx'
);

const source = fs.readFileSync(sourcePath, 'utf8');

test('brand product manual pdf editor reuses a row component with page preview button', () => {
  assert.match(source, /function ProductManualPdfUploader/);
  assert.match(source, /function ProductManualPdfItem/);
  assert.match(source, /<ProductManualPdfItem/);
  assert.match(source, /product-manual-pdf-upload-row/);
  assert.match(source, /product-manual-pdf-inline-list/);
  assert.match(source, /product-manual-pdf-chip/);
  assert.match(source, /product-manual-pdf-remove/);
  assert.match(source, /href=\{manual\.previewUrl\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /className="btn btn-brand btn-sm"/);
  assert.match(source, /<ExternalLink size=\{13\} \/>/);
  assert.doesNotMatch(source, /<iframe title=\{`PDF preview/);
});
