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

test('brand site console requests product catalog rows with normalized brand and brand tenant', () => {
  assert.match(adapter, /const query = buildBrandProductListQuery\(brandCode, options\);/);
  assert.match(adapter, /const query: Record<string, string> = \{\s*brand: brandCode,\s*page: String\(page\),\s*pageSize: String\(pageSize\),/s);
  assert.match(adapter, /const tenantId = BRAND_PRODUCT_TENANTS\[brandCode\] \|\| '';/);
  assert.match(adapter, /if \(categoryLevel1Id\) query\.categoryLevel1Id = categoryLevel1Id;/);
  assert.match(adapter, /if \(categoryLevel2Id\) query\.categoryLevel2Id = categoryLevel2Id;/);
  assert.match(adapter, /if \(categoryLevel3Id\) query\.categoryLevel3Id = categoryLevel3Id;/);
  assert.match(adapter, /const productResult = await products\.list\(query\);/);
  assert.match(adapter, /\.filter\(\(item\) => normalizeBrandCode\(String\(\(item as any\)\.brand \|\| ''\)\) === brandCode\)/);
});

test('brand site console displays bound category paths and filters by category options', () => {
  assert.match(adapter, /categoryPath: string;/);
  assert.match(adapter, /const categoryPath = text\(product\.categoryPath\) \|\| text\(brandMeta\.categoryPath\);/);
  assert.match(shell, /if \(categoryPath\) return productCategoryPathLabel\(categoryPath\);/);
  assert.match(shell, /brandProductCategories\.list\(\{ brandCode: normalizedBrandCode \}\)/);
  assert.match(shell, /CategoryMultiSelect/);
  assert.match(shell, /productMatchesCategoryFilters/);
  assert.match(shell, /function productCategoryPathFilterOptions\(products: BrandProductRow\[\]\)/);
  assert.match(shell, /const path = String\(product\.categoryPath \|\| ''\)\.trim\(\);/);
  assert.match(shell, /function productDisplayCategoryPath\(product: BrandProductRow\) \{\s*const path = String\(product\.categoryPath \|\| ''\)\.trim\(\);/);
  assert.match(shell, /product\.category \? productCategoryLabel\(product\.category\) : '-'/);
  assert.doesNotMatch(shell, /product\.categoryPath \|\| product\.materialCategory \|\| product\.websiteMenuCategory \|\| product\.category/);
  assert.match(shell, /value\.startsWith\('path:'\)/);
  assert.match(shell, /CATEGORY_FILTER_LOAD_PAGE_SIZE/);
  assert.match(shell, /categoryFilter\.length > 0/);
  assert.match(shell, /product\.categoryLevel1Id === categoryId/);
  assert.match(shell, /product\.categoryLevel2Id === categoryId/);
  assert.match(shell, /product\.categoryLevel3Id === categoryId/);
  assert.match(shell, /candidate === key \|\| candidate\.startsWith\(`\$\{key\}\/`\)/);
  assert.doesNotMatch(shell, /key\.endsWith\(`\/\$\{candidate\}`\)/);
  assert.doesNotMatch(shell, /label\.endsWith\(` \/ \$\{candidate\}`\)/);
  assert.match(shell, /footerTotalProducts = categoryFilter\.length \? visibleProducts\.length : totalProducts/);
});

test('brand site console exposes stable product status filter options', () => {
  assert.match(shell, /const PRODUCT_STATUS_FILTER_OPTIONS = \['active', 'inactive', 'draft', 'archived'\];/);
  assert.match(shell, /function productStatusFilterOptions\(facets: Array<\{ value: string; count: number \}> = \[\]\)/);
  assert.match(shell, /const statusOptions = useMemo\(\(\) => productStatusFilterOptions\(data\?\.facets\.statuses\), \[data\?\.facets\.statuses\]\);/);
  assert.match(shell, /value=\{statusFilter\}/);
  assert.match(shell, /setStatusFilter\(event\.target\.value\);/);
  assert.match(shell, /status: statusFilter,/);
});

test('brand console logo remains stable when product filters reload table rows', () => {
  assert.match(adapter, /logoArtifactId\?: string \| null;/);
  assert.match(shell, /logoArtifactId\?: string \| null;/);
  assert.match(shell, /loadBrandSiteLogo\(site\.id, controller\.signal\)/);
  assert.match(shell, /brandSites\.logo\(siteId, \{ signal \}\)/);
  assert.match(shell, /fallbackBrandLogoSrc\(site\.code\)/);
  assert.match(shell, /\/images\/brand\/everhot-logo\.png/);
  assert.match(shell, /currentBrandLogoSrc/);
  assert.doesNotMatch(shell, /developmentUrl \|\| 'http:\/\/localhost:5011\/'/);
  assert.doesNotMatch(shell, /event\.currentTarget\.style\.display = 'none'/);
});

test('website shelf publish recreates stale product assignments before publishing', () => {
  assert.match(shell, /function shelfAssignmentMatchesProduct\(assignment: WebsiteShelfAssignment \| undefined, row: BrandProductRow\)/);
  assert.match(shell, /assignment\.productId === row\.id/);
  assert.match(shell, /assignment\.productTenantId === rowTenantId\(row\)/);
  assert.match(shell, /if \(existing && !existing\.deletedAt && !shelfAssignmentMatchesProduct\(existing, row\)\) \{\s*await siteProductAssignments\.archive\(siteCode, existing\.id\);/s);
  assert.match(shell, /let assignmentId = shelfAssignmentMatchesProduct\(existing, row\) \? existing\?\.id \|\| '' : '';/);
});

test('Everhot and Rheem brand console coverage is present in adapter tests', () => {
  const testPath = path.join(__dirname, '..', 'src', 'lib', 'brand-product-adapter.nodetest.ts');
  const source = fs.readFileSync(testPath, 'utf8');
  assert.match(source, /Everhot brand site console lists only Everhot product catalog records/);
  assert.match(source, /Rheem brand site console does not require selecting a brand and excludes other brands/);
  assert.match(source, /queries\[0\]\?\.brand, 'everhot'/);
  assert.match(source, /queries\[0\]\?\.brand, 'rheem'/);
});

test('website shelf state stays separate from product master data in the concrete brand page', () => {
  assert.match(shell, /loadBrandProductConsoleData\(normalizedBrandCode, query\)/);
  assert.match(shell, /siteProductAssignments\.list\(nextData\.site\.code \|\| normalizedBrandCode/);
  assert.match(shell, /assignmentByProductId\.get\(product\.id\)/);
  assert.match(shell, /shelfAssignment=\{assignmentByProductId\.get\(product\.id\)\}/);
});

test('brand console disables the legacy shelf page and handles website shelf actions inline', () => {
  assert.doesNotMatch(shell, /href=\{`\/comfort\/sites\/\$\{site\.code\}\/library`\}/);
  assert.match(shell, /publishWebsiteShelf/);
  assert.match(shell, /hideWebsiteShelf/);
});

test('empty product state points operators back to the product catalog', () => {
  assert.match(adapter, /kind: 'no-products'/);
  assert.match(adapter, /title: '该品牌还没有产品目录记录'/);
  assert.match(adapter, /actionHref: '\/products\?module=catalog'/);
});
