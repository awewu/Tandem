const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const appRoot = path.join(root, 'src', 'app');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

function exists(...segments) {
  return fs.existsSync(path.join(root, ...segments));
}

const navigation = read('src', 'lib', 'workbench-navigation.ts');
const dealerNav = read('src', 'components', 'DealerNav.tsx');
const dealerTopBar = read('src', 'components', 'DealerTopBar.tsx');
const layout = read('src', 'app', 'layout.tsx');
const home = read('src', 'app', 'page.tsx');
const globals = read('src', 'app', 'globals.css');
const workbenchCore = read('src', 'components', 'WorkbenchCore.tsx');
const brand = read('src', 'app', 'brand', 'page.tsx');
const growth = read('src', 'app', 'growth', '[[...section]]', 'page.tsx');
const products = read('src', 'app', 'products', 'page.tsx');
const accounts = read('src', 'app', 'accounts', 'page.tsx');
const comfortRouter = read('src', 'app', 'comfort', '[[...section]]', 'page.tsx');
const brandSites = read('src', 'app', 'comfort', '[[...section]]', 'BrandSitesManager.tsx');
const brandConsole = read('src', 'app', 'comfort', '[[...section]]', 'BrandSiteConsoleShell.tsx');

const visibleEntrySources = [
  ['workbench-navigation.ts', navigation],
  ['DealerNav.tsx', dealerNav],
  ['DealerTopBar.tsx', dealerTopBar],
  ['app/page.tsx', home],
];

const obsoleteModules = [
  ['CRM customers', 'crm', /href:\s*['"]\/crm(?:['"/?]|$)|href=["']\/crm(?:["'/?]|$)|\/crm\b/],
  ['projects', 'projects', /href:\s*['"]\/projects(?:['"/?]|$)|href=["']\/projects(?:["'/?]|$)|\/projects\b/],
  ['design', 'design', /href:\s*['"]\/design(?:['"/?]|$)|href=["']\/design(?:["'/?]|$)|\/design\b/],
  ['BIM', 'bim', /href:\s*['"]\/bim(?:['"/?]|$)|href=["']\/bim(?:["'/?]|$)|\/bim\b/i],
  ['finance', 'finance', /href:\s*['"]\/finance(?:['"/?]|$)|href=["']\/finance(?:["'/?]|$)|\/finance\b/],
  ['team', 'team', /href:\s*['"]\/team(?:['"/?]|$)|href=["']\/team(?:["'/?]|$)|\/team\b/],
  ['aftersales', 'aftersales', /href:\s*['"]\/aftersales(?:['"/?]|$)|href=["']\/aftersales(?:["'/?]|$)|\/aftersales\b/],
  ['Hub', 'hub', /href:\s*['"]\/hub(?:['"/?]|$)|href=["']\/hub(?:["'/?]|$)|\/hub\b|\/hub-console\b/],
];

test('retained marketing-console routes still have route code', () => {
  assert.ok(exists('src', 'app', 'page.tsx'), 'login/entry route is present');
  assert.ok(exists('src', 'app', 'brand', 'page.tsx'), '/brand route is present');
  assert.ok(exists('src', 'app', 'comfort', '[[...section]]', 'page.tsx'), '/comfort/sites and /comfort/sites/[code] route is present');
  assert.ok(exists('src', 'app', 'growth', '[[...section]]', 'page.tsx'), '/growth route is present');
  assert.ok(exists('src', 'app', 'products', 'page.tsx'), '/products route is present');
  assert.ok(exists('src', 'app', 'accounts', 'page.tsx'), '/accounts route is present');

  assert.match(comfortRouter, /return <BrandSitesManager brandCode="all" \/>;/);
  assert.match(comfortRouter, /return <BrandSiteConsoleShell brandCode=\{brandCode\} \/>;/);
  assert.doesNotMatch(comfortRouter, /SiteProductShelfManager/);
});

