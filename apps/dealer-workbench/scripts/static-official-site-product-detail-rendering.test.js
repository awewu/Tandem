const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..', '..');
const sites = ['rheem-cn', 'ruud-cn'];

function readSite(site) {
  return {
    js: fs.readFileSync(path.join(root, 'apps', site, 'public', 'js', 'catalog.js'), 'utf8'),
    css: fs.readFileSync(path.join(root, 'apps', site, 'public', 'css', 'catalog.css'), 'utf8'),
    listHtml: fs.readFileSync(path.join(root, 'apps', site, 'public', 'products', 'index.html'), 'utf8'),
    detailHtml: fs.readFileSync(path.join(root, 'apps', site, 'public', 'products', 'detail', 'index.html'), 'utf8'),
  };
}

for (const site of sites) {
  test(`${site} product list links to official product detail page`, () => {
    const { js, listHtml, detailHtml } = readSite(site);

    assert.match(listHtml, /data-product-list/);
    assert.match(detailHtml, /data-product-detail/);
    assert.match(js, /href="\/products\/detail\/\?model='/);
    assert.match(js, /encodeURIComponent\(product\.slug\)/);
  });

  test(`${site} detail page requests brand product detail before shelf fallback`, () => {
    const { js } = readSite(site);
    const brandIndex = js.indexOf("'/api/v2/brand/' + SITE_CODE + '/products/' + encoded + '?locale=zh-CN'");
    const siteIndex = js.indexOf("'/api/v2/sites/' + SITE_CODE + '/products/' + encoded + '?locale=zh-CN'");

    assert.notEqual(brandIndex, -1);
    assert.notEqual(siteIndex, -1);
    assert.ok(brandIndex < siteIndex);
  });

  test(`${site} detail page renders database-backed official detail html with empty state`, () => {
    const { js } = readSite(site);

    assert.match(js, /function officialDetailHtml\(product\)/);
    assert.match(js, /product\.officialDetailHtml/);
    assert.match(js, /officialDetailSection\(product\)/);
    assert.match(js, /official-product-detail-section/);
    assert.match(js, /official-product-detail-body/);
    assert.match(js, /official-product-detail-empty/);
    assert.match(js, /\\u5b98\\u7f51\\u4ea7\\u54c1\\u8be6\\u60c5/);
  });

  test(`${site} official detail renderer constrains long images to 750px without horizontal overflow`, () => {
    const { js, css } = readSite(site);

    assert.match(js, /normalizeOfficialDetailHtml/);
    assert.match(js, /querySelectorAll\('script, style, iframe, object, embed, form, input, button'\)/);
    assert.match(js, /name\.indexOf\('on'\) === 0/);
    assert.match(js, /node\.removeAttribute\(attr\.name\)/);
    assert.match(js, /\^\(https\?:\\\/\\\/\|mailto:\|tel:\|\\\/\)/);
    assert.match(js, /node\.setAttribute\('src', imageUrl\(src\)\)/);
    assert.match(js, /\^\(https\?:\\\/\\\/\|\\\/api\\\/\|\\\/assets\\\/\|\\\/uploads\\\/\)/);
    assert.doesNotMatch(js, /blob:/);
    assert.match(css, /\.official-product-detail-container \{ width: min\(100%, 750px\); margin: 0 auto; \}/);
    assert.match(css, /\.official-product-detail-body img \{ display: block; width: 100%; max-width: 750px; height: auto; margin: 0 auto 16px; \}/);
    assert.match(css, /overflow-wrap: anywhere;/);
    assert.match(css, /overflow-x: auto;/);
  });
}
