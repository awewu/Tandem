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
  assert.match(source, /<SiteMaterialMockPanel \/>/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'products'\}/);
  assert.match(source, /aria-pressed=\{activeContentTab === 'materials'\}/);
});

test('simulated non-product website material records cover expected website areas', () => {
  for (const label of ['首页 Hero 主视觉', '品牌故事图文', '服务入口 Banner', '页脚资质素材']) {
    assert.match(source, new RegExp(label));
  }

  assert.match(source, /当前仅用于验证运营流程，未接入真实 DAM、生产素材库或官网发布流程。/);
  assert.match(source, /当前为模拟数据/);
  assert.match(source, /真实 DAM 接入不在本次范围/);
});

test('materials tab remains UI-only without real material API wiring', () => {
  assert.doesNotMatch(source, /brandSites\.(materials|assets|dam)/);
  assert.doesNotMatch(source, /api\/v2\/brand-sites\/.*materials/);
  assert.doesNotMatch(source, /api\/v2\/dam/);
});