test('marketing navigation exposes only retained marketing modules', () => {
  for (const [href, key] of [
    ['/comfort/sites', 'brand-sites'],
    ['/growth', 'growth'],
    ['/products', 'product'],
    ['/accounts', 'accounts'],
  ]) {
    assert.match(navigation, new RegExp(`key:\\s*'${key}'`));
    assert.match(navigation, new RegExp(`href:\\s*'${href.replace('/', '\\/')}'`));
  }

  assert.match(navigation, /href:\s*'\/brand'/);
  assert.match(dealerNav, /WORKBENCH_NAV\.map/);
  assert.match(dealerNav, /className="mobile-nav"/);
  assert.match(dealerNav, /gridTemplateColumns: `repeat\(\$\{WORKBENCH_NAV\.length\}/);
});

test('top bar renders first-level and second-level titles instead of a detail breadcrumb', () => {
  assert.match(layout, /import DealerTopBar from '..\/components\/DealerTopBar';/);
  assert.match(layout, /<DealerTopBar \/>/);
  assert.doesNotMatch(layout, /TopBar.*@rhautt\/ui|<TopBar \/>/);
  assert.match(dealerTopBar, /const activeItem = navItemForPath\(path\);/);
  assert.match(dealerTopBar, /primaryTitle\(activeItem\.key, activeItem\.label\)/);
  assert.match(dealerTopBar, /if \(key === 'growth'\) return '市场营销';/);
  assert.match(dealerTopBar, /const childLabel = selectedChildLabel\(path, search, brandSiteLabels\);/);
  assert.match(dealerTopBar, /brandSites\.list\(\)/);
  assert.match(dealerTopBar, /brandSiteLabels\[code\]/);
  assert.match(dealerTopBar, /<h1>\{title\}<\/h1>/);
  assert.match(dealerTopBar, /<p>\{childLabel\}<\/p>/);
  assert.doesNotMatch(dealerTopBar, /Breadcrumb|detail|Details|详情/);
});

test('obsolete modules are not routable app directories or visible nav/home/mobile entries', () => {
  for (const [label, directoryName, hrefPattern] of obsoleteModules) {
    assert.equal(fs.existsSync(path.join(appRoot, directoryName)), false, `${label} app route directory should be absent`);
    for (const [sourceName, source] of visibleEntrySources) {
      assert.doesNotMatch(source, hrefPattern, `${label} should not be linked from ${sourceName}`);
    }
  }
});

test('Rheem Red and marketing-console primitives remain the UI baseline', () => {
  assert.match(globals, /--brand-500:\s*#E4002B;/);
  assert.match(globals, /--brand:\s*var\(--brand-500\);/);
  assert.match(globals, /rgba\(228,0,43,0\.16\)/);
  assert.match(workbenchCore, /StatusPill/);
  assert.match(workbenchCore, /WorkbenchTableState/);
  assert.match(workbenchCore, /from 'lucide-react'/);
  assert.match(growth, /var\(--brand\)/);
  assert.doesNotMatch(`${navigation}\n${dealerNav}\n${dealerTopBar}`, /Dealer Hub|\/hub-console/);
});

test('product catalog behavior remains represented in the retained product page', () => {
  assert.match(products, /type ProductModule = 'catalog' \| 'materials' \| 'base' \| 'categories';/);
  assert.match(products, /const \{ data: brandSiteData \} = useSWR\('\/api\/v2\/brand-sites'/);
  assert.match(products, /products\.list\(query\)/);
  assert.match(products, /const basePayload = createProductPayload\(createDraft, createCategoryTree\);/);
  assert.match(products, /saveOfficialProductDetailContent\(createdId/);
  assert.match(products, /products\.create\(payload\)/);
  assert.match(products, /products\.update\(product\.id, productUpdatePayload\(product, draft\)\)/);
  assert.match(products, /products\.archive\(product\.id/);
  assert.match(products, /setModule\('catalog'\)/);
  assert.match(products, /setModule\('materials'\)/);
  assert.match(products, /setModule\('base'\)/);
  assert.match(products, /WorkbenchFilterToolbar/);
  assert.match(products, /WorkbenchTableShell/);
  assert.match(products, /WorkbenchTableState/);
});

test('archived brand site delete is wired end-to-end without shelf-table manual deletes', () => {
  const brandSiteService = fs.readFileSync(
    path.join(root, '..', '..', 'services', 'api', 'src', 'modules', 'brand-registry', 'brand-site.service.ts'),
    'utf8'
  );

  assert.match(brandSites, /function deleteArchivedSite\(site: BrandSite\)/);
  assert.match(brandSites, /setDeleteTarget\(site\)/);
  assert.match(brandSites, /async function confirmDeleteArchivedSite\(site: BrandSite\)/);
  assert.match(brandSites, /onClick=\{\(\) => deleteArchivedSite\(site\)\}/);
  assert.match(brandSites, /title="删除"/);
  assert.match(brandSites, /<Trash2 size=\{15\} \/>/);

  assert.match(brandSiteService, /if \(row\.deletedAt\) \{/);
  assert.match(brandSiteService, /repo\.delete\(\{ id, tenantId: user\.tenantId \}/);
  assert.match(brandSiteService, /brand-site\.delete/);
  assert.doesNotMatch(brandSiteService, /SiteProductAssignmentEntity\)\.delete/);
});

test('account permission behavior remains marketing-console scoped', () => {
  assert.match(accounts, /adminUsers\.list\(q\)/);
  assert.match(accounts, /adminUsers\.update\(u\.id, patch\)/);
  assert.match(accounts, /adminUsers\.create\(/);
  assert.match(accounts, /adminUsers\.resetPassword\(user\.id, pwd\)/);
  assert.match(accounts, /BRAND_ADMINS/);
  assert.match(accounts, /dealer_admin/);
  assert.match(accounts, /href="\/comfort\/sites"/);
  assert.doesNotMatch(accounts, /href="\/hub"|\/team\b/);
});

test('retained brand website and growth features keep stateful controls', () => {
  assert.match(brandSites, /brandSites\.list\(\{ includeDeleted: true \}\)/);
  assert.match(brandSites, /brandSites\.create\(payload\)/);
  assert.match(brandSites, /brandSites\.update\(site\.id, patch\)/);
  assert.match(brandSites, /brandSites\.uploadLogo\(saved\.id/);
  assert.match(brandConsole, /publishBrandSite/);
  assert.match(brandConsole, /uploadBrandProductMainImage/);
  assert.match(brandConsole, /uploadBrandProductDetailImage/);
  assert.match(brandConsole, /WorkbenchPaginationFooter/);
  assert.match(brandConsole, /siteProductAssignments\.list/);
  assert.match(brandConsole, /siteProductAssignments\.create/);
  assert.match(brandConsole, /siteProductAssignments\.publish/);
  assert.match(brandConsole, /siteProductAssignments\.hide/);
  assert.match(growth, /type GrowthSection = 'geo' \| 'copywriter' \| 'sentiment' \| 'automation' \| 'materials';/);
});

test('normal desktop workbench tables avoid visible horizontal scrollbars in touched shells', () => {
  assert.match(globals, /\.workbench-table-shell \{\s*width:100%;\s*max-width:100%;\s*overflow-x:auto;\s*overflow-y:hidden;/);
  assert.match(globals, /\.table th,\s*\.table td \{\s*overflow-wrap:anywhere;/);
  assert.match(products, /<WorkbenchTableShell>/);
  assert.match(accounts, /<WorkbenchTableShell>/);
  assert.match(brandConsole, /\.brand-product-panel \{[\s\S]*?overflow: hidden;/);
  assert.match(brandConsole, /\.brand-product-panel \.workbench-table-shell \{/);
});
