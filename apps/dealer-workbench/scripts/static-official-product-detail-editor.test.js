const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'products', 'page.tsx');
const apiPath = path.join(__dirname, '..', 'src', 'lib', 'api.ts');
const source = fs.readFileSync(pagePath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');

test('product create and edit expose official site detail rich text editor', () => {
  assert.match(source, /function OfficialProductDetailEditor/);
  assert.match(source, /官网产品详情/);
  assert.match(source, /建议上传宽度 750px 的详情图片，高度不限/);
  assert.match(source, /contentEditable=\{!disabled\}/);
  assert.match(source, /official-product-detail-editor-body/);
});

test('official product detail editor supports basic rich text controls and image upload', () => {
  assert.match(source, /run\('formatBlock', 'h2'\)/);
  assert.match(source, /run\('bold'\)/);
  assert.match(source, /run\('italic'\)/);
  assert.match(source, /run\('insertUnorderedList'\)/);
  assert.match(source, /run\('insertOrderedList'\)/);
  assert.match(source, /function addTable\(\)/);
  assert.match(source, /fileArtifacts\.uploadBase64\(\{/);
  assert.match(source, /entityType: 'product-official-detail-image'/);
  assert.match(source, /accept="image\/png,image\/jpeg,image\/webp,\.png,\.jpg,\.jpeg,\.webp"/);
  assert.match(source, /multiple/);
  assert.match(source, /Array\.from\(files \|\| \[\]\)/);
  assert.match(source, /insertHtml\(`<img src="\$\{escapeProductDetailHtml\(url\)\}"/);
});

test('official detail html is saved and read through product content APIs', () => {
  assert.match(api, /listContent: \(id: string/);
  assert.match(api, /upsertContent: \(id: string/);
  assert.match(source, /products\.listContent\(product\.id/);
  assert.match(source, /products\.upsertContent\(productId/);
  assert.match(source, /officialDetailHtml: html/);
  assert.match(source, /const PRODUCT_DETAIL_LOCALE = 'zh-CN'/);
  assert.match(source, /officialDetailFromContent\(contentData\)/);
  assert.match(source, /setDraft\(\(current\) => \(\{ \.\.\.current, officialDetailHtml \}\)\)/);
  assert.match(source, /\^\(https\?:\\\/\\\/\|\\\/api\\\/\|\\\/assets\\\/\|\\\/uploads\\\/\)/);
  assert.doesNotMatch(source, /output\.setAttribute\('src', src\);[\s\S]{0,80}data:/);
  assert.doesNotMatch(source, /output\.setAttribute\('src', src\);[\s\S]{0,80}blob:/);
});

test('empty official detail does not block product base save and existing detail can be cleared', () => {
  assert.match(source, /const existingOfficialDetailHtml = officialDetailFromContent\(contentData\);/);
  assert.match(source, /if \(text\(draft\.officialDetailHtml\) \|\| existingOfficialDetailHtml\) \{/);
  assert.match(source, /saveOfficialProductDetailContent\(product\.id, tenantIdForProduct\(product\), draft\.officialDetailHtml\)/);
  assert.match(source, /官网产品详情加载失败；基础信息仍可编辑保存/);
});

test('official detail images are constrained to 750px in the editor preview', () => {
  assert.match(source, /\.official-product-detail-editor-body :global\(img\)/);
  assert.match(source, /width: 100%;/);
  assert.match(source, /max-width: 750px;/);
  assert.match(source, /height: auto;/);
  assert.match(source, /margin: 12px auto;/);
});
