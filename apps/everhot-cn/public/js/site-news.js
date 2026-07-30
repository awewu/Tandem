(function () {
  var SITE_CODE = window.EVERHOT_SITE_CODE || 'everhot';
  var API_BASE = window.EVERHOT_API_BASE || '';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function plainText(value) {
    return String(value == null ? '' : value)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sanitizeBody(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '<p>暂无正文内容。</p>';
    var template = document.createElement('template');
    template.innerHTML = raw;
    var allowed = {
      P: true, BR: true, STRONG: true, B: true, EM: true, I: true, U: true, S: true, STRIKE: true,
      UL: true, OL: true, LI: true, A: true, H2: true, H3: true, BLOCKQUOTE: true,
      CODE: true, SPAN: true, FIGURE: true, FIGCAPTION: true, IMG: true
    };
    var textSizes = /^(12|14|16|18|20|24|28)$/;
    var textColors = /^(default|ink|gray|muted|brand)$/;
    var bgColors = /^(none|soft|brand-soft|warning-soft)$/;

    function copySemanticAttrs(source, output) {
      var align = source.getAttribute('data-align') || '';
      var indent = source.getAttribute('data-indent') || '';
      var size = source.getAttribute('data-size') || '';
      var color = source.getAttribute('data-color') || '';
      var bg = source.getAttribute('data-bg') || '';
      if (/^(left|center|right|justify)$/.test(align)) output.setAttribute('data-align', align);
      if (/^(1|2|3)$/.test(indent)) output.setAttribute('data-indent', indent);
      if (textSizes.test(size)) output.setAttribute('data-size', size);
      if (textColors.test(color)) output.setAttribute('data-color', color);
      if (bgColors.test(bg)) output.setAttribute('data-bg', bg);
    }

    function cleanNode(node) {
      if (node.nodeType === 3) return document.createTextNode(node.textContent || '');
      if (node.nodeType !== 1) return null;
      var tag = node.tagName.toUpperCase();
      if (!allowed[tag]) {
        var fragment = document.createDocumentFragment();
        Array.prototype.forEach.call(node.childNodes, function (child) {
          var clean = cleanNode(child);
          if (clean) fragment.appendChild(clean);
        });
        return fragment;
      }
      var output = document.createElement(tag.toLowerCase());
      copySemanticAttrs(node, output);
      if (tag === 'A') {
        var href = node.getAttribute('href') || '';
        if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) {
          output.setAttribute('href', href);
          output.setAttribute('rel', 'noopener noreferrer');
          if (/^https?:\/\//i.test(href)) output.setAttribute('target', '_blank');
        }
      }
      if (tag === 'IMG') {
        var src = node.getAttribute('src') || '';
        if (/^(https?:\/\/|data:image\/|blob:|\/api\/|\/assets\/)/i.test(src)) {
          output.setAttribute('src', src);
          output.setAttribute('alt', node.getAttribute('alt') || '');
          output.setAttribute('loading', 'lazy');
          var size = node.getAttribute('data-size') || '';
          if (/^(small|medium|large|full)$/.test(size)) output.setAttribute('data-size', size);
          var align = node.getAttribute('data-align') || '';
          if (/^(left|center|right)$/.test(align)) output.setAttribute('data-align', align);
        } else {
          return null;
        }
      }
      if (tag === 'FIGURE') {
        var figureSize = node.getAttribute('data-size') || '';
        var figureAlign = node.getAttribute('data-align') || '';
        if (/^(small|medium|large|full)$/.test(figureSize)) output.setAttribute('data-size', figureSize);
        if (/^(left|center|right)$/.test(figureAlign)) output.setAttribute('data-align', figureAlign);
      }
      Array.prototype.forEach.call(node.childNodes, function (child) {
        var clean = cleanNode(child);
        if (clean) output.appendChild(clean);
      });
      return output;
    }

    var fragment = document.createDocumentFragment();
    Array.prototype.forEach.call(template.content.childNodes, function (child) {
      var clean = cleanNode(child);
      if (clean) fragment.appendChild(clean);
    });
    var container = document.createElement('div');
    container.appendChild(fragment);
    var html = container.innerHTML.trim();
    if (html && !/<[a-z][\s\S]*>/i.test(html)) return '<p>' + escapeHtml(plainText(html)) + '</p>';
    if (html) return html;
    return '<p>' + escapeHtml(plainText(raw)) + '</p>';
  }

  function extractItems(json) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.items)) return json.items;
    if (json && json.data && Array.isArray(json.data.items)) return json.data.items;
    return [];
  }

  function newsDate(item) {
    var raw = item.date || item.publishedAt || item.createdAt || '';
    if (!raw) return '';
    return String(raw).slice(0, 7);
  }

  function newsImage(item) {
    return item.image || item.coverImageUrl || item.coverImage || '/assets/img/home-card1.webp';
  }

  function newsRank(item) {
    return item && (item.isFeatured === true || item.featured === true) ? 0 : 1;
  }

  function isFeaturedNews(item) {
    return item && (item.isFeatured === true || item.featured === true);
  }

  function newsTimestamp(item) {
    var raw = item && (item.publishedAt || item.date || item.createdAt);
    var time = raw ? Date.parse(raw) : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function sortNewsItems(items) {
    return (items || []).slice().sort(function (left, right) {
      return newsRank(left) - newsRank(right)
        || (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0)
        || newsTimestamp(right) - newsTimestamp(left);
    });
  }

  function newsUrl(item) {
    var slug = item.slug ? String(item.slug) : '';
    return slug ? '/news/?news=' + encodeURIComponent(slug) : '/news/';
  }

  function cardHtml(item) {
    var title = item.title || '恒热资讯';
    var summary = item.summary || item.description || '';
    return [
      '<a href="', escapeHtml(newsUrl(item)), '" class="news-card', isFeaturedNews(item) ? ' is-featured' : '', '">',
      '<div class="news-img"><img src="', escapeHtml(newsImage(item)), '" alt="" loading="lazy" decoding="async"></div>',
      isFeaturedNews(item) ? '<span class="news-featured-badge">精选</span>' : '',
      '<div class="news-body">',
      '<h4>', escapeHtml(title), '</h4>',
      '<p>', escapeHtml(summary), '</p>',
      '<div class="news-meta"><span class="news-date">', escapeHtml(newsDate(item)), '</span><span class="news-link">了解更多 ›</span></div>',
      '</div>',
      '</a>',
    ].join('');
  }

  function renderNews(items) {
    var grid = document.querySelector('.news-grid');
    if (!grid || !items.length) return;
    var limit = Math.max(Number(grid.getAttribute('data-news-limit') || 3) || 3, 1);
    grid.innerHTML = sortNewsItems(items).slice(0, limit).map(cardHtml).join('');
  }

  function renderDetail(items) {
    var params = new URLSearchParams(window.location.search || '');
    var slug = params.get('news');
    if (!slug) return false;
    var item = items.filter(function (row) { return String(row.slug || '') === slug; })[0];
    var mount = document.querySelector('[data-news-detail]');
    var listSection = document.querySelector('[data-news-list-section]');
    if (!mount) return false;
    if (!item) {
      mount.innerHTML = '<div class="news-detail-empty">未找到这篇资讯，可能已隐藏或归档。</div>';
      if (listSection) listSection.style.display = 'none';
      return true;
    }
    document.title = (item.title || '恒热资讯') + ' | Everhot News & Insights';
    var index = items.indexOf(item);
    var prev = index > 0 ? items[index - 1] : null;
    var next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;
    function navItem(label, row) {
      if (!row) return '<span class="news-detail-nav-disabled">' + label + '：暂无</span>';
      return '<a href="' + escapeHtml(newsUrl(row)) + '">' + label + '：' + escapeHtml(row.title || '恒热资讯') + '</a>';
    }
    mount.innerHTML = [
      '<article class="news-detail">',
      '<a class="news-detail-back" href="/news/">返回资讯列表</a>',
      '<div class="news-detail-cover"><img src="', escapeHtml(newsImage(item)), '" alt="" loading="lazy" decoding="async"></div>',
      '<div class="news-detail-body">',
      '<div class="news-detail-meta"><span class="news-date">', escapeHtml(newsDate(item)), '</span>', isFeaturedNews(item) ? '<span class="news-featured-inline">精选</span>' : '', '</div>',
      '<h2>', escapeHtml(item.title || '恒热资讯'), '</h2>',
      '<p class="news-detail-summary">', escapeHtml(item.summary || ''), '</p>',
      '<div class="news-detail-content">', sanitizeBody(item.body || item.content || item.summary || ''), '</div>',
      '<nav class="news-detail-nav" aria-label="上一篇和下一篇">',
      navItem('上一篇', prev),
      navItem('下一篇', next),
      '</nav>',
      '</div>',
      '</article>'
    ].join('');
    if (listSection) listSection.style.display = 'none';
    return true;
  }

  function initSiteNews() {
    if (!window.fetch) return;
    var grid = document.querySelector('.news-grid');
    var limit = grid ? Math.max(Number(grid.getAttribute('data-news-limit') || 3) || 3, 1) : 3;
    var newsApi = '/api/v2/sites/' + encodeURIComponent(SITE_CODE) + '/news?limit=' + encodeURIComponent(limit);
    fetch(API_BASE + newsApi, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        var items = sortNewsItems(extractItems(json));
        if (!renderDetail(items)) renderNews(items);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteNews);
  } else {
    initSiteNews();
  }
})();
