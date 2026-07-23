(function () {
  'use strict';

  var SITE_CODE = 'ruud';
  var API_BASE = window.RUUD_API_BASE || '';
  var LIST_URLS = [
    '/api/v2/sites/' + SITE_CODE + '/products?locale=zh-CN',
    '/api/v2/brand/' + SITE_CODE + '/products?locale=zh-CN',
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fetchJson(path) {
    return fetch(API_BASE + path, { cache: 'no-store', headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
  }

  function fetchFirst(paths, valid, index) {
    return fetchJson(paths[index || 0]).then(function (json) {
      if (!valid(json)) throw new Error('Invalid product response');
      return json;
    }).catch(function (error) {
      var next = (index || 0) + 1;
      if (next >= paths.length) throw error;
      return fetchFirst(paths, valid, next);
    });
  }

  function itemFrom(json) {
    return json && json.data ? json.data : null;
  }

  function normalize(product) {
    var copy = Object.assign({}, product);
    copy.slug = String(product.slug || product.sku || '');
    copy.tagline = product.summary || product.tagline || '';
    copy.image = product.image || (product.mainImage && product.mainImage.url) || '';
    return copy;
  }

  function imageUrl(path) {
    if (!path || /^(?:https?:|data:)/.test(path)) return path;
    return API_BASE + path;
  }

  function card(product) {
    var image = imageUrl(product.image);
    return '<article class="product-card">'
      + (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">' : '<div class="product-placeholder">Ruud</div>')
      + '<div class="product-card-body"><span>' + escapeHtml(product.series || product.category || '') + '</span>'
      + '<h2>' + escapeHtml(product.name) + '</h2><p>' + escapeHtml(product.tagline) + '</p>'
      + '<a class="btn btn-brand" href="/products/detail/?model=' + encodeURIComponent(product.slug) + '">查看详情</a></div></article>';
  }

  function renderList() {
    var host = document.querySelector('[data-product-list]');
    if (!host) return;
    fetchFirst(LIST_URLS, function (json) {
      return !!(json && json.data && Array.isArray(json.data.items));
    }).then(function (json) {
      var items = itemFrom(json);
      items = items && Array.isArray(items.items) ? items.items.map(normalize) : null;
      if (!items) throw new Error('Invalid product response');
      host.innerHTML = items.length ? items.map(card).join('') : '<p class="product-state">当前暂无已发布产品。</p>';
    }).catch(function () {
      host.innerHTML = '<p class="product-state">产品目录暂时不可用，请稍后刷新。</p>';
    });
  }

  function renderDetail() {
    var host = document.querySelector('[data-product-detail]');
    if (!host) return;
    var slug = new URLSearchParams(location.search).get('model');
    if (!slug) {
      host.innerHTML = '<p class="product-state">未指定产品。</p>';
      return;
    }
    var encoded = encodeURIComponent(slug);
    fetchFirst([
      '/api/v2/sites/' + SITE_CODE + '/products/' + encoded + '?locale=zh-CN',
      '/api/v2/brand/' + SITE_CODE + '/products/' + encoded + '?locale=zh-CN',
    ], function (json) {
      return !!(json && json.data && typeof json.data === 'object');
    }).then(function (json) {
      var raw = itemFrom(json);
      if (!raw) throw new Error('Product not found');
      var product = normalize(raw);
      var image = imageUrl(product.image);
      document.title = product.name + ' | Ruud 中国';
      host.innerHTML = '<div class="product-detail-media">'
        + (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '">' : '<div class="product-placeholder">Ruud</div>')
        + '</div><div class="product-detail-copy"><span>' + escapeHtml(product.series || product.category || '') + '</span>'
        + '<h1>' + escapeHtml(product.name) + '</h1><p>' + escapeHtml(product.tagline) + '</p>'
        + '<dl><dt>型号</dt><dd>' + escapeHtml(product.model || product.sku || '') + '</dd></dl>'
        + '<a class="btn btn-brand" href="/products/">返回产品中心</a></div>';
    }).catch(function () {
      host.innerHTML = '<p class="product-state">未找到该产品，或产品暂未发布。</p>';
    });
  }

  renderList();
  renderDetail();
})();
