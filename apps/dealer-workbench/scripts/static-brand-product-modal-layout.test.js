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
const modalStart = source.indexOf('function ProductEditModal(');
const modalEnd = source.indexOf('function FormField(', modalStart);
const modalSource = source.slice(modalStart, modalEnd);

test('brand product create and edit modal hides unused ERP material information block', () => {
  assert.notEqual(modalStart, -1);
  assert.notEqual(modalEnd, -1);
  assert.doesNotMatch(modalSource, /导入物料信息|\\u5bfc\\u5165\\u7269\\u6599\\u4fe1\\u606f/);
  assert.doesNotMatch(modalSource, /<span className="badge badge-grey">ERP<\/span>/);
  assert.match(modalSource, /<h3>基础信息<\/h3>/);
  assert.match(modalSource, /<h3>官网展示<\/h3>/);
  assert.match(modalSource, /<h3>图片 \/ 素材<\/h3>/);
  assert.match(modalSource, /product-edit-section-basic/);
  assert.match(modalSource, /product-edit-section-website/);
  assert.match(modalSource, /product-edit-section-assets/);
  assert.match(source, /\.product-edit-section-basic \{/);
  assert.match(source, /\.product-edit-section-website,\s*\.product-edit-section-assets \{/);
});
