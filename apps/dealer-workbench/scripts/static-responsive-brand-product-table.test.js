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

test('brand product table keeps six compact high-signal columns', () => {
  const columns = source.match(/const PRODUCT_COLUMNS = \[([\s\S]*?)\];/)?.[1] || '';
  assert.equal((columns.match(/'/g) || []).length / 2, 6);
  for (const label of ['产品', '产品型号', '分类菜单', '图片', '排序', '操作']) {
    assert.match(columns, new RegExp(label.replace('/', '\\/')));
  }
});

test('brand product summary row renders six body cells', () => {
  const row = source.slice(source.indexOf('function ProductSummaryRow('), source.indexOf('function ProductEditModal('));
  assert.equal((row.match(/<td/g) || []).length, 6);
  for (const className of [
    'brand-product-identity-col',
    'brand-product-model-col',
    'brand-product-taxonomy-col',
    'brand-product-image-col',
    'brand-product-order-col',
    'brand-product-actions-col',
  ]) {
    assert.match(row, new RegExp(className));
  }
});

test('normal desktop table stays centered inside the product panel', () => {
  assert.match(source, /\.brand-product-table-wrap \{\s*display: flex;\s*justify-content: center;\s*overflow-x: hidden;/);
  assert.match(source, /\.brand-product-table \{\s*width: min\(100%, 1120px\);\s*table-layout: fixed;/);
  assert.doesNotMatch(source, /\.brand-product-table \{\s*min-width: 1480px;/);
});

test('desktop table column widths fit exactly within the workbench content width', () => {
  const widths = [...source.matchAll(/\.brand-product-table th:nth-child\(\d\),\s*\.brand-product-table td:nth-child\(\d\) \{\s*width: (\d+)%;/g)]
    .map((match) => Number(match[1]));
  assert.deepEqual(widths, [22, 15, 16, 12, 8, 27]);
  assert.equal(widths.reduce((sum, value) => sum + value, 0), 100);
});

test('long product text is constrained inside cells', () => {
  assert.match(source, /text-overflow: ellipsis;/);
  assert.match(source, /white-space: nowrap;/);
  assert.match(source, /\.brand-product-table \.inline-edit-input \{\s*min-width: 0;\s*max-width: 100%;/);
  assert.match(source, /\.inline-edit-input \{\s*min-width: 0;\s*width: 100%;/);
});
