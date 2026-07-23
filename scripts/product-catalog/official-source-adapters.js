const { JSDOM } = require('jsdom');

const OFFICIAL_SOURCES = Object.freeze({
  Rheem: 'https://rheem.com.cn',
  Ruud: 'https://ruud.com.cn',
  Everhot: 'https://everhot.com.cn',
});

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(element) {
  return cleanText(element?.textContent);
}

function absoluteUrl(value, baseUrl) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function sameHostUrl(value, sourceUrl) {
  const resolved = absoluteUrl(value, sourceUrl);
  if (!resolved) return null;
  return new URL(resolved).hostname === new URL(sourceUrl).hostname ? resolved : null;
}

function parsePrice(value) {
  const raw = cleanText(value).replace(/[,，]/g, '');
  const amounts = [...raw.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  if (!amounts.length) return { raw: raw || null, min: null, max: null, currency: 'CNY' };
  return {
    raw,
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    currency: 'CNY',
  };
}

function inferCategory(name, fallback) {
  const value = cleanText(name);
  const categories = [
    [/净水|过滤|饮水/, 'water-treatment'],
    [/壁挂炉|采暖炉|冷凝炉|两用炉/, 'heating-boiler'],
    [/热泵|空气能/, 'heat-pump'],
    [/热水器|小厨宝|热水机组/, 'water-heating'],
    [/水控/, 'hydronic-control'],
    [/风盘/, 'fan-coil'],
    [/新风|除湿/, 'ventilation-dehumidification'],
  ];
  return categories.find(([pattern]) => pattern.test(value))?.[1] || fallback;
}

function documentFrom(html, url) {
  return new JSDOM(html, { url }).window.document;
}

function parseRheemListing(html, listingUrl, segment) {
  const document = documentFrom(html, listingUrl);
  const products = [];
  for (const item of document.querySelectorAll('.l_proItmeBox .item, body > .item, .item')) {
    const anchor = item.querySelector('a[href]');
    const sourceUrl = absoluteUrl(anchor?.getAttribute('href'), listingUrl);
    if (!sourceUrl || !new RegExp(`/product/${segment}/\\d+\\.html$`).test(new URL(sourceUrl).pathname)) {
      continue;
    }
    const sourceId = new URL(sourceUrl).pathname.match(/\/(\d+)\.html$/)?.[1];
    const name = textOf(item.querySelector('.name'));
    if (!sourceId || !name) continue;
    products.push({
      sourceId,
      sourceUrl,
      listingUrl,
      name,
      model: textOf(item.querySelector('.parameter')) || null,
      price: parsePrice(textOf(item.querySelector('.price'))),
      imageUrls: [sameHostUrl(item.querySelector('img')?.getAttribute('src'), listingUrl)].filter(Boolean),
      raw: { segment },
    });
  }
  return [...new Map(products.map((product) => [product.sourceUrl, product])).values()];
}

function parseRheemDetail(html, sourceUrl) {
  const document = documentFrom(html, sourceUrl);
  const title = textOf(document.querySelector('.shopShow .fl .title'));
  const description = cleanText(document.querySelector('.shopShow .fl .text pre')?.textContent);
  const price = parsePrice(textOf(document.querySelector('.shopShow .fl .price')));
  const imageUrls = [...document.querySelectorAll('.shopShow img, .detail img')]
    .map((image) => sameHostUrl(image.getAttribute('src'), sourceUrl))
    .filter(Boolean);
  const documents = [...document.querySelectorAll('.detailList2 .list > div')]
    .map((item) => ({
      name: textOf(item.querySelector('span')),
      url: absoluteUrl(item.querySelector('a[href]')?.getAttribute('href'), sourceUrl),
    }))
    .filter((item) => item.name || item.url);
  return {
    title: title || null,
    description: description || null,
    price,
    imageUrls: [...new Set(imageUrls)],
    documents,
  };
}

function parseRuudPage(html, sourceUrl, pageKey) {
  const document = documentFrom(html, sourceUrl);
  const root = document.querySelector('.productAll');
  const name = textOf(root?.querySelector('.productInfo .right h3'));
  if (!name) return [];

  const highlights = [...root.querySelectorAll('.productInfo .right p span')]
    .map(textOf)
    .filter(Boolean);
  const imageUrls = [...root.querySelectorAll('.productInfo img, .content > p img')]
    .map((image) => sameHostUrl(image.getAttribute('src'), sourceUrl))
    .filter(Boolean);
  const parameters = {};
  for (const row of root.querySelectorAll('.tables li')) {
    const cells = [...row.querySelectorAll('span')].map(textOf).filter(Boolean);
    if (!cells.length) continue;
    const key = cells[0];
    const values = cells.slice(1).filter((value) => value !== key);
    if (key && values.length) parameters[key] = [...new Set(values)];
  }

  const tableName = parameters['名称']?.[0] || null;
  const warnings = [];
  if (tableName && !name.includes(tableName) && !tableName.includes(name)) {
    warnings.push(`页面名称“${name}”与隐藏参数表名称“${tableName}”不一致`);
  }
  return [
    {
      sourceId: pageKey,
      sourceUrl,
      name,
      model: parameters['型号']?.join(' / ') || null,
      description: highlights.join('；') || null,
      highlights,
      imageUrls: [...new Set(imageUrls)],
      parameters,
      warnings,
      raw: { pageKey, tableName },
    },
  ];
}

function parseEverhotList(payload, listingUrl) {
  if (!payload || payload.code !== '0000' || !Array.isArray(payload.list)) {
    throw new Error('Everhot public product API returned an unexpected payload');
  }
  return payload.list.map((item) => ({
    sourceId: String(item.id),
    sourceUrl: `${OFFICIAL_SOURCES.Everhot}/index/productdetail?id=${encodeURIComponent(item.id)}`,
    listingUrl,
    name: cleanText(item.name),
    model: cleanText(item.model) || null,
    price: parsePrice(item.price),
    imageUrls: [sameHostUrl(item.img, listingUrl)].filter(Boolean),
    raw: item,
  }));
}

function parseEverhotDetail(html, sourceUrl) {
  const document = documentFrom(html, sourceUrl);
  const root = document.querySelector('.l_proDetail, .productDetail, main') || document.body;
  const title = textOf(root.querySelector('.title, h1, h2'));
  const description = cleanText(
    root.querySelector('.text pre, .text, .product_text, .detailText')?.textContent
  );
  const imageUrls = [...root.querySelectorAll('img')]
    .map((image) => sameHostUrl(image.getAttribute('src'), sourceUrl))
    .filter(Boolean);
  return {
    title: title || null,
    description: description || null,
    imageUrls: [...new Set(imageUrls)],
  };
}

module.exports = {
  OFFICIAL_SOURCES,
  absoluteUrl,
  cleanText,
  inferCategory,
  parseEverhotDetail,
  parseEverhotList,
  parsePrice,
  parseRheemDetail,
  parseRheemListing,
  parseRuudPage,
};
