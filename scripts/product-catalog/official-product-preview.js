#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  OFFICIAL_SOURCES,
  inferCategory,
  parseEverhotDetail,
  parseEverhotList,
  parseRheemDetail,
  parseRheemListing,
  parseRuudPage,
} = require('./official-source-adapters');

const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'evidence', 'provenance');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'official-product-preview.json');
const REPORT_OUTPUT = path.join(OUTPUT_DIR, 'official-product-preview.md');
const USER_AGENT = 'RhauttProductCatalogResearch/1.0 (+public official product data only)';
const REQUEST_DELAY_MS = Number(process.env.OFFICIAL_CRAWL_DELAY_MS || 250);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(url, options = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          accept: '*/*',
          'user-agent': USER_AGENT,
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });
      if (response.ok) return response;
      await response.arrayBuffer();
      if (attempt === 3 || (response.status !== 429 && response.status < 500)) {
        const error = new Error(`${response.status} ${response.statusText}`);
        error.retryable = false;
        throw error;
      }
    } catch (error) {
      if (attempt === 3 || error.name === 'AbortError' || error.retryable === false) throw error;
    } finally {
      clearTimeout(timeout);
      await sleep(REQUEST_DELAY_MS * attempt);
    }
  }
  throw new Error('request retries exhausted');
}

async function getText(url) {
  return (await request(url)).text();
}

async function postForm(url, values, headers = {}) {
  return request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(values),
  });
}

async function crawlRheem() {
  const listings = [
    { segment: '9', label: 'residential', url: `${OFFICIAL_SOURCES.Rheem}/product/9.html` },
    { segment: '10', label: 'commercial', url: `${OFFICIAL_SOURCES.Rheem}/product/10.html` },
  ];
  const discovered = [];
  for (const listing of listings) {
    const firstHtml = await getText(listing.url);
    discovered.push(...parseRheemListing(firstHtml, listing.url, listing.segment));
    for (let page = 2; page <= 50; page += 1) {
      const html = await (await postForm(listing.url, { page: String(page) })).text();
      const products = parseRheemListing(html, listing.url, listing.segment);
      if (!products.length) break;
      discovered.push(...products);
    }
  }

  const unique = [...new Map(discovered.map((product) => [product.sourceUrl, product])).values()];
  const products = [];
  for (const product of unique) {
    const detail = parseRheemDetail(await getText(product.sourceUrl), product.sourceUrl);
    products.push({
      ...product,
      name: detail.title || product.name,
      description: detail.description,
      price: detail.price.min === null ? product.price : detail.price,
      documents: detail.documents,
    });
  }
  return products;
}

async function crawlRuud() {
  const pages = [
    ['product01', '室外水机'],
    ['product02', '水控中心'],
    ['product03', '风盘室内机'],
    ['product04', '新风除湿一体机'],
    ['product05', '转轮新风机'],
  ];
  const products = [];
  for (const [pageKey, categoryLabel] of pages) {
    const sourceUrl = `${OFFICIAL_SOURCES.Ruud}/${pageKey}/`;
    const parsed = parseRuudPage(await getText(sourceUrl), sourceUrl, pageKey);
    products.push(...parsed.map((product) => ({ ...product, categoryLabel })));
  }
  return products;
}

async function crawlEverhot() {
  const listingUrl = `${OFFICIAL_SOURCES.Everhot}/index/products`;
  const endpoint = `${OFFICIAL_SOURCES.Everhot}/public/index/products/getList`;
  const response = await postForm(endpoint, {
    limit: '200',
    page: '1',
    type: '',
    series: '',
    scene: '',
    trait: '',
    text: '',
  }, { referer: listingUrl });
  const discovered = parseEverhotList(await response.json(), listingUrl);
  const products = [];
  for (const product of discovered) {
    const detail = parseEverhotDetail(await getText(product.sourceUrl), product.sourceUrl);
    products.push({
      ...product,
      name: detail.title || product.name,
      description: detail.description,
    });
  }
  return products;
}

