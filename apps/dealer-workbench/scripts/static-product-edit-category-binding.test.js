const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'products', 'page.tsx');
const source = fs.readFileSync(pagePath, 'utf8');

test('product edit loads current brand product categories', () => {
  assert.match(source, /brandProductCategories\.list\(\{ brandCode \}\)/);
  assert.match(source, /normalizeProductCategoryTree\(result\)/);
  assert.match(source, /editing && brandCode \? \['\/api\/v2\/brand-product-categories', brandCode, 'product-edit'\] : null/);
});

test('product edit draft and payload persist brand category binding ids', () => {
  assert.match(source, /categoryLevel1Id: string;/);
  assert.match(source, /categoryLevel2Id: string;/);
  assert.match(source, /categoryLevel3Id: string;/);
  assert.match(source, /categoryLevel1Id,\s*categoryLevel2Id,\s*categoryLevel3Id: categoryLevel3Id \|\| null,/s);
  assert.match(source, /\[brand\]: \{\s*\.\.\.previousBrandMeta,[\s\S]*categoryLevel1Id,[\s\S]*categoryLevel2Id,[\s\S]*categoryLevel3Id: categoryLevel3Id \|\| null,/);
});

test('product edit exposes required level-1 and level-2 selectors with optional level-3 selector', () => {
  assert.match(source, /value=\{draft\.categoryLevel1Id\}[\s\S]*?required[\s\S]*?请选择一级分类/);
  assert.match(source, /value=\{draft\.categoryLevel2Id\}[\s\S]*?required[\s\S]*?disabled=\{!draft\.categoryLevel1Id\}/);
  assert.match(source, /value=\{draft\.categoryLevel3Id\}[\s\S]*?disabled=\{!draft\.categoryLevel2Id\}/);
});

test('product edit filters child selectors and clears descendants on parent changes', () => {
  assert.match(source, /const level2Children = selectedLevel1\?\.children \|\| \[\];/);
  assert.match(source, /const level3Children = selectedLevel2\?\.children \|\| \[\];/);
  assert.match(source, /categoryLevel1Id: event\.target\.value,\s*categoryLevel2Id: '',\s*categoryLevel3Id: '',/);
  assert.match(source, /categoryLevel2Id: event\.target\.value,\s*categoryLevel3Id: '',/);
});

test('inactive historical bindings remain visible with a warning', () => {
  assert.match(source, /activeCategoryOptions\(items: ProductCategoryNode\[], selected\?: ProductCategoryNode \| null\)/);
  assert.match(source, /item\.status === 'inactive' \? '（已停用）' : ''/);
  assert.match(source, /已停用：\{inactiveCategoryBindings\.map/);
});
