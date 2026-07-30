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

test('site material cards show code-backed recommended dimensions without owner rows', () => {
  const materials = source.slice(source.indexOf('const MOCK_SITE_MATERIALS = ['), source.indexOf('function statusMeta('));
  assert.doesNotMatch(materials, /recommendedSize: '1660 x 550 px'/);
  assert.doesNotMatch(materials, /name: '首页 Hero 主视觉'/);
  assert.equal((materials.match(/recommendedSize: '940 x 900 px'/g) || []).length, 3);
  assert.doesNotMatch(materials, /owner:/);

  const panel = source.slice(source.indexOf('function SiteMaterialMockPanel('), source.indexOf('function SiteNewsRichTextEditor('));
  assert.match(panel, /建议尺寸：\{item\.recommendedSize\}/);
  assert.doesNotMatch(panel, /责任方：\{item\.owner\}/);
});