function toPreviewRecord(brand, product, fetchedAt) {
  const fallbackCategory = brand === 'Rheem' ? product.raw.segment === '10' ? 'commercial-hvac' : 'residential-comfort' : 'comfort-hvac';
  const category = inferCategory(`${product.name} ${product.categoryLabel || ''}`, fallbackCategory);
  const brandCode = brand.toUpperCase();
  const fields = {
    name: product.name,
    officialModel: product.model,
    category,
    description: product.description,
    price: product.price?.min,
    parameters: Object.keys(product.parameters || {}).length ? product.parameters : null,
    sourceUrl: product.sourceUrl,
  };
  const present = Object.values(fields).filter((value) => value !== null && value !== undefined && value !== '').length;
  const completeness = Math.round((present / Object.keys(fields).length) * 100);
  return {
    tenantId: null,
    sku: `${brandCode}-CN-${String(product.sourceId).toUpperCase()}`,
    name: product.name,
    brand,
    category,
    spec: {
      officialModel: product.model || null,
      parameters: product.parameters || {},
      highlights: product.highlights || [],
      description: product.description || null,
    },
    positioning: {},
    assetRefs: [],
    productKey: `${brand.toLowerCase()}:cn:${product.sourceId}`,
    listPrice: product.price?.min || 0,
    costPrice: 0,
    currency: product.price?.currency || 'CNY',
    status: 'draft',
    meta: {
      previewOnly: true,
      officialPublicSource: true,
      sourceDomain: new URL(product.sourceUrl).hostname,
      sourceUrl: product.sourceUrl,
      listingUrl: product.listingUrl || null,
      fetchedAt,
      sourceId: product.sourceId,
      price: product.price || null,
      documents: product.documents || [],
      rawExtracted: product.raw || {},
      dataQualityWarnings: product.warnings || [],
      fieldCompleteness: { score: completeness, present, total: Object.keys(fields).length },
    },
  };
}

function summarize(records) {
  return Object.fromEntries(
    [...new Set(records.map((record) => record.brand))].map((brand) => {
      const selected = records.filter((record) => record.brand === brand);
      const average = selected.reduce((sum, record) => sum + record.meta.fieldCompleteness.score, 0) / selected.length;
      return [
        brand,
        {
          products: selected.length,
          averageCompleteness: Math.round(average || 0),
          missingModel: selected.filter((record) => !record.spec.officialModel).length,
          missingDescription: selected.filter((record) => !record.spec.description).length,
          missingPrice: selected.filter((record) => !record.listPrice).length,
          warnings: selected.reduce((sum, record) => sum + record.meta.dataQualityWarnings.length, 0),
        },
      ];
    })
  );
}

function renderReport(payload) {
  const lines = [
    '# 官网产品库 Dry-run 预览',
    '',
    `- 生成时间：${payload.metadata.fetchedAt}`,
    `- 执行模式：仅预览，不写数据库`,
    `- 数据范围：Rheem、Ruud、Everhot 官网公开产品页`,
    `- 产品记录：${payload.metadata.totalProducts} 条`,
    '',
    '| 品牌 | 记录数 | 平均完整率 | 缺型号 | 缺描述 | 缺公开价格 | 数据警告 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [brand, stats] of Object.entries(payload.summary)) {
    lines.push(`| ${brand} | ${stats.products} | ${stats.averageCompleteness}% | ${stats.missingModel} | ${stats.missingDescription} | ${stats.missingPrice} | ${stats.warnings} |`);
  }
  const categories = Object.entries(
    payload.products.reduce((result, product) => {
      result[product.category] = (result[product.category] || 0) + 1;
      return result;
    }, {})
  ).sort((left, right) => right[1] - left[1]);
  lines.push('', '## 分类分布', '');
  for (const [category, count] of categories) lines.push(`- ${category}: ${count}`);
  lines.push(
    '',
    '## 数据质量说明',
    '',
    '- 官网未公开的型号、价格或结构化参数保持为空，不推测、不补造。',
    '- Ruud 官网存在 1 处页面标题与隐藏参数表名称冲突，已保留原文并写入数据警告。',
    '- 图片不抓取、不记录 URL、不下载、不写入 DAM。',
    '',
    '## 导入闸口',
    '',
    '本产物不是导入批准。确认来源、型号、分类和数据警告后，才可开发并执行带鉴权的幂等导入器。',
    ''
  );
  return lines.join('\n');
}

async function main() {
  console.log('Official product crawl: preview-only; database writes are disabled.');
  const fetchedAt = new Date().toISOString();
  const crawlers = [
    ['Rheem', crawlRheem],
    ['Ruud', crawlRuud],
    ['Everhot', crawlEverhot],
  ];
  const records = [];
  const errors = [];
  for (const [brand, crawler] of crawlers) {
    try {
      const products = await crawler();
      records.push(...products.map((product) => toPreviewRecord(brand, product, fetchedAt)));
      console.log(`${brand}: ${products.length} records`);
    } catch (error) {
      errors.push({ brand, message: error.message });
      console.error(`${brand}: ${error.message}`);
    }
  }
  const payload = {
    metadata: {
      fetchedAt,
      mode: 'dry-run-preview',
      databaseWrites: false,
      officialPublicSourcesOnly: true,
      totalProducts: records.length,
      errors,
    },
    summary: summarize(records),
    products: records,
  };
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(REPORT_OUTPUT, renderReport(payload), 'utf8');
  console.log(`JSON: ${JSON_OUTPUT}`);
  console.log(`Report: ${REPORT_OUTPUT}`);
  if (errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { renderReport, summarize, toPreviewRecord };
