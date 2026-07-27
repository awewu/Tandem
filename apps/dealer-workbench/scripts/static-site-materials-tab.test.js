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

test('brand site content switch keeps products and simulated materials separate', () => {
  assert.match(source, /type ContentTab = 'products' \| 'materials';/);
  assert.match(source, /useState<ContentTab>\('products'\)/);
  assert.match(source, /activeContentTab === 'products' \? \(/);
  assert.match(source, /<SiteMaterialMockPanel brandCode=\{normalizedBrandCode\} \/>/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'products'\}/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'materials'\}/);
});

test('simulated non-product website material records cover expected website areas', () => {
  for (const label of ['首页 Hero 主视觉', '品牌故事图文', '服务入口 Banner', '页脚资质素材']) {
    assert.match(source, new RegExp(label));
  }

  assert.match(source, /Everhot 官网首页素材 manifest/);
  assert.match(source, /status: '模拟数据'/);
  assert.match(source, /DAM/);
});

test('materials tab syncs through the local homepage manifest without DAM wiring', () => {
  assert.match(source, /siteMaterials\.upload/);
  assert.match(source, /homepageSrc/);
  assert.doesNotMatch(source, /brandSites\.(materials|assets|dam)/);
  assert.doesNotMatch(source, /api\/v2\/brand-sites\/.*materials/);
  assert.doesNotMatch(source, /api\/v2\/dam/);
});
