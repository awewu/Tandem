const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const productsPagePath = path.join(__dirname, '..', 'src', 'app', 'products', 'page.tsx');
const brandShellPath = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'comfort',
  '[[...section]]',
  'BrandSiteConsoleShell.tsx'
);
const adapterPath = path.join(__dirname, '..', 'src', 'lib', 'brand-product-adapter.ts');

const productsPage = fs.readFileSync(productsPagePath, 'utf8');
const brandShell = fs.readFileSync(brandShellPath, 'utf8');
const adapter = fs.readFileSync(adapterPath, 'utf8');

test('dealer workbench exposes the product category manager route and entry', () => {
  assert.match(productsPage, /type ProductModule = 'catalog' \| 'materials' \| 'base' \| 'categories';/);
  assert.match(productsPage, /value === 'materials' \|\| value === 'base' \|\| value === 'categories'/);
  assert.match(productsPage, /setModule\('categories'\)/);
  assert.match(productsPage, /activeModule === 'categories' \? \(/);
  assert.match(productsPage, /<ProductCategoryManagerCrudView canWrite=\{canWrite\} \/>/);
  assert.match(productsPage, /brandProductCategories\.list\(\{ brandCode \}\)/);
});

test('product edit persists selected category ids without relying on legacy text fields', () => {
  assert.match(productsPage, /const categoryLevel1Id = text\(draft\.categoryLevel1Id\);/);
  assert.match(productsPage, /const categoryLevel2Id = text\(draft\.categoryLevel2Id\);/);
  assert.match(productsPage, /const categoryLevel3Id = text\(draft\.categoryLevel3Id\);/);
  assert.match(productsPage, /categoryLevel1Id,\s*categoryLevel2Id,\s*categoryLevel3Id: categoryLevel3Id \|\| null,/s);
  assert.match(productsPage, /cat: websiteCategory \|\| category,/);
  assert.match(productsPage, /websiteMenuCategory: websiteCategory,/);
});

test('brand product list displays category paths and sends category filters with page controls', () => {
  assert.match(adapter, /categoryPath: string;/);
  assert.match(adapter, /const categoryPath = text\(product\.categoryPath\) \|\| text\(brandMeta\.categoryPath\);/);
  assert.match(adapter, /page: String\(page\),\s*pageSize: String\(pageSize\),/s);
  assert.match(adapter, /if \(categoryLevel1Id\) query\.categoryLevel1Id = categoryLevel1Id;/);
  assert.match(adapter, /if \(categoryLevel2Id\) query\.categoryLevel2Id = categoryLevel2Id;/);
  assert.match(adapter, /if \(categoryLevel3Id\) query\.categoryLevel3Id = categoryLevel3Id;/);
  assert.match(brandShell, /if \(categoryPath\) return categoryPath;/);
  assert.match(brandShell, /page,\s*pageSize,\s*keyword,\s*status: statusFilter,\s*\.\.\.categoryFilterQuery\(categoryFilter\),/);
});
