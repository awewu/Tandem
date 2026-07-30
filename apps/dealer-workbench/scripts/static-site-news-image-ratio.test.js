const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const consoleSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'app', 'comfort', '[[...section]]', 'BrandSiteConsoleShell.tsx'),
  'utf8'
);
const siteCss = fs.readFileSync(
  path.join(__dirname, '..', '..', 'everhot-cn', 'public', 'css', 'everhot.css'),
  'utf8'
);
const siteNewsJs = fs.readFileSync(
  path.join(__dirname, '..', '..', 'everhot-cn', 'public', 'js', 'site-news.js'),
  'utf8'
);
const siteNewsService = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'services', 'api', 'src', 'modules', 'brand-registry', 'site-news.service.ts'),
  'utf8'
);

test('site news card images use the 1280 by 600 ratio without cropping', () => {
  assert.match(consoleSource, /className="site-news-preview-img"\s+src=\{draftPreviewImage\}/);
  assert.match(consoleSource, /aspect-ratio: 1280 \/ 600;/);
  assert.match(consoleSource, /object-fit: contain;/);
  assert.doesNotMatch(consoleSource, /site-news-preview-img[\s\S]{0,160}center\/cover/);

  assert.match(siteCss, /\.news-img \{[^}]*aspect-ratio: 1280 \/ 600;/);
  assert.match(siteCss, /\.news-img img \{[^}]*object-fit: contain;/);
  assert.match(siteCss, /\.news-detail-cover \{[^}]*aspect-ratio: 1280 \/ 600;/);
  assert.match(siteCss, /\.news-detail-cover img \{[^}]*object-fit: contain;/);

  assert.match(siteNewsJs, /<div class="news-img"><img src="/);
  assert.match(siteNewsJs, /<div class="news-detail-cover"><img src="/);
  assert.doesNotMatch(siteNewsJs, /background-image:url/);
});

test('site news cover upload shows the current echoed image in the asset style', () => {
  assert.match(consoleSource, /const draftCoverImage = draft\.coverImageArtifactId/);
  assert.match(consoleSource, /className=\{`site-news-cover-preview/);
  assert.match(consoleSource, /hasDraftCoverImage \? <img src=\{draftCoverImage\}/);
  assert.match(consoleSource, /封面已就绪/);
  assert.match(consoleSource, /建议 1280 × 600px/);
  assert.match(consoleSource, /hasDraftCoverImage \? '替换' : '上传'/);
  assert.match(consoleSource, /删除封面/);
  assert.doesNotMatch(consoleSource, /<input className="input" type="file" accept="image\/png,image\/jpeg"/);
});

test('site news featured flag affects public ordering and is visible in console', () => {
  assert.match(consoleSource, /article\.isFeatured \? <span className="badge badge-info"/);
  assert.match(siteNewsService, /qb\.orderBy\('article\.isFeatured', 'DESC'\)/);
  assert.match(siteNewsService, /order: \{ isFeatured: 'DESC', sortOrder: 'ASC', publishedAt: 'DESC', createdAt: 'DESC' \}/);
  assert.match(siteNewsJs, /function sortNewsItems/);
  assert.match(siteNewsJs, /newsRank\(left\) - newsRank\(right\)/);
  assert.match(siteNewsJs, /grid\.innerHTML = sortNewsItems\(items\)\.slice/);
  assert.match(siteNewsJs, /news-featured-badge/);
  assert.match(siteNewsJs, /news-featured-inline/);
  assert.match(siteCss, /\.news-featured-badge/);
  assert.match(siteCss, /\.news-featured-inline/);
});
