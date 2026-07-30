const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'products', 'page.tsx');
const cssPath = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const source = fs.readFileSync(pagePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

test('product catalog table keeps model and brand as separate columns', () => {
  const tableHead = source.slice(source.indexOf('product-catalog-table'), source.indexOf('<tbody>'));
  assert.match(tableHead, /<th>产品库分类<\/th>/);
  assert.match(tableHead, /<th>产品<\/th>/);
  assert.match(tableHead, /<th>产品型号<\/th>/);
  assert.match(tableHead, /<th>品牌<\/th>/);
});

test('product catalog row hides low-value raw codes from category and product name cells', () => {
  const row = source.slice(source.indexOf('function ProductCatalogRow('), source.indexOf('function ProductCatalogImagePreview('));
  assert.doesNotMatch(row, /product\.category \|\| '-'/);
  assert.doesNotMatch(row, /product\.sku \|\| '未生成编码'/);
  assert.doesNotMatch(row, /型号 \{product\.model \|\| '待补齐'\}/);
  assert.match(row, /<span className="mono-cell">\{product\.model \|\| '待补齐'\}<\/span>/);
});

test('product catalog status and action cells stay on one line', () => {
  assert.match(css, /\.product-catalog-table th:nth-child\(9\),\s*\.product-catalog-table td:nth-child\(9\) \{\s*width:9%;\s*white-space:nowrap;\s*\}/);
  assert.match(css, /\.product-catalog-table th:nth-child\(10\),\s*\.product-catalog-table td:nth-child\(10\) \{\s*width:140px;\s*white-space:nowrap;\s*\}/);
  assert.match(css, /\.product-catalog-table \.status-pill,[\s\S]*?white-space:nowrap;/);
  assert.match(css, /\.product-catalog-row-actions \{\s*display:inline-flex;\s*flex-wrap:nowrap;\s*justify-content:center !important;\s*white-space:nowrap;\s*\}/);
  assert.match(source, /className="table-row-actions product-catalog-row-actions"/);
});

test('all standard table action columns are centered', () => {
  assert.match(css, /\.table td:last-child,\s*\.table th:last-child \{\s*text-align:center !important;\s*\}/);
  assert.match(css, /\.table-row-actions,\s*\.row-edit-actions \{\s*display:flex;\s*align-items:center;\s*justify-content:center !important;/);
});

test('product catalog category cell only displays product category binding path', () => {
  const row = source.slice(source.indexOf('function ProductCatalogRow('), source.indexOf('function ProductCatalogImagePreview('));
  assert.doesNotMatch(row, /\[product\.materialCategory, product\.productLine, product\.categoryPath\]\.filter\(Boolean\)\.join\(' \/ '\)/);
  assert.match(row, /product\.categoryPath \|\|\s*websiteCategory \|\|\s*product\.category \|\|/);
});
