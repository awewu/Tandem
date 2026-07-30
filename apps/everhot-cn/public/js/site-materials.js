(function () {
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
    node.style.backgroundImage = 'url("' + src + '")';
  }

  function applyMaterials(manifest) {
    if (!manifest || typeof manifest !== 'object') return;
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
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteMaterials);
  } else {
    initSiteMaterials();
  }
})();
