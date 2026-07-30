const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'src', 'components', 'WorkbenchCore.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'app', 'globals.css'), 'utf8');
const products = fs.readFileSync(path.join(root, 'src', 'app', 'products', 'page.tsx'), 'utf8');
const brandConsole = fs.readFileSync(path.join(root, 'src', 'app', 'comfort', '[[...section]]', 'BrandSiteConsoleShell.tsx'), 'utf8');

test('workbench pagination footer renders compact total, page-size, page numbers and jump controls', () => {
  assert.match(core, /className="workbench-pagination-footer__meta"/);
  assert.match(core, /className="input workbench-pagination-footer__page-size"/);
  assert.match(core, /\{option\}条\/页/);
  assert.match(core, /className=\{`btn btn-sm workbench-pagination-footer__page/);
  assert.match(core, /className="btn btn-outline btn-sm icon-only workbench-pagination-footer__nav"/);
  assert.match(core, /前往/);
  assert.match(core, /页\s*<\/label>/);
  assert.doesNotMatch(core, />上一页<\/button>/);
  assert.doesNotMatch(core, />下一页/);
});

test('pagination footer style follows the compact bottom-right control strip', () => {
  assert.match(css, /\.workbench-pagination-footer \{\s*display:flex;\s*align-items:center;\s*justify-content:flex-end;/);
  assert.match(css, /\.workbench-pagination-footer__actions \{\s*display:flex;[\s\S]*?flex-wrap:nowrap;/);
  assert.match(css, /\.workbench-pagination-footer__page,[\s\S]*?min-width:30px;[\s\S]*?border-radius:4px;/);
  assert.match(css, /\.workbench-pagination-footer__page-size \{\s*width:100px;/);
});

test('product and brand lists use footer page-size controls instead of toolbar page-size selects', () => {
  assert.match(products, /pageSizeOptions=\{PRODUCT_PAGE_SIZE_OPTIONS\}/);
  assert.match(products, /onPageSizeChange=\{setPageSize\}/);
  assert.match(products, /const \[catalogPage, setCatalogPage\] = useState\(1\)/);
  assert.match(products, /visibleCatalogProducts\.slice\(start, start \+ pageSize\)/);

  assert.equal((brandConsole.match(/pageSizeOptions=\{PRODUCT_PAGE_SIZE_OPTIONS\}/g) || []).length, 2);
  assert.equal((brandConsole.match(/className="input brand-product-page-size"/g) || []).length, 0);
});
