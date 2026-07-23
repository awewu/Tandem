const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseEverhotList,
  parsePrice,
  parseRheemDetail,
  parseRheemListing,
  parseRuudPage,
} = require('./official-source-adapters');

test('parses Rheem listing records without unrelated item links', () => {
  const html = `<div class="l_proItmeBox"><div class="item"><a href="/product/9/91.html"><img src="/p.jpg"><div class="price">参考价 ￥698</div><div class="parameter">CSFL07.5-UA</div><div class="name">瑞美7.5L小厨宝</div></a></div><div class="item"><a href="/news/1.html"><div class="name">新闻</div></a></div></div>`;
  const products = parseRheemListing(html, 'https://rheem.com.cn/product/9.html', '9');
  assert.equal(products.length, 1);
  assert.equal(products[0].sourceId, '91');
  assert.equal(products[0].model, 'CSFL07.5-UA');
  assert.equal(products[0].price.min, 698);
});

test('preserves Ruud parameter-table conflicts as warnings', () => {
  const html = `<div class="productAll"><div class="productInfo"><div class="right"><h3>RUUD全变频空气源热泵中央空调</h3><p><span>超一级能效</span></p></div><img src="/unit.png"></div><div class="tables"><ul><li><span>名称</span><span>水控中心</span></li><li><span>型号</span><span>UCWA-IC</span></li></ul></div></div>`;
  const [product] = parseRuudPage(html, 'https://ruud.com.cn/product01/', 'product01');
  assert.equal(product.model, 'UCWA-IC');
  assert.equal(product.warnings.length, 1);
  assert.deepEqual(product.parameters['名称'], ['水控中心']);
});

test('does not keep image URLs from official product details', () => {
  const detail = parseRheemDetail(
    '<div class="shopShow"><img src="/official.jpg"><div class="fl"><div class="title">产品</div></div></div><div class="detail"><img src="https://vendor.example/qr.png"></div>',
    'https://rheem.com.cn/product/9/91.html'
  );
  assert.equal('imageUrls' in detail, false);
});

test('parses Everhot public API records and price ranges', () => {
  const products = parseEverhotList(
    { code: '0000', list: [{ id: 10008, name: '恒热大水量冷凝炉', model: 'L1GBQ-EBS', price: '13999-18999', img: '/p.png' }] },
    'https://everhot.com.cn/index/products'
  );
  assert.equal(products[0].sourceId, '10008');
  assert.deepEqual(products[0].price, { raw: '13999-18999', min: 13999, max: 18999, currency: 'CNY' });
  assert.deepEqual(parsePrice('暂无'), { raw: '暂无', min: null, max: null, currency: 'CNY' });
});
