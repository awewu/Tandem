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
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'api.ts'), 'utf8');
const everhotPublicPath = path.join(__dirname, '..', '..', 'everhot-cn', 'public');
const siteMaterialsJs = fs.readFileSync(path.join(everhotPublicPath, 'js', 'site-materials.js'), 'utf8');
const homepageHtml = fs.readFileSync(path.join(everhotPublicPath, 'index.html'), 'utf8');

test('brand site content switch keeps products and simulated materials separate', () => {
  assert.match(source, /type ContentTab = .*'basic'.*'products'.*'materials'.*'news'.*'inquiries'/);
  assert.match(source, /useState<ContentTab>\('basic'\)/);
  assert.match(source, /activeContentTab === 'products' \? \(/);
  assert.match(source, /<SiteMaterialMockPanel brandCode=\{normalizedBrandCode\} \/>/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'products'\}/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'materials'\}/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'inquiries'\}/);
  assert.match(source, /首页模块/);
  assert.doesNotMatch(source, />其他素材\s*<\/button>/);
});

test('simulated non-product website material records cover expected website areas', () => {
  for (const label of ['品牌故事图文', '服务入口 Banner', '页脚资质素材']) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, /name: '首页 Hero 主视觉'/);

  assert.match(source, /现有首页 manifest/);
  assert.match(source, /status: '模拟数据'/);
  assert.match(source, /DAM/);
});

test('materials tab syncs through the local homepage manifest without DAM wiring', () => {
  assert.match(source, /siteMaterials\.upload/);
  assert.match(source, /resetMaterialDefault/);
  assert.match(source, /siteMaterials\.resetDefault\(brandCode, key\)/);
  assert.match(source, />\s*恢复默认\s*<\/button>/);
  assert.match(apiSource, /resetDefault:\s*\(brandCode: string, key: string\)/);
  assert.match(apiSource, /JSON\.stringify\(\{ key, resetDefault: true \}\)/);
  assert.match(source, /siteMaterials\.saveModule\(brandCode, 'home-audience-cards'/);
  assert.match(source, /homepageSrc/);
  assert.doesNotMatch(source, /brandSites\.(materials|assets|dam)/);
  assert.doesNotMatch(source, /api\/v2\/brand-sites\/.*materials/);
  assert.doesNotMatch(source, /api\/v2\/dam/);
});

test('homepage modules expose editable audience entry card fields in the existing table style', () => {
  assert.match(source, /<h4>首页入口卡片<\/h4>/);
  assert.match(source, /className="hero-carousel-table site-audience-table"/);
  assert.match(source, /className="hero-carousel-table-wrap site-audience-table-wrap"/);
  assert.match(source, /\.site-audience-table-wrap\s*\{[^}]*overflow-x:\s*hidden;/);
  assert.match(source, /\.site-audience-table\s*\{[^}]*table-layout:\s*fixed;/);
  assert.doesNotMatch(source, /\.site-audience-table\s*\{[^}]*min-width:\s*1560px;/);
  for (const field of ['tagZh', 'tagEn', 'title', 'description', 'primaryLabel', 'primaryHref', 'secondaryLabel', 'secondaryHref']) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /home-audience-cards/);
  assert.match(source, /DEFAULT_AUDIENCE_CARDS/);
});

test('everhot homepage applies audience card manifest content', () => {
  assert.match(homepageHtml, /data-audience-card="residential"/);
  assert.match(homepageHtml, /data-audience-card="commercial"/);
  assert.match(homepageHtml, /data-audience-card="professionals"/);
  assert.match(siteMaterialsJs, /applyAudienceCards\(manifest\['home-audience-cards'\]\)/);
  assert.match(siteMaterialsJs, /function applyAudienceLink/);
});

test('structured product content editor omits deprecated image url fields', () => {
  assert.match(source, /官网标题/);
  assert.match(source, /官方文案/);
  assert.doesNotMatch(source, /label="图标"/);
  assert.doesNotMatch(source, /label="规格图地址"/);
  assert.doesNotMatch(source, /<GalleryEditor/);
  assert.doesNotMatch(source, /function GalleryEditor/);
});

test('site basic settings reset is scoped to each section', () => {
  assert.match(source, /function resetFieldGroupToCurrentDefault/);
  assert.match(source, /function resetListToCurrentDefault/);
  assert.doesNotMatch(source, /恢复重置状态/);
  assert.doesNotMatch(source, /function resetToCurrentDefault/);
});
