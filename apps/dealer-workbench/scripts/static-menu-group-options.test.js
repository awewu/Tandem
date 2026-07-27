const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const adapterPath = path.join(__dirname, '..', 'src', 'lib', 'brand-product-adapter.ts');
const shellPath = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'comfort',
  '[[...section]]',
  'BrandSiteConsoleShell.tsx'
);
const adapter = fs.readFileSync(adapterPath, 'utf8');
const shell = fs.readFileSync(shellPath, 'utf8');

test('Everhot menu group options mirror the local website navigation categories', () => {
  for (const label of [
    '家用中央空调',
    '地暖系统',
    '全热新风',
    '热水系统',
    '燃气冷凝壁挂炉',
    '零冷水燃气热水器',
    '空气能热水器',
    '容积式燃气热水器',
    '电热水器',
    '采暖热水两联供',
  ]) {
    assert.match(adapter, new RegExp(`'${label}'`));
  }
});

test('menu group values are edited through option controls in the brand product editor', () => {
  assert.match(shell, /getBrandMenuGroupOptions\(brandCode, draft\.websiteMenuCategory\)/);
  assert.match(shell, /getBrandMenuGroupOptions\(\s*String\(product\.raw\.brand \|\| brandCode\),\s*draft\.websiteMenuCategory/s);
  assert.match(shell, /<select[\s\S]+value=\{value\}[\s\S]+option\.label[\s\S]+<\/select>/);
});

test('unknown existing menu group values are preserved as selectable current values', () => {
  assert.match(adapter, /if \(current && !values\.includes\(current\)\) values\.unshift\(current\);/);
  assert.match(adapter, /\$\{value\}（当前值）/);
});
