(function () {
  var DEFAULT_MANIFEST = {
    'brand-story': {
      src: '/assets/img/site-materials/home-audience-residential-bg.webp',
      filename: 'home-audience-residential-bg.webp',
      mimeType: 'image/webp',
      size: 9554,
      updatedAt: '2026-07-31T00:00:00.000Z'
    },
    'service-banner': {
      src: '/assets/img/site-materials/home-audience-commercial-bg.webp',
      filename: 'home-audience-commercial-bg.webp',
      mimeType: 'image/webp',
      size: 9498,
      updatedAt: '2026-07-31T00:00:00.000Z'
    },
    'footer-cert': {
      src: '/assets/img/site-materials/home-audience-professionals-bg.webp',
      filename: 'home-audience-professionals-bg.webp',
      mimeType: 'image/webp',
      size: 10358,
      updatedAt: '2026-07-31T00:00:00.000Z'
    },
    'home-audience-cards': [
      {
        id: 'residential',
        tagZh: '家用',
        tagEn: 'RESIDENTIAL',
        title: '为家庭打造的舒适系统',
        description: '热水 · 采暖为核心，兼顾制冷，全屋舒适一站解决',
        primaryLabel: '热水 Water →',
        primaryHref: '/products/residential/water-heating/',
        secondaryLabel: '采暖制冷 Air →',
        secondaryHref: '/products/residential/heating-cooling/',
        visible: true,
        sortOrder: 0
      },
      {
        id: 'commercial',
        tagZh: '商用',
        tagEn: 'COMMERCIAL',
        title: '为建筑而生的工程系统',
        description: '酒店 · 公寓 · 综合体，高并发连续供热水、稳定供暖，兼顾供冷',
        primaryLabel: '热水 Water →',
        primaryHref: '/products/commercial/water-heating/',
        secondaryLabel: '采暖制冷 Air →',
        secondaryHref: '/products/commercial/heating-cooling/',
        visible: true,
        sortOrder: 1
      },
      {
        id: 'professionals',
        tagZh: '专业人士',
        tagEn: 'PROFESSIONALS',
        title: '为经销商与工程师赋能',
        description: '培训 · 技术资料 · BIM/CAD · 合作计划',
        primaryLabel: '专业人士中心 →',
        primaryHref: '/professionals/',
        secondaryLabel: '查找经销商 →',
        secondaryHref: '/find-a-pro/',
        visible: true,
        sortOrder: 2
      }
    ]
  };

  var MATERIALS = {
    'home-hero': function (asset) {
      var desktop = document.querySelector('.hero-poster-desktop');
      var mobile = document.querySelector('.hero-poster-mobile');
      var video = document.getElementById('heroVideo');
      if (desktop) desktop.src = asset.src;
      if (mobile) mobile.src = asset.src;
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.dataset.desktopSrc = '';
        video.dataset.mobileSrc = '';
        video.style.display = 'none';
      }
    },
    'brand-story': function (asset) {
      setBackground('.entry-res', asset.src);
      setBackground('.news-1', asset.src);
    },
    'service-banner': function (asset) {
      setBackground('.entry-com', asset.src);
    },
    'footer-cert': function (asset) {
      setBackground('.entry-pro', asset.src);
      setBackground('.news-3', asset.src);
    },
  };

  function setBackground(selector, src) {
    var node = document.querySelector(selector);
    if (!node) return;
    if (node.classList && node.classList.contains('entry-card')) {
      node.style.setProperty('--entry-bg-image', 'url("' + src + '")');
      node.style.setProperty('--entry-bg-size', 'cover');
      node.style.setProperty('--entry-bg-position', 'center center');
      return;
    }
    node.style.backgroundImage = 'url("' + src + '")';
  }

  function applyMaterials(manifest) {
    manifest = Object.assign({}, DEFAULT_MANIFEST, manifest && typeof manifest === 'object' ? manifest : {});
    applyHeroCarousel(manifest['home-hero-carousel']);
    applyAudienceCards(manifest['home-audience-cards']);
    Object.keys(MATERIALS).forEach(function (key) {
      var asset = manifest[key];
      if (!asset || !asset.src) return;
      MATERIALS[key](asset);
    });
  }

  function applyAudienceCards(items) {
    if (!Array.isArray(items)) return;
    items.forEach(function (item) {
      if (!item || !item.id) return;
      var card = document.querySelector('[data-audience-card="' + item.id + '"]');
      if (!card) return;
      card.hidden = item.visible === false;

      var tag = card.querySelector('.entry-tag');
      var title = card.querySelector('h2');
      var desc = card.querySelector('p');
      var links = card.querySelectorAll('.entry-links a');

      var tagText = [item.tagZh, item.tagEn].filter(Boolean).join(' ');
      if (tag && tagText) tag.textContent = tagText;
      if (title && item.title) title.textContent = item.title;
      if (desc && item.description) desc.textContent = item.description;
      applyAudienceLink(links[0], item.primaryLabel, item.primaryHref);
      applyAudienceLink(links[1], item.secondaryLabel, item.secondaryHref);
    });
  }

  function applyAudienceLink(node, label, href) {
    if (!node) return;
    if (!label && !href) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    if (label) node.textContent = label;
    if (href) node.href = href;
  }

  function applyHeroCarousel(items) {
    if (!Array.isArray(items) || items.length < 1) return;
    var hero = document.querySelector('.hero');
    var media = document.querySelector('.hero-media');
    if (!hero || !media) return;

    var slides = items
      .filter(function (item) { return item && item.src && item.visible !== false; })
      .sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
    if (!slides.length) return;

    var video = document.getElementById('heroVideo');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.dataset.desktopSrc = '';
      video.dataset.mobileSrc = '';
      video.style.display = 'none';
    }
    media.querySelectorAll('.hero-poster').forEach(function (node) {
      node.style.display = 'none';
    });

    var existing = media.querySelector('.hero-carousel');
    if (existing) existing.remove();
    var carousel = document.createElement('div');
    carousel.className = 'hero-carousel';

    slides.forEach(function (item, index) {
      var slide = document.createElement(item.linkUrl ? 'a' : 'div');
      slide.className = 'hero-carousel-slide' + (index === 0 ? ' is-active' : '');
      slide.style.backgroundImage = 'url("' + item.src + '")';
      if (item.linkUrl) {
        slide.href = item.linkUrl;
        if (/^https?:\/\//i.test(item.linkUrl)) {
          slide.target = '_blank';
          slide.rel = 'noopener noreferrer';
        }
        slide.setAttribute('aria-label', item.filename || 'Everhot hero banner');
      }
      carousel.appendChild(slide);
    });
    media.appendChild(carousel);
    hero.classList.add('has-carousel');

    if (slides.length > 1) {
      var active = 0;
      window.setInterval(function () {
        var nodes = carousel.querySelectorAll('.hero-carousel-slide');
        if (!nodes.length) return;
        nodes[active].classList.remove('is-active');
        active = (active + 1) % nodes.length;
        nodes[active].classList.add('is-active');
      }, 5200);
    }
  }

  function initSiteMaterials() {
    fetch('/assets/img/site-materials/manifest.json', { cache: 'no-store' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(applyMaterials)
      .catch(function () { applyMaterials(DEFAULT_MANIFEST); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteMaterials);
  } else {
    initSiteMaterials();
  }
})();
